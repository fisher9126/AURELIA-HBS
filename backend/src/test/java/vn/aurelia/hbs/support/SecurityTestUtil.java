package vn.aurelia.hbs.support;

import java.util.List;
import java.util.UUID;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import vn.aurelia.hbs.security.UserPrincipal;
import vn.aurelia.hbs.user.Role;

/** Đặt người dùng hiện tại cho unit test service (không qua HTTP). */
public final class SecurityTestUtil {
    public static final UUID PROPERTY = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private SecurityTestUtil() {}

    public static UserPrincipal loginAs(Role role) {
        UserPrincipal p = new UserPrincipal(UUID.randomUUID(), role.name().toLowerCase() + "@test.vn", role,
                role.isStaff() ? PROPERTY : null);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(p, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
        return p;
    }

    public static void clear() {
        SecurityContextHolder.clearContext();
    }
}
