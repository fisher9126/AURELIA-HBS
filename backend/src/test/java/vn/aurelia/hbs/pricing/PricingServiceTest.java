package vn.aurelia.hbs.pricing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.aurelia.hbs.common.ApiException;
import vn.aurelia.hbs.common.ErrorCode;
import vn.aurelia.hbs.property.Property;
import vn.aurelia.hbs.room.PlanCode;
import vn.aurelia.hbs.room.RoomPlan;
import vn.aurelia.hbs.room.RoomType;

/** Kiểm tra công thức SRS 13.3 và quy tắc BR-08. */
class PricingServiceTest {
    private Property property;
    private RoomType luxury;
    private RoomPlan cp;

    @BeforeEach
    void setUp() {
        property = new Property();
        property.setVatRate(BigDecimal.TEN);
        property.setServiceRate(BigDecimal.valueOf(5));
        luxury = new RoomType();
        luxury.setId(UUID.randomUUID());
        luxury.setBasePrice(1_200_000);
        cp = new RoomPlan();
        cp.setPlanCode(PlanCode.CP);
        cp.setSurchargePerNight(300_000);
    }

    @Test
    void srsExampleWithoutSeason() {
        var q = PricingService.calculate(property, luxury, cp, LocalDate.of(2026, 1, 20), LocalDate.of(2026, 1, 23),
                BigDecimal.ZERO, List.of());
        assertThat(q.nights()).isEqualTo(3);
        assertThat(q.roomAmount()).isEqualTo(4_500_000);
        assertThat(q.serviceFee()).isEqualTo(225_000);
        assertThat(q.taxAmount()).isEqualTo(450_000);
        assertThat(q.totalAmount()).isEqualTo(5_175_000);
    }

    @Test
    void highestPriorityWinsAndTieGoesToLaterRule() {
        SeasonalRule summer = rule("2026-06-01", "2026-08-31", "1.30", 10, 1);
        SeasonalRule promo = rule("2026-08-30", "2026-09-05", "0.85", 10, 2);
        SeasonalRule low = rule("2026-08-01", "2026-09-30", "0.90", 5, 3);
        var q = PricingService.calculate(property, luxury, cp, LocalDate.of(2026, 8, 29), LocalDate.of(2026, 9, 2),
                BigDecimal.ZERO, List.of(summer, promo, low));
        assertThat(q.breakdown()).extracting(PricingService.Night::multiplier)
                .containsExactly(new BigDecimal("1.30"), new BigDecimal("0.85"), new BigDecimal("0.85"),
                        new BigDecimal("0.85"));
        assertThat(q.roomAmount()).isEqualTo(1_950_000 + 3 * 1_275_000);
    }

    @Test
    void multiplierBelowOneIsLowSeasonDiscount() {
        SeasonalRule rainy = rule("2026-10-15", "2026-12-15", "0.85", 5, 1);
        var q = PricingService.calculate(property, luxury, cp, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 2),
                BigDecimal.ZERO, List.of(rainy));
        assertThat(q.roomAmount()).isEqualTo(1_275_000);
    }

    @Test
    void ruleForOtherRoomTypeIsIgnored() {
        SeasonalRule other = rule("2026-01-01", "2026-12-31", "2.00", 99, 1);
        other.setRoomTypeIds(new UUID[] {UUID.randomUUID()});
        var q = PricingService.calculate(property, luxury, cp, LocalDate.of(2026, 1, 20), LocalDate.of(2026, 1, 21),
                BigDecimal.ZERO, List.of(other));
        assertThat(q.roomAmount()).isEqualTo(1_500_000);
    }

    @Test
    void discountAppliesBeforeServiceAndTax() {
        var q = PricingService.calculate(property, luxury, cp, LocalDate.of(2026, 1, 20), LocalDate.of(2026, 1, 23),
                BigDecimal.TEN, List.of());
        assertThat(q.discountAmount()).isEqualTo(450_000);
        assertThat(q.subtotal()).isEqualTo(4_050_000);
        assertThat(q.totalAmount()).isEqualTo(4_050_000 + 202_500 + 405_000);
    }

    @Test
    void fixedAmountPromotionIsCappedAtRoomAmount() {
        var q = PricingService.calculate(property, luxury, cp, LocalDate.of(2026, 1, 20), LocalDate.of(2026, 1, 23),
                PricingService.Discount.amount(500_000), List.of());
        assertThat(q.discountAmount()).isEqualTo(500_000);
        assertThat(q.totalAmount()).isEqualTo(4_000_000 + 200_000 + 400_000);
        var all = PricingService.calculate(property, luxury, cp, LocalDate.of(2026, 1, 20), LocalDate.of(2026, 1, 21),
                PricingService.Discount.amount(99_000_000), List.of());
        assertThat(all.totalAmount()).isZero();
    }

    @Test
    void zeroNightsRejected() {
        assertThatThrownBy(() -> PricingService.calculate(property, luxury, cp, LocalDate.of(2026, 1, 20),
                LocalDate.of(2026, 1, 20), BigDecimal.ZERO, List.of()))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getCode()).isEqualTo(ErrorCode.INVALID_DATE_RANGE));
    }

    private static SeasonalRule rule(String start, String end, String m, int priority, int minute) {
        SeasonalRule r = new SeasonalRule();
        r.setName("rule-" + minute);
        r.setStartDate(LocalDate.parse(start));
        r.setEndDate(LocalDate.parse(end));
        r.setMultiplier(new BigDecimal(m));
        r.setPriority(priority);
        r.setActive(true);
        r.setCreatedAt(OffsetDateTime.parse("2026-01-01T00:0" + minute + ":00+07:00"));
        return r;
    }
}
