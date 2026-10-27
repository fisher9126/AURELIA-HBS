package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/**
 * BR-05, CD-01, NFR toàn vẹn dữ liệu: nhiều yêu cầu đặt cùng lúc không bao giờ tạo overbooking.
 * Bảo vệ hai lớp: khóa dòng phòng (SELECT … FOR UPDATE) và ràng buộc EXCLUDE trong PostgreSQL.
 */
@DisplayName("Đặt phòng đồng thời (chống overbooking)")
class ConcurrencyIT extends AbstractIntegrationTest {

    private <T> List<T> runTogether(int n, java.util.function.IntFunction<T> task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(n);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<T>> futures = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            int idx = i;
            Callable<T> c = () -> {
                start.await();
                return task.apply(idx);
            };
            futures.add(pool.submit(c));
        }
        start.countDown();
        List<T> out = new ArrayList<>();
        for (Future<T> f : futures) {
            out.add(f.get());
        }
        pool.shutdown();
        return out;
    }

    @Test
    @DisplayName("TC-CONC-01 12 lễ tân cùng đặt phòng 301 cùng ngày: đúng 1 thành công, 11 nhận BOOKING_CONFLICT")
    void sameRoomSameDates() throws Exception {
        LocalDate in = today().plusDays(90);
        String staff = reception();
        String room = roomId("301").toString();
        List<Res> results = runTogether(12, i -> post("/bookings", staff, json("roomId", room, "planCode", "EP",
                "checkIn", in.toString(), "checkOut", in.plusDays(2).toString(), "adults", 2,
                "guest", json("fullName", "Khách song song " + i, "phone", "09330000" + String.format("%02d", i)))));

        Map<Integer, Long> byStatus = results.stream().collect(Collectors.groupingBy(Res::status, Collectors.counting()));
        assertThat(byStatus.get(201)).as(byStatus.toString()).isEqualTo(1L);
        assertThat(byStatus.get(409)).isEqualTo(11L);
        results.stream().filter(r -> r.status() == 409)
                .forEach(r -> assertThat(r.errorCode()).isIn("BOOKING_CONFLICT", "ROOM_UNAVAILABLE"));
        Integer holding = jdbc.queryForObject("""
                select count(*) from bookings b join rooms r on r.id = b.room_id
                where r.room_number = '301' and b.status in ('CONFIRMED','CHECKED_IN')
                  and b.check_in_date < ? and b.check_out_date > ?""", Integer.class, in.plusDays(2), in);
        assertThat(holding).isEqualTo(1);
    }

    @Test
    @DisplayName("TC-CONC-02 15 khách cùng đặt Luxury Suite (10 phòng): đúng 10 thành công, không phòng nào bị trùng")
    void typeInventory() throws Exception {
        LocalDate in = today().plusDays(300);
        List<String> guests = new ArrayList<>();
        for (int i = 0; i < 15; i++) {
            guests.add(newGuest());
        }
        List<Res> results = runTogether(15, i -> post("/bookings", guests.get(i), json("roomTypeId", LUXURY,
                "planCode", "EP", "checkIn", in.toString(), "checkOut", in.plusDays(3).toString(), "adults", 2)));

        long ok = results.stream().filter(r -> r.status() == 201).count();
        assertThat(ok).as(results.toString()).isEqualTo(10);
        results.stream().filter(r -> r.status() != 201)
                .forEach(r -> assertThat(r.errorCode()).isIn("ROOM_UNAVAILABLE", "BOOKING_CONFLICT"));
        Integer overlaps = jdbc.queryForObject("""
                select count(*) from bookings a join bookings b on a.room_id = b.room_id and a.id < b.id
                where a.status in ('CONFIRMED','CHECKED_IN') and b.status in ('CONFIRMED','CHECKED_IN')
                  and a.check_in_date < b.check_out_date and b.check_in_date < a.check_out_date""", Integer.class);
        assertThat(overlaps).isZero();
        Res sold = get("/rooms/available?checkIn=" + in + "&checkOut=" + in.plusDays(3) + "&adults=2", null);
        assertThat(sold.data().path("roomTypes").toString()).doesNotContain(LUXURY);
    }
}
