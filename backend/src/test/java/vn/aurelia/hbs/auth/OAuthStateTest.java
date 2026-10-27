package vn.aurelia.hbs.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import vn.aurelia.hbs.common.ApiException;
import vn.aurelia.hbs.config.AppProperties;

class OAuthStateTest {
    private final AppProperties props = new AppProperties("Asia/Ho_Chi_Minh", "http://localhost:5173",
            "http://localhost:8080", "*", "a@b.c",
            new AppProperties.Jwt("test-secret-test-secret-test-secret-123", 15, 7), null, null,
            new AppProperties.OAuth("google-client.apps.googleusercontent.com", "secret", "vn.aurelia.web"),
            null, null, null);
    private final OAuthService oauth = new OAuthService(props, null, null, null, new ObjectMapper(),
            RestClient.builder(), Clock.systemUTC());

    @Test
    void stateIsSignedAndBoundToProvider() {
        String url = oauth.authorizeUrl(OAuthService.GOOGLE, "/my-bookings");
        String state = java.net.URLDecoder.decode(url.replaceAll(".*[?&]state=([^&]+).*", "$1"),
                java.nio.charset.StandardCharsets.UTF_8);
        OAuthService.State st = oauth.verifyState(state, OAuthService.GOOGLE);
        assertThat(st.returnTo()).isEqualTo("/my-bookings");
        assertThat(url).contains("nonce=" + st.nonce());
        assertThatThrownBy(() -> oauth.verifyState(state, OAuthService.APPLE)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> oauth.verifyState(state.substring(0, state.length() - 2) + "xx", OAuthService.GOOGLE))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void returnToOnlyAllowsLocalPaths() {
        assertThat(OAuthService.safeReturnTo("/rooms/luxury-suite")).isEqualTo("/rooms/luxury-suite");
        assertThat(OAuthService.safeReturnTo("https://evil.example")).isEqualTo("/");
        assertThat(OAuthService.safeReturnTo("//evil.example")).isEqualTo("/");
        assertThat(OAuthService.safeReturnTo(null)).isEqualTo("/");
    }
}
