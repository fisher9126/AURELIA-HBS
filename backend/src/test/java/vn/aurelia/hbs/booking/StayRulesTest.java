package vn.aurelia.hbs.booking;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import vn.aurelia.hbs.common.ApiException;
import vn.aurelia.hbs.room.RoomType;

class StayRulesTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 22);

    @Test
    void validStay() {
        assertThatCode(() -> StayRules.checkDates(TODAY, TODAY.plusDays(30), TODAY)).doesNotThrowAnyException();
    }

    @Test
    void rejectsPastTooLongAndEmptyStays() {
        assertThatThrownBy(() -> StayRules.checkDates(TODAY.minusDays(1), TODAY.plusDays(1), TODAY))
                .isInstanceOf(ApiException.class).hasMessageContaining("quá khứ");
        assertThatThrownBy(() -> StayRules.checkDates(TODAY, TODAY.plusDays(31), TODAY))
                .isInstanceOf(ApiException.class).hasMessageContaining("30");
        assertThatThrownBy(() -> StayRules.checkDates(TODAY, TODAY, TODAY)).isInstanceOf(ApiException.class);
    }

    @Test
    void occupancyLimits() {
        RoomType t = new RoomType();
        t.setName("Deluxe Ocean");
        t.setMaxAdults(2);
        t.setMaxChildren(0);
        assertThatCode(() -> StayRules.checkOccupancy(t, 2, 0)).doesNotThrowAnyException();
        assertThatThrownBy(() -> StayRules.checkOccupancy(t, 2, 1)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> StayRules.checkOccupancy(t, 3, 0)).isInstanceOf(ApiException.class);
    }
}
