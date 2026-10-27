package vn.aurelia.hbs.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.SQLException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import vn.aurelia.hbs.config.AppProperties;

@DisplayName("RateLimitFilter và GlobalExceptionHandler")
class RateLimitAndErrorsTest {

    @Test
    @DisplayName("Lấy IP đầu tiên trong X-Forwarded-For khi đứng sau Nginx")
    void clientIp() {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr("10.0.0.2");
        assertThat(RateLimitFilter.clientIp(req)).isEqualTo("10.0.0.2");
        req.addHeader("X-Forwarded-For", "203.0.113.9, 10.0.0.1");
        assertThat(RateLimitFilter.clientIp(req)).isEqualTo("203.0.113.9");
    }

    @Test
    @DisplayName("Vượt ngưỡng trả 429 JSON chuẩn; Redis lỗi thì cho qua")
    @SuppressWarnings("unchecked")
    void limit() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.increment(org.mockito.ArgumentMatchers.anyString())).thenReturn(11L);
        AppProperties props = new AppProperties(null, null, null, null, null, null,
                new AppProperties.Security(5, 15, 30, 10), null, null, null, null, null);
        RateLimitFilter f = new RateLimitFilter(redis, new ObjectMapper(), props);

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        MockHttpServletResponse res = new MockHttpServletResponse();
        f.doFilter(req, res, new MockFilterChain());
        assertThat(res.getStatus()).isEqualTo(429);
        assertThat(res.getContentAsString()).contains("RATE_LIMIT_EXCEEDED");

        when(ops.increment(org.mockito.ArgumentMatchers.anyString())).thenThrow(new RuntimeException("down"));
        MockHttpServletResponse ok = new MockHttpServletResponse();
        f.doFilter(new MockHttpServletRequest("POST", "/api/v1/auth/login"), ok, new MockFilterChain());
        assertThat(ok.getStatus()).isEqualTo(200);

        MockHttpServletResponse other = new MockHttpServletResponse();
        f.doFilter(new MockHttpServletRequest("GET", "/api/v1/room-types"), other, new MockFilterChain());
        assertThat(other.getStatus()).as("endpoint không giới hạn").isEqualTo(200);
    }

    @Test
    @DisplayName("Vi phạm EXCLUDE chuyển thành 409 BOOKING_CONFLICT; email trùng thành EMAIL_EXISTS")
    void integrityMapping() {
        GlobalExceptionHandler h = new GlobalExceptionHandler();
        var overlap = h.handleIntegrity(new DataIntegrityViolationException("x",
                new SQLException("conflicting key value violates exclusion constraint \"ex_bookings_no_overlap\"")));
        assertThat(overlap.getStatusCode().value()).isEqualTo(409);
        assertThat(overlap.getBody().error().code()).isEqualTo("BOOKING_CONFLICT");
        var email = h.handleIntegrity(new DataIntegrityViolationException("x",
                new SQLException("duplicate key value violates unique constraint \"users_email_key\"")));
        assertThat(email.getBody().error().code()).isEqualTo("EMAIL_EXISTS");
        var other = h.handleIntegrity(new DataIntegrityViolationException("x", new SQLException("fk")));
        assertThat(other.getBody().error().code()).isEqualTo("IN_USE");
    }

    @Test
    @DisplayName("Lỗi không lường trước trả 500 nhưng không lộ chi tiết nội bộ")
    void unexpected() {
        var r = new GlobalExceptionHandler().handleOther(new IllegalStateException("password=secret"));
        assertThat(r.getStatusCode().value()).isEqualTo(500);
        assertThat(r.getBody().error().message()).doesNotContain("secret");
    }
}
