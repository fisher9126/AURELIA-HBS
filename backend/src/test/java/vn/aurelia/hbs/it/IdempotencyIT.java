package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/** SRS 9.1: Idempotency-Key cho POST /bookings và POST /bookings/:id/payments. */
@DisplayName("Idempotency-Key (bấm hai lần)")
class IdempotencyIT extends AbstractIntegrationTest {

    @Test
    @DisplayName("TC-IDEM-01 Gửi lại cùng khóa trả đúng đặt phòng cũ, không tạo bản ghi mới")
    void sameKeySameBooking() {
        String guest = newGuest();
        LocalDate in = today().plusDays(310);
        Map<String, Object> body = json("roomTypeId", STANDARD, "planCode", "EP", "checkIn", in.toString(),
                "checkOut", in.plusDays(1).toString(), "adults", 1);
        String key = "idem-" + UUID.randomUUID();
        Res first = post("/bookings", guest, body, "Idempotency-Key", key);
        Res second = post("/bookings", guest, body, "Idempotency-Key", key);
        assertThat(first.status()).isEqualTo(201);
        assertThat(second.status()).isEqualTo(201);
        assertThat(second.data().path("id").asText()).isEqualTo(first.data().path("id").asText());

        Res other = post("/bookings", guest, body, "Idempotency-Key", "idem-" + UUID.randomUUID());
        assertThat(other.data().path("id").asText()).isNotEqualTo(first.data().path("id").asText());
        assertThat(get("/me/bookings", guest).data().size()).isEqualTo(2);
    }

    @Test
    @DisplayName("TC-IDEM-02 Thanh toán gửi lại cùng khóa chỉ ghi một lần")
    void paymentOnce() {
        LocalDate in = today().plusDays(312);
        String id = okData(staffBooking("210", in, in.plusDays(1))).path("id").asText();
        Map<String, Object> pay = json("type", "DEPOSIT", "method", "CASH", "amount", 200_000);
        String key = "pay-" + UUID.randomUUID();
        post("/bookings/" + id + "/payments", reception(), pay, "Idempotency-Key", key);
        Res again = post("/bookings/" + id + "/payments", reception(), pay, "Idempotency-Key", key);
        assertThat(again.data().path("payments").size()).isEqualTo(1);
        assertThat(again.data().path("paid").asLong()).isEqualTo(200_000);
    }

    @Test
    @DisplayName("TC-IDEM-03 Cùng khóa nhưng người dùng khác là hai yêu cầu độc lập")
    void keyScopedPerUser() {
        LocalDate in = today().plusDays(314);
        Map<String, Object> body = json("roomTypeId", STANDARD, "planCode", "EP", "checkIn", in.toString(),
                "checkOut", in.plusDays(1).toString(), "adults", 1);
        String key = "shared-" + UUID.randomUUID();
        Res a = post("/bookings", newGuest(), body, "Idempotency-Key", key);
        Res b = post("/bookings", newGuest(), body, "Idempotency-Key", key);
        assertThat(a.data().path("id").asText()).isNotEqualTo(b.data().path("id").asText());
    }
}
