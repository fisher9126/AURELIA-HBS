package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/** SEARCH-01–06, RT-03, SRS 13.3 công thức giá, 13.4 cache phòng trống 60 giây. */
@DisplayName("Tìm phòng và báo giá (SEARCH, RT)")
class SearchPricingIT extends AbstractIntegrationTest {
    @Autowired
    StringRedisTemplate redis;

    /** Ngày xa, ngoài mọi quy tắc mùa mẫu (chỉ có năm 2026) để giá cố định. */
    private LocalDate base() {
        return today().plusDays(400);
    }

    private String availableUrl(LocalDate in, LocalDate out, int adults, int children) {
        return "/rooms/available?checkIn=" + in + "&checkOut=" + out + "&adults=" + adults + "&children=" + children;
    }

    @Test
    @DisplayName("TC-SEARCH-01 Khách vãng lai tìm phòng trống: đủ 3 loại phòng, mỗi loại có giá từng gói")
    void availableForAnonymous() {
        LocalDate in = base();
        Res r = get(availableUrl(in, in.plusDays(2), 2, 0), null);
        assertThat(r.status()).isEqualTo(200);
        JsonNode types = r.data().path("roomTypes");
        assertThat(types.size()).isGreaterThanOrEqualTo(3);
        assertThat(types.toString()).contains(LUXURY).contains(DELUXE).contains(STANDARD);
        for (JsonNode t : types) {
            assertThat(t.path("availableCount").asInt()).isPositive();
            assertThat(t.path("plans").size()).isPositive();
            assertThat(t.has("roomIds")).as("khách không thấy id phòng cụ thể").isFalse();
        }
    }

    @Test
    @DisplayName("TC-SEARCH-02 Lọc theo sức chứa: 3 người lớn không loại phòng nào chứa được")
    void occupancyFilter() {
        LocalDate in = base();
        Res r = get(availableUrl(in, in.plusDays(2), 3, 0), null);
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.data().path("roomTypes").size()).isZero();
        Res withChild = get(availableUrl(in, in.plusDays(2), 2, 1), null);
        assertThat(withChild.data().path("roomTypes").size()).as("chỉ Luxury Suite nhận 1 trẻ em").isEqualTo(1);
    }

    @Test
    @DisplayName("TC-SEARCH-03 BR-01–03: ngày quá khứ, 0 đêm, quá 30 đêm bị từ chối")
    void dateRules() {
        LocalDate t = today();
        Res past = get(availableUrl(t.minusDays(1), t.plusDays(1), 2, 0), null);
        assertThat(past.status()).isEqualTo(422);
        assertThat(past.errorCode()).isEqualTo("PAST_DATE_BOOKING");
        assertThat(get(availableUrl(t.plusDays(5), t.plusDays(5), 2, 0), null).errorCode()).isEqualTo("INVALID_DATE_RANGE");
        assertThat(get(availableUrl(t.plusDays(5), t.plusDays(36), 2, 0), null).errorCode()).isEqualTo("STAY_TOO_LONG");
    }

    @Test
    @DisplayName("TC-PRICE-01 Ví dụ SRS 13.3: Luxury Suite gói CP 3 đêm = 5.175.000đ")
    void srsExample() {
        LocalDate in = base();
        Res q = post("/pricing/quote", null, json("roomTypeId", LUXURY, "planCode", "CP", "checkIn", in.toString(),
                "checkOut", in.plusDays(3).toString(), "adults", 2, "children", 0));
        assertThat(q.status()).isEqualTo(200);
        assertThat(q.data().path("roomAmount").asLong()).isEqualTo(4_500_000);
        assertThat(q.data().path("serviceFee").asLong()).isEqualTo(225_000);
        assertThat(q.data().path("taxAmount").asLong()).isEqualTo(450_000);
        assertThat(q.data().path("totalAmount").asLong()).isEqualTo(5_175_000);
        assertThat(q.data().path("breakdown").size()).isEqualTo(3);
    }

    @Test
    @DisplayName("TC-PRICE-02 Quy tắc mùa mới áp dụng ngay, cache phòng trống bị làm mới (BR-08, SRS 13.4)")
    void seasonalRuleAndCacheEviction() {
        LocalDate in = base().plusDays(10);
        LocalDate out = in.plusDays(2);
        String url = availableUrl(in, out, 2, 0);
        long before = luxuryEp(get(url, null));
        assertThat(before).isEqualTo(2_400_000);
        Set<String> keys = redis.keys("avail:*");
        assertThat(keys).as("kết quả đã được cache trong Redis").isNotEmpty();

        Res rule = post("/seasonal-rules", admin(), json("name", "Lễ hội test", "startDate", in.toString(),
                "endDate", in.toString(), "multiplier", 1.5, "priority", 99));
        assertThat(rule.status()).isEqualTo(201);
        try {
            long after = luxuryEp(get(url, null));
            assertThat(after).as("đêm đầu × 1,5, đêm sau giá gốc").isEqualTo(1_800_000 + 1_200_000);
        } finally {
            assertThat(delete("/seasonal-rules/" + rule.data().path("id").asText(), admin()).status()).isEqualTo(204);
        }
        assertThat(luxuryEp(get(url, null))).isEqualTo(2_400_000);
    }

    @Test
    @DisplayName("TC-PRICE-03 Hệ số mùa ngoài 0,5–3,0 bị từ chối")
    void invalidMultiplier() {
        Res r = post("/seasonal-rules", admin(), json("name", "Sai", "startDate", base().toString(),
                "endDate", base().plusDays(1).toString(), "multiplier", 3.5, "priority", 1));
        assertThat(r.status()).isEqualTo(400);
    }

    @Test
    @DisplayName("TC-SEARCH-04 Chi tiết loại phòng theo slug, kèm gói, tiện nghi")
    void detailBySlug() {
        Res r = get("/room-types/luxury-suite", null);
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.data().path("plans").size()).isEqualTo(4);
        assertThat(r.data().path("amenities").size()).isEqualTo(8);
        assertThat(get("/room-types/khong-ton-tai", null).status()).isEqualTo(404);
    }

    private static long luxuryEp(Res r) {
        for (JsonNode t : r.data().path("roomTypes")) {
            if (t.path("roomTypeId").asText().equals(LUXURY)) {
                for (JsonNode p : t.path("plans")) {
                    if (p.path("planCode").asText().equals("EP")) {
                        return p.path("roomAmount").asLong();
                    }
                }
            }
        }
        throw new AssertionError("Không thấy Luxury EP trong " + r);
    }
}
