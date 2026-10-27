package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/**
 * Ma trận phân quyền SRS 3.3 (P công khai, G khách, R lễ tân, A admin).
 * Mỗi dòng: phương thức, endpoint, vai trò, mã HTTP mong đợi. 401 = chưa đăng nhập, 403 = không đủ quyền.
 */
@DisplayName("Ma trận phân quyền (RBAC)")
class SecurityMatrixIT extends AbstractIntegrationTest {

    @ParameterizedTest(name = "{0} {1} với {2} → {3}")
    @CsvSource({
            // công khai
            "GET, /room-types, ANON, 200",
            "GET, /room-types/luxury-suite, ANON, 200",
            "GET, /amenities, ANON, 200",
            "GET, /settings, ANON, 200",
            "GET, /cancellation-tiers, ANON, 200",
            "GET, /endpoint-khong-ton-tai, ANON, 401",
            // phòng, buồng phòng
            "GET, /rooms, ANON, 401",
            "GET, /rooms, GUEST, 403",
            "GET, /rooms, RECEPTION, 200",
            "GET, /rooms/board, RECEPTION, 200",
            "GET, /housekeeping/tasks, GUEST, 403",
            "GET, /housekeeping/tasks, RECEPTION, 200",
            // đặt phòng
            "GET, /bookings, GUEST, 403",
            "GET, /bookings, RECEPTION, 200",
            "GET, /bookings/today, RECEPTION, 200",
            "GET, /bookings/calendar, GUEST, 403",
            "GET, /me/bookings, GUEST, 200",
            "GET, /me/bookings, RECEPTION, 403",
            "GET, /me/bookings, ANON, 401",
            // khách hàng
            "GET, /guests, GUEST, 403",
            "GET, /guests, RECEPTION, 200",
            // dashboard và báo cáo
            "GET, /dashboard/summary, RECEPTION, 200",
            "GET, /dashboard/kpis, RECEPTION, 403",
            "GET, /dashboard/kpis, ADMIN, 200",
            "GET, /dashboard/booking-sources, ADMIN, 200",
            "GET, /reports/adr-revpar, RECEPTION, 403",
            "GET, /reports/adr-revpar, ADMIN, 200",
            // quản trị
            "GET, /staff, RECEPTION, 403",
            "GET, /staff, ADMIN, 200",
            "GET, /audit-logs, RECEPTION, 403",
            "GET, /audit-logs, ADMIN, 200",
            "GET, /seasonal-rules, RECEPTION, 403",
            "GET, /seasonal-rules, ADMIN, 200",
            "GET, /promotions, RECEPTION, 403",
            "GET, /promotions, ADMIN, 200",
            "GET, /channels, GUEST, 403",
            "GET, /channels, RECEPTION, 200",
            "PUT, /settings, RECEPTION, 403",
            "PUT, /cancellation-tiers, RECEPTION, 403",
            "POST, /rooms, RECEPTION, 403",
            "POST, /room-types, RECEPTION, 403",
            "DELETE, /room-types/00000000-0000-0000-0000-0000000000c1, RECEPTION, 403",
            "POST, /staff, RECEPTION, 403",
            "GET, /search?q=BK, GUEST, 403",
            "GET, /search?q=BK, RECEPTION, 200"
    })
    @DisplayName("TC-SEC-01 Ma trận phân quyền theo vai trò (45 trường hợp)")
    void matrix(String method, String path, String role, int expected) {
        String token = switch (role) {
            case "GUEST" -> seededGuest();
            case "RECEPTION" -> reception();
            case "ADMIN" -> admin();
            default -> null;
        };
        HttpMethod m = HttpMethod.valueOf(method);
        Object body = m == HttpMethod.GET || m == HttpMethod.DELETE ? null
                : path.equals("/cancellation-tiers") ? "[]" : json();
        Res r = call(m, path, token, body);
        assertThat(r.status()).as(r.toString()).isEqualTo(expected);
        if (expected == 401) {
            assertThat(r.errorCode()).isEqualTo("UNAUTHORIZED");
        }
        if (expected == 403) {
            assertThat(r.errorCode()).isEqualTo("FORBIDDEN");
        }
    }

    @Test
    @DisplayName("TC-SEC-02 Token bị sửa chữ ký bị từ chối")
    void tamperedToken() {
        String t = reception();
        String tampered = t.substring(0, t.length() - 3) + (t.endsWith("aaa") ? "bbb" : "aaa");
        assertThat(get("/rooms", tampered).status()).isEqualTo(401);
    }

    @Test
    @DisplayName("TC-SEC-03 Không lộ mật khẩu băm hay số giấy tờ đầy đủ trong danh sách khách")
    void noSensitiveLeak() {
        Res guests = get("/guests?q=Sanjay", reception());
        String body = guests.body().toString();
        assertThat(body).contains("Sanjay").doesNotContain("P1289471").contains("****9471");
        Res me = get("/auth/me", seededGuest());
        assertThat(me.body().toString()).doesNotContain("passwordHash").doesNotContain("$2a$");
    }

    @Test
    @DisplayName("TC-SEC-04 Header CORS chỉ cho origin được cấu hình")
    void cors() throws Exception {
        var allowed = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .options("/api/v1/room-types").header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andReturn().getResponse();
        assertThat(allowed.getHeader("Access-Control-Allow-Origin")).isEqualTo("http://localhost:5173");
        var denied = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .options("/api/v1/room-types").header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andReturn().getResponse();
        assertThat(denied.getStatus()).isEqualTo(403);
    }
}
