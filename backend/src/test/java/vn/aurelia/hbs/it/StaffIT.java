package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/** STAFF-01–04, BR-13. */
@DisplayName("Nhân viên (STAFF)")
class StaffIT extends AbstractIntegrationTest {

    @Test
    @DisplayName("TC-STAFF-01 Admin tạo lễ tân: email mật khẩu tạm, đăng nhập được, bắt đổi mật khẩu")
    void createReceptionist() {
        String email = "letan-" + UUID.randomUUID().toString().substring(0, 6) + "@aureliaresort.vn";
        Res r = post("/staff", admin(), json("fullName", "Võ Thị Hạnh", "email", email, "phone", "0905999888",
                "role", "RECEPTIONIST"));
        assertThat(r.status()).as(r.toString()).isEqualTo(201);
        assertThat(r.data().path("mustChangePassword").asBoolean()).isTrue();

        var mail = awaitMailTo(email);
        Matcher m = Pattern.compile("Mật khẩu tạm: (\\S+)").matcher(mail.getText());
        assertThat(m.find()).isTrue();
        Res login = post("/auth/login", null, json("email", email, "password", m.group(1)));
        assertThat(login.status()).isEqualTo(200);
        assertThat(login.data().path("user").path("mustChangePassword").asBoolean()).isTrue();
        String t = login.data().path("accessToken").asText();
        assertThat(get("/bookings", t).status()).isEqualTo(200);
        assertThat(get("/staff", t).status()).isEqualTo(403);
    }

    @Test
    @DisplayName("TC-STAFF-02 Khóa nhân viên: không đăng nhập được, refresh token bị thu hồi; mở khóa lại được")
    void deactivate() {
        String email = "khoa-" + UUID.randomUUID().toString().substring(0, 6) + "@aureliaresort.vn";
        String id = okData(post("/staff", admin(), json("fullName", "Nhân Viên Tạm", "email", email))).path("id").asText();
        String pw = Pattern.compile("Mật khẩu tạm: (\\S+)").matcher(awaitMailTo(email).getText()).results()
                .findFirst().orElseThrow().group(1);
        String refresh = post("/auth/login", null, json("email", email, "password", pw)).data().path("refreshToken")
                .asText();

        assertThat(patch("/staff/" + id + "/status", admin(), json("active", false)).data().path("active").asBoolean())
                .isFalse();
        assertThat(post("/auth/login", null, json("email", email, "password", pw)).errorCode()).isEqualTo("ACCOUNT_LOCKED");
        assertThat(post("/auth/refresh", null, json("refreshToken", refresh)).status()).isEqualTo(401);

        okData(patch("/staff/" + id + "/status", admin(), json("active", true)));
        assertThat(post("/auth/login", null, json("email", email, "password", pw)).status()).isEqualTo(200);
    }

    @Test
    @DisplayName("TC-STAFF-03 BR-13: không khóa, không hạ quyền Admin cuối cùng")
    void lastAdmin() {
        String adminId = jdbc.queryForObject("select id::text from users where email = ?", String.class, ADMIN);
        Integer admins = jdbc.queryForObject("select count(*) from users where role = 'ADMIN' and is_active",
                Integer.class);
        org.junit.jupiter.api.Assumptions.assumeTrue(admins != null && admins == 1, "chỉ đúng khi có 1 admin");
        Res lock = patch("/staff/" + adminId + "/status", admin(), json("active", false));
        assertThat(lock.status()).isEqualTo(409);
        assertThat(lock.errorCode()).isEqualTo("LAST_ADMIN");
        Res demote = put("/staff/" + adminId, admin(), json("role", "RECEPTIONIST"));
        assertThat(demote.errorCode()).isEqualTo("LAST_ADMIN");
    }

    @Test
    @DisplayName("TC-STAFF-04 Không tạo nhân viên với vai trò GUEST hoặc email trùng")
    void invalidStaff() {
        assertThat(post("/staff", admin(), json("fullName", "X", "email", "x-" + UUID.randomUUID() + "@a.vn", "role",
                "GUEST")).status()).isEqualTo(400);
        assertThat(post("/staff", admin(), json("fullName", "X", "email", RECEPTION)).errorCode())
                .isEqualTo("EMAIL_EXISTS");
    }
}
