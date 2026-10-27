package vn.aurelia.hbs.promotion;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class PromotionServiceTest {
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-22T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private final PromotionService service = new PromotionService(null, null, clock);

    @Test
    void earlyBirdNeedsThirtyDaysNotice() {
        Promotion p = promo(DiscountType.PERCENT, 15);
        p.setBookBeforeDays(30);
        p.setMinNights(2);
        assertThat(service.whyInvalid(p, LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 3))).isNull();
        assertThat(service.whyInvalid(p, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 3))).contains("30 ngày");
        assertThat(service.whyInvalid(p, LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 2))).contains("2 đêm");
    }

    @Test
    void stayWindowAndUsageLimit() {
        Promotion p = promo(DiscountType.AMOUNT, 500_000);
        p.setStayFrom(LocalDate.of(2026, 10, 15));
        p.setStayTo(LocalDate.of(2026, 12, 15));
        assertThat(service.whyInvalid(p, LocalDate.of(2026, 12, 13), LocalDate.of(2026, 12, 16))).isNull();
        assertThat(service.whyInvalid(p, LocalDate.of(2026, 12, 14), LocalDate.of(2026, 12, 18))).contains("khoảng");
        p.setMaxUses(5);
        p.setUsedCount(5);
        assertThat(service.whyInvalid(p, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 3))).contains("hết lượt");
    }

    @Test
    void discountShapes() {
        assertThat(PromotionService.discount(promo(DiscountType.PERCENT, 15)).amountOf(4_500_000)).isEqualTo(675_000);
        assertThat(PromotionService.discount(promo(DiscountType.AMOUNT, 500_000)).amountOf(4_500_000)).isEqualTo(500_000);
        assertThat(PromotionService.discount(promo(DiscountType.AMOUNT, 9_000_000)).amountOf(4_500_000))
                .isEqualTo(4_500_000); // không giảm quá tiền phòng
    }

    private static Promotion promo(DiscountType type, long value) {
        Promotion p = new Promotion();
        p.setCode("TEST");
        p.setDiscountType(type);
        p.setDiscountValue(value);
        p.setValidFrom(LocalDate.of(2026, 1, 1));
        p.setValidTo(LocalDate.of(2026, 12, 31));
        p.setActive(true);
        return p;
    }
}
