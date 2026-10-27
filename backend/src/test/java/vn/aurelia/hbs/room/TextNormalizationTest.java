package vn.aurelia.hbs.room;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

@DisplayName("Sinh slug tiếng Việt")
class TextNormalizationTest {
    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource({"Phòng Đôi Hướng Biển, phong-doi-huong-bien", "Luxury Suite, luxury-suite",
            "'  Deluxe  Ocean!! ', deluxe-ocean", "Căn hộ 2 phòng ngủ, can-ho-2-phong-ngu"})
    void slug(String in, String out) {
        assertThat(RoomTypeService.slugify(in)).isEqualTo(out);
    }
}
