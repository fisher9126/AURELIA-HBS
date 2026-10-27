package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/** BK-15, SET-06, BR-09: mã khuyến mãi. */
@DisplayName("Mã khuyến mãi (BK-15, SET-06)")
class PromotionIT extends AbstractIntegrationTest {

    private String createPromo(String type, long value, int maxUses, int minNights, Integer bookBeforeDays) {
        String code = "IT" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        Res r = post("/promotions", admin(), json("code", code, "description", "Mã kiểm thử", "discountType", type,
                "discountValue", value, "minNights", minNights, "bookBeforeDays", bookBeforeDays,
                "validFrom", today().toString(), "validTo", today().plusDays(365).toString(), "maxUses", maxUses));
        assertThat(r.status()).as(r.toString()).isEqualTo(201);
        return code;
    }

    private Res guestBook(String token, LocalDate in, int nights, String promo) {
        return post("/bookings", token, json("roomTypeId", STANDARD, "planCode", "EP", "checkIn", in.toString(),
                "checkOut", in.plusDays(nights).toString(), "adults", 1, "promoCode", promo));
    }

    @Test
    @DisplayName("TC-PROMO-01 Mã 20%, 1 lượt: áp dụng đúng, lượt thứ hai bị từ chối, hủy phòng trả lại lượt")
    void percentAndUsage() {
        String code = createPromo("PERCENT", 20, 1, 2, null);
        LocalDate in = today().plusDays(320);

        Res v = post("/promotions/validate", null, json("code", code.toLowerCase(), "checkIn", in.toString(),
                "checkOut", in.plusDays(2).toString(), "roomAmount", 1_400_000));
        assertThat(v.data().path("valid").asBoolean()).isTrue();
        assertThat(v.data().path("discountAmount").asLong()).isEqualTo(280_000);

        Res oneNight = guestBook(newGuest(), in, 1, code);
        assertThat(oneNight.status()).isEqualTo(400);
        assertThat(oneNight.errorCode()).isEqualTo("PROMO_INVALID");

        Res b = guestBook(newGuest(), in, 2, code);
        assertThat(b.status()).as(b.toString()).isEqualTo(201);
        JsonNode d = b.data();
        assertThat(d.path("discountAmount").asLong()).isEqualTo(Math.round(d.path("roomAmount").asLong() * 0.2));
        assertThat(d.path("promotionId").asText()).isNotBlank();
        assertThat(usedCount(code)).isEqualTo(1);

        Res second = guestBook(newGuest(), in, 2, code);
        assertThat(second.errorCode()).isEqualTo("PROMO_INVALID");

        okData(patch("/bookings/" + d.path("id").asText() + "/cancel", admin(),
                json("reason", "OTHER", "waiveFee", true)));
        assertThat(usedCount(code)).as("hủy phòng trả lại lượt").isZero();
    }

    @Test
    @DisplayName("TC-PROMO-02 Mã giảm tiền và báo giá kèm mã")
    void amountPromoInQuote() {
        String code = createPromo("AMOUNT", 300_000, 0, 1, null);
        LocalDate in = today().plusDays(324);
        Res q = post("/pricing/quote", null, json("roomTypeId", STANDARD, "planCode", "EP", "checkIn", in.toString(),
                "checkOut", in.plusDays(1).toString(), "adults", 1, "promoCode", code));
        assertThat(q.status()).as(q.toString()).isEqualTo(200);
        assertThat(q.data().path("discountAmount").asLong()).isEqualTo(300_000);
    }

    @Test
    @DisplayName("TC-PROMO-03 Early bird: đặt sát ngày bị từ chối kèm lý do")
    void earlyBird() {
        String code = createPromo("PERCENT", 15, 0, 1, 30);
        Res tooLate = post("/promotions/validate", null, json("code", code, "checkIn", today().plusDays(5).toString(),
                "checkOut", today().plusDays(6).toString()));
        assertThat(tooLate.data().path("valid").asBoolean()).isFalse();
        assertThat(tooLate.data().path("reason").asText()).contains("30 ngày");
        Res unknown = post("/promotions/validate", null, json("code", "KHONGCO"));
        assertThat(unknown.data().path("valid").asBoolean()).isFalse();
    }

    @Test
    @DisplayName("TC-PROMO-04 BR-09: không dùng chung mã với giảm giá tay; tắt mã thì không dùng được")
    void exclusiveAndDeactivate() {
        String code = createPromo("PERCENT", 10, 0, 1, null);
        LocalDate in = today().plusDays(328);
        Res both = staffBooking("110", in, in.plusDays(1), "discountPercent", 5, "promoCode", code);
        assertThat(both.errorCode()).isEqualTo("VALIDATION_ERROR");

        String id = jdbc.queryForObject("select id::text from promotions where code = ?", String.class, code);
        assertThat(delete("/promotions/" + id, admin()).status()).isEqualTo(204);
        assertThat(staffBooking("110", in, in.plusDays(1), "promoCode", code).errorCode()).isEqualTo("PROMO_INVALID");
        Res dup = post("/promotions", admin(), json("code", code, "discountType", "PERCENT", "discountValue", 5,
                "validFrom", today().toString(), "validTo", today().plusDays(1).toString()));
        assertThat(dup.status()).isEqualTo(400);
        Res over = post("/promotions", admin(), json("code", "PCT" + UUID.randomUUID().toString().substring(0, 4),
                "discountType", "PERCENT", "discountValue", 150, "validFrom", today().toString(),
                "validTo", today().plusDays(1).toString()));
        assertThat(over.status()).isEqualTo(400);
    }

    private int usedCount(String code) {
        Integer n = jdbc.queryForObject("select used_count from promotions where code = ?", Integer.class, code);
        return n == null ? -1 : n;
    }
}
