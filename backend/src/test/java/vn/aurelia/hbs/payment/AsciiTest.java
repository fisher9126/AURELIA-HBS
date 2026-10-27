package vn.aurelia.hbs.payment;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Nội dung chuyển khoản không dấu cho cổng thanh toán")
class AsciiTest {
    @Test
    void ascii() {
        assertThat(OnlinePaymentService.ascii("Thanh toán đặt phòng BK-20261120-1234"))
                .isEqualTo("Thanh toan dat phong BK-20261120-1234");
        assertThat(OnlinePaymentService.ascii("Đoàn #1 & bạn bè")).isEqualTo("Doan 1  ban be");
    }
}
