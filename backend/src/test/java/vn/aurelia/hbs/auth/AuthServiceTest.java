package vn.aurelia.hbs.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.aurelia.hbs.common.ApiException;
import vn.aurelia.hbs.common.ErrorCode;
import vn.aurelia.hbs.config.AppProperties;
import vn.aurelia.hbs.guest.GuestRepository;
import vn.aurelia.hbs.notification.EmailService;
import vn.aurelia.hbs.security.JwtService;
import vn.aurelia.hbs.user.Role;
import vn.aurelia.hbs.user.User;
import vn.aurelia.hbs.user.UserRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService – khóa tài khoản, băm token")
class AuthServiceTest {
    @Mock UserRepository users;
    @Mock GuestRepository guests;
    @Mock AuthTokenRepository tokens;
    @Mock PasswordEncoder encoder;
    @Mock JwtService jwt;
    @Mock EmailService email;

    AuthService service;
    User user;
    final Clock clock = Clock.fixed(Instant.parse("2026-10-24T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));

    @BeforeEach
    void setUp() {
        AppProperties props = new AppProperties("Asia/Ho_Chi_Minh", "http://f", "http://a", "*", "m@x.vn",
                new AppProperties.Jwt("s".repeat(40), 15, 7), new AppProperties.Security(5, 15, 30, 10), null, null,
                null, null, null);
        service = new AuthService(users, guests, tokens, encoder, jwt, email, props, clock);
        user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("khach@test.vn");
        user.setFullName("Khách");
        user.setRole(Role.GUEST);
        user.setPasswordHash("$2a$10$x");
        lenient().when(users.findByEmailIgnoreCase("khach@test.vn")).thenReturn(Optional.of(user));
        lenient().when(tokens.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(jwt.createAccessToken(any())).thenReturn("access");
    }

    @Test
    @DisplayName("Lần sai thứ 5 đặt khóa 15 phút và reset bộ đếm")
    void fifthFailureLocks() {
        when(encoder.matches(anyString(), anyString())).thenReturn(false);
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> service.login(new AuthDtos.LoginRequest("khach@test.vn", "sai"), "ua", "ip"))
                    .extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.INVALID_CREDENTIALS);
        }
        assertThat(user.getLockedUntil()).isEqualTo(java.time.OffsetDateTime.now(clock).plusMinutes(15));
        assertThat(user.getFailedLoginCount()).isZero();
        assertThatThrownBy(() -> service.login(new AuthDtos.LoginRequest("khach@test.vn", "dung"), "ua", "ip"))
                .extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.ACCOUNT_LOCKED);
    }

    @Test
    @DisplayName("Đăng nhập đúng xóa bộ đếm, ghi lần đăng nhập, cấp token")
    void successResets() {
        user.setFailedLoginCount(3);
        when(encoder.matches("dung", "$2a$10$x")).thenReturn(true);
        var t = service.login(new AuthDtos.LoginRequest("khach@test.vn", "dung"), "ua", "ip");
        assertThat(t.accessToken()).isEqualTo("access");
        assertThat(t.refreshToken()).isNotBlank();
        assertThat(user.getFailedLoginCount()).isZero();
        assertThat(user.getLastLoginAt()).isNotNull();
    }

    @Test
    @DisplayName("Tài khoản đăng ký bằng Google (không có mật khẩu) không đăng nhập bằng mật khẩu")
    void oauthOnlyAccount() {
        user.setPasswordHash(null);
        assertThatThrownBy(() -> service.login(new AuthDtos.LoginRequest("khach@test.vn", "bat-ky"), "ua", "ip"))
                .extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.INVALID_CREDENTIALS);
    }

    @Test
    @DisplayName("Token lưu dạng SHA-256, không lưu thô; token ngẫu nhiên không lặp")
    void tokenHashing() {
        String raw = AuthService.randomToken();
        assertThat(raw).hasSizeGreaterThanOrEqualTo(43).isNotEqualTo(AuthService.randomToken());
        assertThat(AuthService.hash(raw)).hasSize(64).isNotEqualTo(raw).isEqualTo(AuthService.hash(raw));
    }
}
