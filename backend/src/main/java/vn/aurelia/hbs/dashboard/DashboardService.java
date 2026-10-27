package vn.aurelia.hbs.dashboard;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.aurelia.hbs.common.ApiException;
import vn.aurelia.hbs.common.ErrorCode;
import vn.aurelia.hbs.property.PropertyService;

/**
 * DASH-01, RPT-01 đến RPT-04. Truy vấn SQL thuần cho các phép gộp.
 * Doanh thu phòng được phân bổ theo từng đêm lưu trú: (room_amount − discount_amount) / số đêm,
 * chỉ tính đặt phòng confirmed, checked_in, checked_out.
 */
@Service
@Transactional(readOnly = true)
public class DashboardService {
    private static final String SOLD = "('CONFIRMED','CHECKED_IN','CHECKED_OUT')";

    private final NamedParameterJdbcTemplate jdbc;
    private final PropertyService propertyService;
    private final Clock clock;

    public DashboardService(NamedParameterJdbcTemplate jdbc, PropertyService propertyService, Clock clock) {
        this.jdbc = jdbc;
        this.propertyService = propertyService;
        this.clock = clock;
    }

    public record Summary(LocalDate date, long arrivals, long arrived, long departures, long departed, long inHouse,
                          long totalRooms, long occupiedTonight, BigDecimal occupancyPercent,
                          Map<String, Long> roomStatus) {}

    public record Period(LocalDate from, LocalDate to, long revenue, long roomNightsSold, long roomNightsAvailable,
                         BigDecimal occupancyPercent, long adr, long revpar, long bookings) {}

    public record Kpis(Period current, Period previous, Map<String, BigDecimal> changePercent) {}

    public record SalesRow(LocalDate weekStart, long bookings, long grossRevenue, long discounts, long refunds,
                           long cancellationFees) {}

    public record SourceRow(String channelCode, String name, String color, long bookings, BigDecimal sharePercent) {}

    public record BreakdownRow(String channelCode, String name, long bookings, long roomNights, long revenue,
                               long commission, long netRevenue, long adr) {}

    public Summary summary(LocalDate date) {
        LocalDate d = date == null ? LocalDate.now(clock) : date;
        MapSqlParameterSource p = params().addValue("d", d);
        Map<String, Object> row = jdbc.queryForMap("""
                select
                  count(*) filter (where check_in_date = :d and status in ('PENDING','CONFIRMED')) as arrivals,
                  count(*) filter (where check_in_date = :d and status in ('CHECKED_IN','CHECKED_OUT')) as arrived,
                  count(*) filter (where check_out_date = :d and status = 'CHECKED_IN') as departures,
                  count(*) filter (where check_out_date = :d and status = 'CHECKED_OUT') as departed,
                  count(*) filter (where status = 'CHECKED_IN') as in_house,
                  count(*) filter (where status in ('CONFIRMED','CHECKED_IN')
                                     and check_in_date <= :d and check_out_date > :d) as occupied_tonight
                from bookings where property_id = :pid""", p);
        long totalRooms = count("select count(*) from rooms where property_id = :pid and is_active", p);
        Map<String, Long> status = new java.util.LinkedHashMap<>();
        jdbc.query("select status, count(*) c from rooms where property_id = :pid and is_active group by status "
                + "order by status", p, rs -> {
            status.put(rs.getString("status"), rs.getLong("c"));
        });
        long occ = ((Number) row.get("occupied_tonight")).longValue();
        return new Summary(d, num(row, "arrivals"), num(row, "arrived"), num(row, "departures"), num(row, "departed"),
                num(row, "in_house"), totalRooms, occ, pct(occ, totalRooms), status);
    }

    /** RPT-01: doanh thu, ADR, RevPAR, công suất so với kỳ liền trước cùng độ dài. */
    public Kpis kpis(LocalDate from, LocalDate to) {
        LocalDate[] r = range(from, to, 30);
        long days = r[1].toEpochDay() - r[0].toEpochDay();
        Period cur = period(r[0], r[1]);
        Period prev = period(r[0].minusDays(days), r[0]);
        Map<String, BigDecimal> change = new java.util.LinkedHashMap<>();
        change.put("revenue", delta(cur.revenue(), prev.revenue()));
        change.put("occupancy", cur.occupancyPercent().subtract(prev.occupancyPercent()));
        change.put("adr", delta(cur.adr(), prev.adr()));
        change.put("revpar", delta(cur.revpar(), prev.revpar()));
        change.put("bookings", delta(cur.bookings(), prev.bookings()));
        return new Kpis(cur, prev, change);
    }

    private Period period(LocalDate from, LocalDate to) {
        MapSqlParameterSource p = params().addValue("from", from).addValue("to", to);
        Map<String, Object> row = jdbc.queryForMap("""
                with nights as (
                  select b.id, (b.room_amount - b.discount_amount)::numeric / b.total_nights as nightly
                  from bookings b
                  cross join lateral generate_series(b.check_in_date, b.check_out_date - 1, interval '1 day') n(d)
                  where b.property_id = :pid and b.status in %s
                    and n.d >= :from and n.d < :to)
                select coalesce(round(sum(nightly)), 0) as revenue, count(*) as nights from nights""".formatted(SOLD), p);
        long revenue = num(row, "revenue");
        long sold = num(row, "nights");
        long rooms = count("select count(*) from rooms where property_id = :pid and is_active", p);
        long available = rooms * (to.toEpochDay() - from.toEpochDay());
        long bookingsCount = count("""
                select count(*) from bookings where property_id = :pid and status in %s
                  and created_at >= cast(:from as date) and created_at < cast(:to as date)""".formatted(SOLD), p);
        return new Period(from, to, revenue, sold, available, pct(sold, available),
                sold == 0 ? 0 : Math.round((double) revenue / sold),
                available == 0 ? 0 : Math.round((double) revenue / available), bookingsCount);
    }

    /** RPT-02: theo tuần tạo đặt phòng. */
    public List<SalesRow> sales(LocalDate from, LocalDate to) {
        LocalDate[] r = range(from, to, 84);
        MapSqlParameterSource p = params().addValue("from", r[0]).addValue("to", r[1]);
        return jdbc.query("""
                with weeks as (
                  select generate_series(date_trunc('week', cast(:from as date)), cast(:to as date) - 1,
                                         interval '1 week')::date as w),
                b as (
                  select date_trunc('week', created_at at time zone 'Asia/Ho_Chi_Minh')::date as w, *
                  from bookings where property_id = :pid
                    and created_at >= cast(:from as date) and created_at < cast(:to as date)),
                rf as (
                  select date_trunc('week', p.paid_at at time zone 'Asia/Ho_Chi_Minh')::date as w, sum(p.amount) amt
                  from payments p join bookings bk on bk.id = p.booking_id
                  where bk.property_id = :pid and p.type = 'REFUND' and p.status = 'COMPLETED'
                    and p.paid_at >= cast(:from as date) and p.paid_at < cast(:to as date)
                  group by 1)
                select weeks.w,
                  count(b.id) filter (where b.status in %s) as bookings,
                  coalesce(sum(b.total_amount) filter (where b.status in %s), 0) as gross,
                  coalesce(sum(b.discount_amount) filter (where b.status in %s), 0) as discounts,
                  coalesce(max(rf.amt), 0) as refunds,
                  coalesce(sum(b.cancellation_fee) filter (where b.status in ('CANCELLED','NO_SHOW')), 0) as fees
                from weeks left join b on b.w = weeks.w left join rf on rf.w = weeks.w
                group by weeks.w order by weeks.w""".formatted(SOLD, SOLD, SOLD), p,
                (rs, i) -> new SalesRow(rs.getDate("w").toLocalDate(), rs.getLong("bookings"), rs.getLong("gross"),
                        rs.getLong("discounts"), rs.getLong("refunds"), rs.getLong("fees")));
    }

    /** RPT-03: tỷ trọng đặt phòng theo kênh (theo ngày tạo, gồm cả đã hủy để thấy chất lượng kênh). */
    public List<SourceRow> sources(LocalDate from, LocalDate to) {
        LocalDate[] r = range(from, to, 30);
        MapSqlParameterSource p = params().addValue("from", r[0]).addValue("to", r[1]);
        List<Object[]> rows = jdbc.query("""
                select c.code, c.name, c.color, count(b.id) as n
                from booking_channels c left join bookings b on b.channel_code = c.code and b.property_id = :pid
                  and b.created_at >= cast(:from as date) and b.created_at < cast(:to as date)
                group by c.code, c.name, c.color order by n desc, c.code""", p,
                (rs, i) -> new Object[] {rs.getString(1), rs.getString(2), rs.getString(3), rs.getLong(4)});
        long total = rows.stream().mapToLong(o -> (Long) o[3]).sum();
        return rows.stream().map(o -> new SourceRow((String) o[0], (String) o[1], (String) o[2], (Long) o[3],
                pct((Long) o[3], total))).toList();
    }

    /** RPT-04: theo kênh, đặt phòng có ngày nhận trong kỳ. */
    public List<BreakdownRow> revenueBreakdown(LocalDate from, LocalDate to) {
        LocalDate[] r = range(from, to, 30);
        MapSqlParameterSource p = params().addValue("from", r[0]).addValue("to", r[1]);
        return jdbc.query("""
                select c.code, c.name, count(b.id) as n, coalesce(sum(b.total_nights), 0) as nights,
                  coalesce(sum(b.room_amount - b.discount_amount), 0) as revenue,
                  coalesce(sum(b.commission_amount), 0) as commission
                from booking_channels c left join bookings b on b.channel_code = c.code and b.property_id = :pid
                  and b.status in %s and b.check_in_date >= :from and b.check_in_date < :to
                group by c.code, c.name order by revenue desc, c.code""".formatted(SOLD), p, (rs, i) -> {
            long nights = rs.getLong("nights");
            long revenue = rs.getLong("revenue");
            long commission = rs.getLong("commission");
            return new BreakdownRow(rs.getString("code"), rs.getString("name"), rs.getLong("n"), nights, revenue,
                    commission, revenue - commission, nights == 0 ? 0 : Math.round((double) revenue / nights));
        });
    }

    private MapSqlParameterSource params() {
        UUID pid = propertyService.current().getId();
        return new MapSqlParameterSource("pid", pid);
    }

    private LocalDate[] range(LocalDate from, LocalDate to, int defaultDays) {
        LocalDate t = to == null ? LocalDate.now(clock).plusDays(1) : to;
        LocalDate f = from == null ? t.minusDays(defaultDays) : from;
        if (!t.isAfter(f) || t.toEpochDay() - f.toEpochDay() > 366) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "Khoảng báo cáo từ 1 đến 366 ngày (to không bao gồm)");
        }
        return new LocalDate[] {f, t};
    }

    private long count(String sql, MapSqlParameterSource p) {
        Long n = jdbc.queryForObject(sql, p, Long.class);
        return n == null ? 0 : n;
    }

    private static long num(Map<String, Object> row, String key) {
        Object v = row.get(key);
        return v == null ? 0 : ((Number) v).longValue();
    }

    static BigDecimal pct(long part, long whole) {
        if (whole == 0) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(part * 100.0 / whole).setScale(1, RoundingMode.HALF_UP);
    }

    private static BigDecimal delta(long cur, long prev) {
        if (prev == 0) {
            return cur == 0 ? BigDecimal.ZERO : null;
        }
        return BigDecimal.valueOf((cur - prev) * 100.0 / prev).setScale(1, RoundingMode.HALF_UP);
    }
}
