package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/** AUTH-01 đến AUTH-07: đăng ký, đăng nhập, khóa tài khoản, xoay vòng refresh token, quên mật khẩu. */
@DisplayName("Xác thực (AUTH)")
class AuthIT extends AbstractIntegrationTest {

    private String uniqueEmail() {
        return "auth-" + UUID.randomUUID().toString().substring(0, 8) + "@test.vn";
    }

    private Res register(String email, String password) {
        return post("/auth/register", null, json("fullName", "Phạm Minh Khoa", "email", email, "phone", "0987654321",
                "password", password));
    }

    @Test
    @DisplayName("TC-AUTH-01 Đăng ký thành công trả token, /auth/me trả đúng hồ sơ vai trò GUEST")
    void registerThenMe() {
        String email = uniqueEmail();
        Res r = register(email, "Khoa2026x");
        assertThat(r.status()).isEqualTo(201);
        assertThat(r.data().path("accessToken").asText()).isNotBlank();
        assertThat(r.raw().getResponse().getHeader("Set-Cookie")).contains("refresh_token=").contains("HttpOnly");

        Res me = get("/auth/me", r.data().path("accessToken").asText());
        assertThat(me.status()).isEqualTo(200);
        assertThat(me.data().path("email").asText()).isEqualTo(email);
        assertThat(me.data().path("role").asText()).isEqualTo("GUEST");
        Integer guests = jdbc.queryForObject("select count(*) from guests where email = ?", Integer.class, email);
        assertThat(guests).isEqualTo(1);
    }

    @Test
    @DisplayName("TC-AUTH-02 Email trùng trả 409 EMAIL_EXISTS")
    void duplicateEmail() {
        String email = uniqueEmail();
        register(email, "Khoa2026x");
        Res again = register(email.toUpperCase(), "Khoa2026x");
        assertThat(again.status()).isEqualTo(409);
        assertThat(again.errorCode()).isEqualTo("EMAIL_EXISTS");
    }

    @Test
    @DisplayName("TC-AUTH-03 Mật khẩu yếu, email sai định dạng trả 400 kèm chi tiết từng trường")
    void validation() {
        Res r = post("/auth/register", null, json("fullName", "", "email", "khong-phai-email", "phone", "09",
                "password", "abc"));
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.errorCode()).isEqualTo("VALIDATION_ERROR");
        assertThat(r.body().path("error").path("details").toString()).contains("password").contains("email")
                .contains("fullName");
    }

    @Test
    @DisplayName("TC-AUTH-04 Sai mật khẩu 5 lần thì khóa 15 phút, hết hạn khóa đăng nhập lại được")
    void lockout() {
        String email = uniqueEmail();
        register(email, "Khoa2026x");
        for (int i = 0; i < 5; i++) {
            Res bad = post("/auth/login", null, json("email", email, "password", "SaiMatKhau1"));
            assertThat(bad.status()).isEqualTo(401);
            assertThat(bad.errorCode()).isEqualTo("INVALID_CREDENTIALS");
        }
        Res locked = post("/auth/login", null, json("email", email, "password", "Khoa2026x"));
        assertThat(locked.status()).isEqualTo(403);
        assertThat(locked.errorCode()).isEqualTo("ACCOUNT_LOCKED");

        clock.advance(Duration.ofMinutes(16));
        Res ok = post("/auth/login", null, json("email", email, "password", "Khoa2026x"));
        assertThat(ok.status()).isEqualTo(200);
    }

    @Test
    @DisplayName("TC-AUTH-05 Refresh token xoay vòng; dùng lại token cũ thu hồi toàn bộ phiên")
    void refreshRotationAndReuse() {
        Res reg = register(uniqueEmail(), "Khoa2026x");
        String r1 = reg.data().path("refreshToken").asText();

        Res rot = post("/auth/refresh", null, json("refreshToken", r1));
        assertThat(rot.status()).isEqualTo(200);
        String r2 = rot.data().path("refreshToken").asText();
        assertThat(r2).isNotEqualTo(r1);

        Res reuse = post("/auth/refresh", null, json("refreshToken", r1));
        assertThat(reuse.status()).isEqualTo(401);
        // phát hiện dùng lại: r2 cũng bị thu hồi
        assertThat(post("/auth/refresh", null, json("refreshToken", r2)).status()).isEqualTo(401);
    }

    @Test
    @DisplayName("TC-AUTH-06 Đăng xuất thu hồi refresh token")
    void logout() {
        Res reg = register(uniqueEmail(), "Khoa2026x");
        String refresh = reg.data().path("refreshToken").asText();
        assertThat(post("/auth/logout", null, json("refreshToken", refresh)).status()).isEqualTo(204);
        assertThat(post("/auth/refresh", null, json("refreshToken", refresh)).status()).isEqualTo(401);
    }

    @Test
    @DisplayName("TC-AUTH-07 Quên mật khẩu gửi email, token đặt lại dùng được một lần")
    void forgotAndReset() {
        String email = uniqueEmail();
        register(email, "Khoa2026x");
        assertThat(post("/auth/forgot-password", null, json("email", email)).status()).isEqualTo(200);
        // email không tồn tại vẫn trả 200 để không lộ tài khoản
        assertThat(post("/auth/forgot-password", null, json("email", "khongco@test.vn")).status()).isEqualTo(200);

        SimpleMailMessage msg = awaitMailTo(email);
        assertThat(msg.getSubject()).contains("Đặt lại mật khẩu");
        Matcher m = Pattern.compile("token=([A-Za-z0-9_-]+)").matcher(msg.getText());
        assertThat(m.find()).isTrue();
        String token = m.group(1);

        assertThat(post("/auth/reset-password", null, json("token", token, "newPassword", "MatKhauMoi9")).status())
                .isEqualTo(204);
        assertThat(post("/auth/login", null, json("email", email, "password", "MatKhauMoi9")).status()).isEqualTo(200);
        Res reused = post("/auth/reset-password", null, json("token", token, "newPassword", "MatKhauKhac9"));
        assertThat(reused.status()).isEqualTo(410);
        assertThat(reused.errorCode()).isEqualTo("TOKEN_EXPIRED");
    }

    @Test
    @DisplayName("TC-AUTH-08 Thiếu hoặc sai token trả 401 dạng lỗi chuẩn")
    void unauthorized() {
        Res none = get("/auth/me", null);
        assertThat(none.status()).isEqualTo(401);
        assertThat(none.errorCode()).isEqualTo("UNAUTHORIZED");
        assertThat(get("/auth/me", "abc.def.ghi").status()).isEqualTo(401);
    }

    @Test
    @DisplayName("TC-AUTH-09 Đổi mật khẩu cần mật khẩu hiện tại đúng")
    void changePassword() {
        String email = uniqueEmail();
        String t = register(email, "Khoa2026x").data().path("accessToken").asText();
        Res wrong = post("/auth/change-password", t, json("currentPassword", "Sai12345", "newPassword", "Moi2026xx"));
        assertThat(wrong.status()).isEqualTo(401);
        assertThat(post("/auth/change-password", t, json("currentPassword", "Khoa2026x", "newPassword", "Moi2026xx"))
                .status()).isEqualTo(204);
        assertThat(post("/auth/login", null, json("email", email, "password", "Moi2026xx")).status()).isEqualTo(200);
    }
}
