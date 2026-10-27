package vn.aurelia.hbs.guest;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Che số giấy tờ trong danh sách khách")
class MaskingTest {
    @Test
    void mask() {
        assertThat(GuestService.mask("001203004567")).isEqualTo("********4567");
        assertThat(GuestService.mask("P1289471")).isEqualTo("****9471");
        assertThat(GuestService.mask("123")).isEqualTo("123");
        assertThat(GuestService.mask(null)).isNull();
    }
}
