package vn.aurelia.hbs.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.data.domain.Sort;

@DisplayName("Tiện ích chung: tiền, phân trang, HMAC")
class HelpersTest {

    @ParameterizedTest(name = "{0} × {1}% = {2}")
    @CsvSource({"5175000, 50, 2587500", "1, 50, 1", "3, 50, 2", "999999, 10, 100000", "0, 25, 0", "4500000, 0, 0"})
    @DisplayName("Money.percent làm tròn HALF_UP đến đồng")
    void percent(long amount, String pct, long expected) {
        assertThat(Money.percent(amount, new BigDecimal(pct))).isEqualTo(expected);
    }

    @Test
    @DisplayName("Money.times với hệ số mùa")
    void times() {
        assertThat(Money.times(1_500_000, new BigDecimal("1.30"))).isEqualTo(1_950_000);
        assertThat(Money.times(1_111_111, new BigDecimal("0.85"))).isEqualTo(944_444);
    }

    @Test
    @DisplayName("PageRequests: page bắt đầu từ 1, limit tối đa 100, sort snake_case có dấu trừ")
    void pageRequests() {
        var p = PageRequests.of(2, 500, "-created_at", "room_number");
        assertThat(p.getPageNumber()).isEqualTo(1);
        assertThat(p.getPageSize()).isEqualTo(100);
        assertThat(p.getSort().getOrderFor("createdAt").getDirection()).isEqualTo(Sort.Direction.DESC);
        var d = PageRequests.of(null, null, null, "room_number");
        assertThat(d.getPageNumber()).isZero();
        assertThat(d.getPageSize()).isEqualTo(20);
        assertThat(d.getSort().getOrderFor("roomNumber").getDirection()).isEqualTo(Sort.Direction.ASC);
    }

    @Test
    @DisplayName("HMAC-SHA256 khớp vector chuẩn RFC 4231 #2; so sánh hằng thời gian")
    void hmac() {
        assertThat(Hmac.sha256Hex("Jefe", "what do ya want for nothing?"))
                .isEqualTo("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
        assertThat(Hmac.equalsHex("ABCD", "abcd")).isTrue();
        assertThat(Hmac.equalsHex("abcd", "abce")).isFalse();
        assertThat(Hmac.equalsHex(null, "abcd")).isFalse();
    }
}
