package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/** BK-05, BK-14, BR-10, SRS 13.2: phí hủy theo số giờ tới 14:00 ngày nhận phòng; no-show. */
@DisplayName("Hủy phòng và không đến (BK-05, BK-14)")
class CancellationIT extends AbstractIntegrationTest {

    /**
     * Phân tích giá trị biên của 4 mốc mặc định: ≥72h 0%, 48–72h 25%, 24–48h 50%, <24h 100%.
     * hoursBefore = số giờ từ thời điểm hủy tới 14:00 ngày nhận phòng.
     */
    @ParameterizedTest(name = "hủy trước {0} giờ → phí {1}%")
    @CsvSource({"96, 0", "72, 0", "71, 25", "48, 25", "47, 50", "24, 50", "23, 100", "1, 100"})
    @DisplayName("TC-CANCEL-01 Biên các mốc phí hủy")
    void tierBoundaries(int hoursBefore, int expectedPercent) {
        LocalDate in = today().plusDays(60 + hoursBefore % 7);
        String room = String.valueOf(101 + (hoursBefore % 10)); // 101–110 Standard King
        JsonNode b = okData(staffBooking(room, in, in.plusDays(1)));
        clock.setTo(in.atTime(LocalTime.of(14, 0)).minusHours(hoursBefore));
        JsonNode q = okData(get("/bookings/" + b.path("id").asText() + "/cancellation-quote", reception()));
        assertThat(q.path("hoursBeforeCheckIn").asLong()).isEqualTo(hoursBefore);
        assertThat(q.path("penaltyPercent").asInt()).isEqualTo(expectedPercent);
        assertThat(q.path("cancellationFee").asLong())
                .isEqualTo(Math.round(b.path("totalAmount").asLong() * expectedPercent / 100.0));
        // dọn để các lần chạy sau không trùng phòng
        clock.reset();
        okData(patch("/bookings/" + b.path("id").asText() + "/cancel", admin(),
                json("reason", "OTHER", "waiveFee", true)));
    }

    @Test
    @DisplayName("TC-CANCEL-02 Hủy có đặt cọc: phí trừ vào tiền đã trả, phần còn lại là số hoàn")
    void cancelWithDeposit() {
        LocalDate in = today().plusDays(70);
        JsonNode b = okData(staffBooking("202", in, in.plusDays(2)));
        String id = b.path("id").asText();
        long total = b.path("totalAmount").asLong();
        okData(post("/bookings/" + id + "/payments", reception(),
                json("type", "DEPOSIT", "method", "CASH", "amount", total)));

        clock.setTo(in.minusDays(1).atTime(10, 0)); // 28 giờ trước → 50%
        Res c = patch("/bookings/" + id + "/cancel", reception(), json("reason", "EMERGENCY", "note", "Ốm"));
        assertThat(c.status()).isEqualTo(200);
        long fee = Math.round(total * 0.5);
        assertThat(c.data().path("status").asText()).isEqualTo("CANCELLED");
        assertThat(c.data().path("cancellationFee").asLong()).isEqualTo(fee);
        assertThat(c.data().path("refundAmount").asLong()).isEqualTo(total - fee);

        JsonNode folio = okData(get("/bookings/" + id + "/folio", reception()));
        assertThat(folio.path("refundDue").asLong()).isEqualTo(total - fee);
        Res refund = post("/bookings/" + id + "/payments", reception(),
                json("type", "REFUND", "method", "CASH", "amount", total - fee));
        assertThat(refund.data().path("refundDue").asLong()).isZero();

        Res again = patch("/bookings/" + id + "/cancel", reception(), json("reason", "OTHER"));
        assertThat(again.errorCode()).isEqualTo("BOOKING_NOT_CANCELLABLE");
        // phòng được giải phóng: đặt lại cùng ngày thành công
        assertThat(staffBooking("202", in, in.plusDays(2)).status()).isEqualTo(201);
    }

    @Test
    @DisplayName("TC-CANCEL-03 Chỉ Admin được miễn phí hủy; thiếu lý do bị từ chối")
    void waiveOnlyAdmin() {
        LocalDate in = today().plusDays(74);
        String id = okData(staffBooking("203", in, in.plusDays(1))).path("id").asText();
        clock.setTo(in.atTime(9, 0));
        assertThat(patch("/bookings/" + id + "/cancel", reception(), json()).errorCode()).isEqualTo("VALIDATION_ERROR");
        Res recep = patch("/bookings/" + id + "/cancel", reception(), json("reason", "HEALTH", "waiveFee", true));
        assertThat(recep.status()).isEqualTo(403);
        Res adm = patch("/bookings/" + id + "/cancel", admin(), json("reason", "HEALTH", "waiveFee", true));
        assertThat(adm.data().path("cancellationFee").asLong()).isZero();
    }

    @Test
    @DisplayName("TC-NOSHOW-01 Qua giờ nhận phòng không hủy được; đánh dấu no-show phí 100%")
    void noShow() {
        LocalDate in = today().plusDays(78);
        JsonNode b = okData(staffBooking("204", in, in.plusDays(2)));
        String id = b.path("id").asText();
        assertThat(patch("/bookings/" + id + "/no-show", reception(), null).errorCode())
                .as("chưa tới ngày nhận").isEqualTo("INVALID_STATUS_TRANSITION");

        clock.setTo(in.atTime(LocalTime.of(23, 0)));
        assertThat(patch("/bookings/" + id + "/cancel", reception(), json("reason", "OTHER")).errorCode())
                .isEqualTo("BOOKING_NOT_CANCELLABLE");
        Res ns = patch("/bookings/" + id + "/no-show", reception(), null);
        assertThat(ns.data().path("status").asText()).isEqualTo("NO_SHOW");
        assertThat(ns.data().path("cancellationFee").asLong()).isEqualTo(b.path("totalAmount").asLong());
        assertThat(get("/bookings/" + id + "/folio", reception()).data().path("balance").asLong())
                .isEqualTo(b.path("totalAmount").asLong());
    }

    @Test
    @DisplayName("TC-CANCEL-04 Khách tự hủy đặt phòng của mình, không hủy được của người khác")
    void guestCancelsOwn() {
        String owner = newGuest();
        LocalDate in = today().plusDays(200);
        String id = okData(post("/bookings", owner, json("roomTypeId", DELUXE, "planCode", "EP", "checkIn",
                in.toString(), "checkOut", in.plusDays(1).toString(), "adults", 1))).path("id").asText();
        assertThat(patch("/bookings/" + id + "/cancel", newGuest(), json("reason", "OTHER")).status()).isEqualTo(404);
        Res own = patch("/bookings/" + id + "/cancel", owner, json("reason", "CHANGE_OF_PLANS"));
        assertThat(own.data().path("status").asText()).isEqualTo("CANCELLED");
        assertThat(own.data().path("cancellationFee").asLong()).isZero();
        assertThat(get("/me/bookings?tab=cancelled", owner).data().size()).isEqualTo(1);
    }
}
