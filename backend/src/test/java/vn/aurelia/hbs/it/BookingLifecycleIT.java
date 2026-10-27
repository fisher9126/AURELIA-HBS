package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/**
 * Luồng chính UC-02, UC-05: đặt tại quầy → check-in → phí phát sinh → thanh toán → check-out → dọn phòng.
 * Kiểm tra cả các chuyển trạng thái bị cấm (SRS 12.2). Phòng 201, ngày +30.
 */
@DisplayName("Vòng đời đặt phòng (BK, PAY, HK)")
class BookingLifecycleIT extends AbstractIntegrationTest {

    @Test
    @DisplayName("TC-BK-01 Đặt tại quầy → check-in → minibar → thanh toán → check-out → dọn phòng")
    void fullStay() {
        LocalDate in = today().plusDays(30);
        LocalDate out = in.plusDays(2);
        Res created = staffBooking("201", in, out, "estimatedArrival", "15:00", "bedPreference", "KING");
        assertThat(created.status()).as(created.toString()).isEqualTo(201);
        JsonNode b = created.data();
        String id = b.path("id").asText();
        assertThat(b.path("status").asText()).isEqualTo("CONFIRMED");
        assertThat(b.path("bookingRef").asText()).matches("BK-" + in.toString().replace("-", "") + "-\\d{4}");
        assertThat(b.path("nights").asInt()).isEqualTo(2);
        long total = b.path("totalAmount").asLong();
        assertThat(total).isEqualTo(b.path("roomAmount").asLong() - b.path("discountAmount").asLong()
                + b.path("serviceFee").asLong() + b.path("taxAmount").asLong());

        // Chưa tới ngày nhận phòng
        Res early = patch("/bookings/" + id + "/check-in", reception(), json("idVerified", true));
        assertThat(early.status()).isEqualTo(409);
        assertThat(early.errorCode()).isEqualTo("INVALID_STATUS_TRANSITION");

        clock.setTo(in.atTime(LocalTime.of(14, 30)));
        Res noId = patch("/bookings/" + id + "/check-in", reception(), json("idVerified", false));
        assertThat(noId.status()).isEqualTo(400);

        Res ci = patch("/bookings/" + id + "/check-in", reception(),
                json("idVerified", true, "idType", "CCCD", "idNumber", "048190001234"));
        assertThat(ci.status()).as(ci.toString()).isEqualTo(200);
        assertThat(ci.data().path("status").asText()).isEqualTo("CHECKED_IN");
        assertThat(roomStatus("201")).isEqualTo("OCCUPIED");

        Res board = get("/rooms/board", reception());
        assertThat(board.data().toString()).contains("\"roomNumber\":\"201\"").contains("Khách Quầy 201");

        Res charge = post("/bookings/" + id + "/charges", reception(),
                json("type", "MINIBAR", "description", "2 lon bia", "quantity", 2, "unitPrice", 60000));
        assertThat(charge.status()).isEqualTo(201);
        assertThat(charge.data().path("grandTotal").asLong()).isEqualTo(total + 120_000);

        Res blocked = patch("/bookings/" + id + "/check-out", reception(), json());
        assertThat(blocked.status()).isEqualTo(409);
        assertThat(blocked.body().path("error").path("details").path("balance").asLong()).isEqualTo(total + 120_000);

        Res over = post("/bookings/" + id + "/payments", reception(),
                json("type", "PAYMENT", "method", "CASH", "amount", total + 120_001));
        assertThat(over.status()).isEqualTo(422);
        assertThat(over.errorCode()).isEqualTo("PAYMENT_EXCEEDS_BALANCE");

        Res deposit = post("/bookings/" + id + "/payments", reception(),
                json("type", "DEPOSIT", "method", "BANK_TRANSFER", "amount", 1_000_000, "transactionRef", "VCB1"));
        assertThat(deposit.data().path("paymentStatus").asText()).isEqualTo("PARTIAL");
        Res rest = post("/bookings/" + id + "/payments", reception(),
                json("type", "PAYMENT", "method", "CARD", "amount", total + 120_000 - 1_000_000));
        assertThat(rest.data().path("balance").asLong()).isZero();
        assertThat(rest.data().path("paymentStatus").asText()).isEqualTo("PAID");

        clock.setTo(out.atTime(LocalTime.of(11, 0)));
        Res co = patch("/bookings/" + id + "/check-out", reception(), json());
        assertThat(co.status()).as(co.toString()).isEqualTo(200);
        assertThat(co.data().path("status").asText()).isEqualTo("CHECKED_OUT");
        assertThat(roomStatus("201")).isEqualTo("DIRTY");

        Res tasks = get("/housekeeping/tasks", reception());
        JsonNode cleaning = null;
        for (JsonNode t : tasks.data()) {
            if (t.path("roomNumber").asText().equals("201") && t.path("type").asText().equals("CLEANING")) {
                cleaning = t;
            }
        }
        assertThat(cleaning).as("check-out mở việc dọn phòng").isNotNull();
        Res done = patch("/housekeeping/tasks/" + cleaning.path("id").asText() + "/complete", reception(), null);
        assertThat(done.status()).isEqualTo(200);
        assertThat(roomStatus("201")).isEqualTo("AVAILABLE");

        // Đã check-out thì không hủy, không check-in lại được
        assertThat(patch("/bookings/" + id + "/cancel", reception(), json("reason", "OTHER")).errorCode())
                .isEqualTo("BOOKING_NOT_CANCELLABLE");
        assertThat(patch("/bookings/" + id + "/check-in", reception(), json("idVerified", true)).errorCode())
                .isEqualTo("INVALID_STATUS_TRANSITION");
    }

    @Test
    @DisplayName("TC-BK-02 Admin cho khách nợ khi trả phòng, lễ tân thì không được")
    void checkoutWithDebt() {
        LocalDate in = today().plusDays(34);
        String id = okData(staffBooking("205", in, in.plusDays(1))).path("id").asText();
        clock.setTo(in.atTime(15, 0));
        okData(patch("/bookings/" + id + "/check-in", reception(), json("idVerified", true)));
        Res recep = patch("/bookings/" + id + "/check-out", reception(), json("allowDebt", true));
        assertThat(recep.status()).isEqualTo(403);
        Res adm = patch("/bookings/" + id + "/check-out", admin(), json("allowDebt", true));
        assertThat(adm.status()).isEqualTo(200);
        assertThat(adm.data().path("paymentStatus").asText()).isEqualTo("UNPAID");
    }

    @Test
    @DisplayName("TC-BK-03 Pending → confirm; sửa ngày tính lại giá; lịch hiển thị thanh đặt phòng")
    void pendingConfirmUpdateCalendar() {
        LocalDate in = today().plusDays(38);
        Res pending = staffBooking("206", in, in.plusDays(1), "confirm", false);
        assertThat(pending.data().path("status").asText()).isEqualTo("PENDING");
        String id = pending.data().path("id").asText();
        long oneNight = pending.data().path("totalAmount").asLong();

        Res confirmed = patch("/bookings/" + id + "/confirm", reception(), null);
        assertThat(confirmed.data().path("status").asText()).isEqualTo("CONFIRMED");
        assertThat(patch("/bookings/" + id + "/confirm", reception(), null).errorCode())
                .isEqualTo("INVALID_STATUS_TRANSITION");

        Res longer = put("/bookings/" + id, reception(), json("checkOut", in.plusDays(3).toString()));
        assertThat(longer.status()).as(longer.toString()).isEqualTo(200);
        assertThat(longer.data().path("nights").asInt()).isEqualTo(3);
        assertThat(longer.data().path("totalAmount").asLong()).isGreaterThan(oneNight);

        Res cal = get("/bookings/calendar?from=" + in + "&to=" + in.plusDays(7), reception());
        assertThat(cal.status()).isEqualTo(200);
        assertThat(cal.data().path("bars").toString()).contains(id);
        assertThat(cal.data().path("availability").size()).isEqualTo(7);
        assertThat(cal.data().path("groups").size()).isGreaterThanOrEqualTo(3);

        Res byRef = get("/bookings/ref/AURELIA:" + longer.data().path("bookingRef").asText(), reception());
        assertThat(byRef.data().path("id").asText()).isEqualTo(id);
    }

    @Test
    @DisplayName("TC-CD-01 Kiểm tra trùng lịch trả xung đột và gợi ý phòng trống")
    void checkConflict() {
        LocalDate in = today().plusDays(42);
        okData(staffBooking("207", in, in.plusDays(2)));
        Res r = post("/bookings/check-conflict", reception(), json("roomId", roomId("207").toString(),
                "checkIn", in.plusDays(1).toString(), "checkOut", in.plusDays(3).toString()));
        assertThat(r.data().path("conflict").asBoolean()).isTrue();
        assertThat(r.data().path("conflicts").size()).isEqualTo(1);
        assertThat(r.data().path("suggestions").size()).isPositive();
        Res free = post("/bookings/check-conflict", reception(), json("roomId", roomId("207").toString(),
                "checkIn", in.plusDays(2).toString(), "checkOut", in.plusDays(4).toString()));
        assertThat(free.data().path("conflict").asBoolean()).as("trả phòng và nhận phòng cùng ngày không trùng")
                .isFalse();
        Res dup = staffBooking("207", in.plusDays(1), in.plusDays(3));
        assertThat(dup.status()).isEqualTo(409);
        assertThat(dup.errorCode()).isEqualTo("BOOKING_CONFLICT");
    }

    @Test
    @DisplayName("TC-BK-04 Khách tự đặt online: xác nhận ngay, email xác nhận, thấy trong Đặt phòng của tôi")
    void guestOnlineBooking() {
        String email = "online-" + java.util.UUID.randomUUID().toString().substring(0, 8) + "@test.vn";
        String guest = post("/auth/register", null, json("fullName", "Lê Thu Hà", "email", email, "phone",
                "0905123456", "password", "ThuHa2026")).data().path("accessToken").asText();
        LocalDate in = today().plusDays(46);
        Res r = post("/bookings", guest, json("roomTypeId", DELUXE, "planCode", "CP", "checkIn", in.toString(),
                "checkOut", in.plusDays(2).toString(), "adults", 2, "specialRequests", "Tầng cao"));
        assertThat(r.status()).as(r.toString()).isEqualTo(201);
        assertThat(r.data().path("status").asText()).isEqualTo("CONFIRMED");
        assertThat(r.data().path("channelCode").asText()).isEqualTo("DIRECT");
        assertThat(r.data().path("qrPayload").asText()).startsWith("AURELIA:BK-");
        var mail = awaitMailTo(email);
        assertThat(mail.getSubject()).contains(r.data().path("bookingRef").asText());
        assertThat(mail.getText()).contains("Deluxe Ocean").contains("Lê Thu Hà");

        Res mine = get("/me/bookings?tab=upcoming", guest);
        assertThat(mine.data().size()).isEqualTo(1);
        Res otherGuest = get("/bookings/" + r.data().path("id").asText(), newGuest());
        assertThat(otherGuest.status()).as("khách khác không xem được").isEqualTo(404);

        Res selfDiscount = post("/bookings", guest, json("roomTypeId", DELUXE, "planCode", "CP", "checkIn",
                in.toString(), "checkOut", in.plusDays(1).toString(), "adults", 2, "discountPercent", 5));
        assertThat(selfDiscount.status()).isEqualTo(403);
        Res tooMany = post("/bookings", guest, json("roomTypeId", DELUXE, "planCode", "CP", "checkIn", in.toString(),
                "checkOut", in.plusDays(1).toString(), "adults", 2, "children", 1));
        assertThat(tooMany.errorCode()).isEqualTo("OCCUPANCY_EXCEEDED");
    }

    @Test
    @DisplayName("TC-BK-05 BR-09: lễ tân giảm tối đa 10%, Admin được giảm hơn")
    void discountLimit() {
        LocalDate in = today().plusDays(50);
        Res over = staffBooking("208", in, in.plusDays(1), "discountPercent", 15);
        assertThat(over.status()).isEqualTo(403);
        assertThat(over.errorCode()).isEqualTo("DISCOUNT_LIMIT_EXCEEDED");
        Res ok = staffBooking("208", in, in.plusDays(1), "discountPercent", 10);
        JsonNode d = okData(ok);
        assertThat(d.path("discountAmount").asLong()).isEqualTo(Math.round(d.path("roomAmount").asLong() * 0.10));
    }

    @Test
    @DisplayName("TC-BK-06 Kênh OTA tính hoa hồng 15% trên tiền phòng sau giảm")
    void otaCommission() {
        LocalDate in = today().plusDays(54);
        JsonNode d = okData(staffBooking("209", in, in.plusDays(2), "channelCode", "OTA"));
        long subtotal = d.path("roomAmount").asLong() - d.path("discountAmount").asLong();
        assertThat(d.path("commissionAmount").asLong()).isEqualTo(Math.round(subtotal * 0.15));
    }
}
