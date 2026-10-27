package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/** NFR bảo mật: chặn dò mật khẩu bằng giới hạn tần suất theo IP (Redis). Context riêng với giới hạn 3/phút. */
@TestPropertySource(properties = "app.security.login-per-minute=3")
@DisplayName("Giới hạn tần suất")
class RateLimitIT extends AbstractIntegrationTest {

    @Test
    @DisplayName("TC-SEC-05 Lần gọi thứ 4 trong 1 phút từ cùng IP trả 429; IP khác không bị ảnh hưởng")
    void loginRateLimited() {
        String ip = "198.51.100." + (int) (Math.random() * 250);
        Object body = json("email", "khongco-" + UUID.randomUUID() + "@test.vn", "password", "Sai123456");
        for (int i = 0; i < 3; i++) {
            assertThat(post("/auth/login", null, body, "X-Forwarded-For", ip).status()).isEqualTo(401);
        }
        Res blocked = post("/auth/login", null, body, "X-Forwarded-For", ip);
        assertThat(blocked.status()).isEqualTo(429);
        assertThat(blocked.errorCode()).isEqualTo("RATE_LIMIT_EXCEEDED");
        assertThat(blocked.raw().getResponse().getHeader("Retry-After")).isEqualTo("60");
        assertThat(post("/auth/login", null, body, "X-Forwarded-For", "203.0.113.77").status()).isEqualTo(401);
        // endpoint không thuộc diện giới hạn
        assertThat(get("/room-types", null).status()).isEqualTo(200);
    }
}
