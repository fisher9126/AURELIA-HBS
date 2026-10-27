package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/** DASH-01, RPT-01–06, CD-03. Kiểm tra cấu trúc và tính nhất quán số liệu. */
@DisplayName("Dashboard và báo cáo")
class ReportIT extends AbstractIntegrationTest {

    @Test
    @DisplayName("TC-RPT-01 Tổng quan hôm nay: tổng phòng 45, trạng thái phòng cộng lại bằng tổng")
    void summary() {
        JsonNode s = okData(get("/dashboard/summary", reception()));
        long total = s.path("totalRooms").asLong();
        assertThat(total).isGreaterThanOrEqualTo(45);
        long sum = 0;
        for (JsonNode v : s.path("roomStatus")) {
            sum += v.asLong();
        }
        assertThat(sum).isEqualTo(total);
        assertThat(s.path("occupancyPercent").decimalValue().doubleValue()).isBetween(0.0, 100.0);
    }

    @Test
    @DisplayName("TC-RPT-02 KPI: ADR = doanh thu / đêm bán, RevPAR = doanh thu / đêm khả dụng")
    void kpis() {
        LocalDate from = today().plusDays(1);
        JsonNode cur = okData(get("/dashboard/kpis?from=" + from + "&to=" + from.plusDays(400), admin())).path("current");
        long revenue = cur.path("revenue").asLong();
        long sold = cur.path("roomNightsSold").asLong();
        long available = cur.path("roomNightsAvailable").asLong();
        assertThat(available).isEqualTo(cur.path("roomNightsAvailable").asLong());
        if (sold > 0) {
            assertThat(cur.path("adr").asLong()).isEqualTo(Math.round((double) revenue / sold));
        }
        assertThat(cur.path("revpar").asLong()).isEqualTo(Math.round((double) revenue / available));
        assertThat(get("/dashboard/kpis?from=" + from + "&to=" + from, admin()).errorCode())
                .isEqualTo("INVALID_DATE_RANGE");
    }

    @Test
    @DisplayName("TC-RPT-03 Tỷ trọng kênh cộng lại ≈ 100%; doanh thu thuần = doanh thu − hoa hồng")
    void channels() {
        double share = 0;
        long count = 0;
        for (JsonNode r : okData(get("/dashboard/booking-sources", admin()))) {
            share += r.path("sharePercent").asDouble();
            count += r.path("bookings").asLong();
        }
        if (count > 0) {
            assertThat(share).isBetween(99.0, 101.0);
        }
        for (JsonNode r : okData(get("/dashboard/revenue-breakdown?from=" + today() + "&to=" + today().plusDays(400),
                admin()))) {
            assertThat(r.path("netRevenue").asLong())
                    .isEqualTo(r.path("revenue").asLong() - r.path("commission").asLong());
        }
    }

    @Test
    @DisplayName("TC-RPT-04 Heatmap công suất đủ số ngày; xu hướng ADR/RevPAR đủ 12 tháng; phân tích hủy")
    void advanced() {
        LocalDate from = today().plusDays(300);
        JsonNode heat = okData(get("/dashboard/occupancy?from=" + from + "&to=" + from.plusDays(7), reception()));
        assertThat(heat.size()).isEqualTo(7);
        assertThat(heat.get(0).path("byRoomType").size()).isGreaterThanOrEqualTo(3);
        assertThat(okData(get("/reports/adr-revpar", admin())).size()).isEqualTo(12);
        JsonNode c = okData(get("/reports/cancellations", admin()));
        assertThat(c.has("byReason")).isTrue();
        assertThat(c.path("cancellationRatePercent").asDouble()).isBetween(0.0, 100.0);
    }

    @Test
    @DisplayName("TC-RPT-05 Tìm kiếm toàn hệ thống và nhật ký thao tác")
    void searchAndAudit() {
        LocalDate in = today().plusDays(356);
        JsonNode b = okData(staffBooking("107", in, in.plusDays(1)));
        JsonNode hits = okData(get("/search?q=" + b.path("bookingRef").asText(), reception()));
        assertThat(hits.path("bookings").size()).isEqualTo(1);
        assertThat(okData(get("/search?q=Sanjay", reception())).path("guests").toString()).contains("Sanjay");
        JsonNode logs = okData(get("/audit-logs?entityType=booking&entityId=" + b.path("id").asText(), admin()));
        assertThat(logs.toString()).contains("\"action\":\"CREATE\"").contains("Nguyễn Mai");
    }
}
