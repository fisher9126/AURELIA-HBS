package vn.aurelia.hbs.staff;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.aurelia.hbs.auth.AuthTokenRepository;
import vn.aurelia.hbs.auth.TokenType;
import vn.aurelia.hbs.common.ApiException;
import vn.aurelia.hbs.common.AuditService;
import vn.aurelia.hbs.common.ErrorCode;
import vn.aurelia.hbs.notification.EmailService;
import vn.aurelia.hbs.support.SecurityTestUtil;
import vn.aurelia.hbs.user.Role;
import vn.aurelia.hbs.user.User;
import vn.aurelia.hbs.user.UserRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("StaffService – BR-13 và tài khoản nhân viên")
class StaffServiceTest {
    @Mock UserRepository users;
    @Mock AuthTokenRepository tokens;
    @Mock PasswordEncoder encoder;
    @Mock EmailService email;
    @Mock AuditService audit;

    StaffService service;
    User admin;

    @BeforeEach
    void setUp() {
        SecurityTestUtil.loginAs(Role.ADMIN);
        service = new StaffService(users, tokens, encoder, email, audit, Clock.systemUTC());
        admin = new User();
        admin.setId(UUID.randomUUID());
        admin.setRole(Role.ADMIN);
        admin.setActive(true);
        admin.setFullName("Admin");
        admin.setEmail("a@x.vn");
        admin.setPropertyId(SecurityTestUtil.PROPERTY);
        lenient().when(users.findById(admin.getId())).thenReturn(Optional.of(admin));
    }

    @AfterEach
    void tearDown() {
        SecurityTestUtil.clear();
    }

    @Test
    @DisplayName("Không khóa Admin cuối cùng")
    void cannotDeactivateLastAdmin() {
        when(users.countByRoleAndActiveTrue(Role.ADMIN)).thenReturn(1L);
        assertThatThrownBy(() -> service.setStatus(admin.getId(), new StaffService.StatusInput(false, null)))
                .extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.LAST_ADMIN);
        assertThat(admin.isActive()).isTrue();
        verify(tokens, never()).revokeAll(any(), any(), any());
    }

    @Test
    @DisplayName("Còn Admin khác thì khóa được và thu hồi refresh token")
    void deactivateWhenAnotherAdminExists() {
        when(users.countByRoleAndActiveTrue(Role.ADMIN)).thenReturn(2L);
        service.setStatus(admin.getId(), new StaffService.StatusInput(false, null));
        assertThat(admin.isActive()).isFalse();
        verify(tokens).revokeAll(eq(admin.getId()), eq(TokenType.REFRESH), any());
    }

    @Test
    @DisplayName("Không hạ quyền Admin cuối cùng")
    void cannotDemoteLastAdmin() {
        when(users.countByRoleAndActiveTrue(Role.ADMIN)).thenReturn(1L);
        assertThatThrownBy(() -> service.update(admin.getId(),
                new StaffService.StaffInput(null, null, null, Role.RECEPTIONIST)))
                .extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.LAST_ADMIN);
    }

    @Test
    @DisplayName("Mở khóa xóa số lần sai và thời hạn khóa")
    void unlock() {
        admin.setFailedLoginCount(4);
        admin.setLockedUntil(java.time.OffsetDateTime.now().plusMinutes(10));
        var view = service.setStatus(admin.getId(), new StaffService.StatusInput(null, true));
        assertThat(admin.getFailedLoginCount()).isZero();
        assertThat(view.locked()).isFalse();
    }

    @RepeatedTest(20)
    @DisplayName("Mật khẩu tạm luôn đủ chữ hoa, chữ thường, số, ký tự đặc biệt")
    void tempPasswordStrength() {
        String p = StaffService.tempPassword();
        assertThat(p).hasSize(12).matches(".*[A-Z].*").matches(".*[a-z].*").matches(".*\\d.*").contains("@");
        assertThat(p).matches(vn.aurelia.hbs.auth.AuthDtos.PASSWORD_RULE);
    }

    @Test
    @DisplayName("Tạo nhân viên gửi email mật khẩu tạm, không lưu mật khẩu thô")
    void createSendsTempPassword() {
        when(users.existsByEmailIgnoreCase("moi@aurelia.vn")).thenReturn(false);
        when(encoder.encode(anyString())).thenReturn("$2a$10$hash");
        when(users.save(any())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });
        var v = service.create(new StaffService.StaffInput("Nhân Viên Mới", "Moi@Aurelia.vn", null, null));
        assertThat(v.role()).isEqualTo(Role.RECEPTIONIST);
        assertThat(v.email()).isEqualTo("moi@aurelia.vn");
        verify(email).sendStaffWelcome(eq("moi@aurelia.vn"), eq("Nhân Viên Mới"), eq("RECEPTIONIST"), anyString());
    }
}
