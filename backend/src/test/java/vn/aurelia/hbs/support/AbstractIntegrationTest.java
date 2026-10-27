package vn.aurelia.hbs.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;
import vn.aurelia.hbs.storage.StorageService;

/**
 * Nền cho integration test: một PostgreSQL 16 và một Redis 7 thật (Testcontainers) dùng chung cho cả lượt chạy,
 * Flyway nạp schema + dữ liệu mẫu như production. Email và MinIO được mock.
 * Các test dùng phòng và khoảng ngày riêng để không giẫm lên nhau.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(AbstractIntegrationTest.TestClockConfig.class)
public abstract class AbstractIntegrationTest {
    public static final String ADMIN = "admin@aureliaresort.vn";
    public static final String ADMIN_PW = "Admin@123";
    public static final String RECEPTION = "letan@aureliaresort.vn";
    public static final String RECEPTION_PW = "Letan@123";
    public static final String GUEST = "nguyenvana@gmail.com";
    public static final String GUEST_PW = "Guest@123";
    public static final String LUXURY = "00000000-0000-0000-0000-0000000000c1";
    public static final String DELUXE = "00000000-0000-0000-0000-0000000000c2";
    public static final String STANDARD = "00000000-0000-0000-0000-0000000000c3";

    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"))
            .withDatabaseName("aurelia").withUsername("aurelia").withPassword("aurelia_test");

    @SuppressWarnings("resource")
    static final GenericContainer<?> REDIS = new GenericContainer<>(DockerImageName.parse("redis:7.4-alpine"))
            .withExposedPorts(6379);

    static {
        POSTGRES.start();
        REDIS.start();
    }

    @DynamicPropertySource
    static void containers(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
        r.add("spring.data.redis.host", REDIS::getHost);
        r.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    }

    @TestConfiguration
    public static class TestClockConfig {
        @Bean
        @Primary
        public MutableClock testClock() {
            return new MutableClock();
        }
    }

    private record CachedToken(String token, long at) {}

    /** Access token sống 15 phút; cache 10 phút để cả bộ test không phải đăng nhập lại liên tục. */
    private static final Map<String, CachedToken> TOKENS = new ConcurrentHashMap<>();

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper mapper;

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    protected MutableClock clock;

    @MockBean
    protected JavaMailSender mailSender;

    @MockBean
    protected StorageService storage;

    @AfterEach
    void resetClock() {
        clock.reset();
    }

    // ------------------------------------------------------------------ HTTP

    public record Res(int status, JsonNode body, MvcResult raw) {
        public JsonNode data() {
            return body.path("data");
        }

        public String errorCode() {
            return body.path("error").path("code").asText(null);
        }

        @Override
        public String toString() {
            return status + " " + body;
        }
    }

    protected Res call(HttpMethod method, String path, String token, Object body, String... headers) {
        try {
            MockHttpServletRequestBuilder req = request(method, "/api/v1" + path).accept(MediaType.APPLICATION_JSON);
            if (token != null) {
                req.header("Authorization", "Bearer " + token);
            }
            for (int i = 0; i + 1 < headers.length; i += 2) {
                req.header(headers[i], headers[i + 1]);
            }
            if (body != null) {
                req.contentType(MediaType.APPLICATION_JSON)
                        .content(body instanceof String s ? s : mapper.writeValueAsString(body));
            }
            MvcResult r = mvc.perform(req).andReturn();
            String text = r.getResponse().getContentAsString(StandardCharsets.UTF_8);
            JsonNode json = text.isBlank() || !text.trim().startsWith("{") && !text.trim().startsWith("[")
                    ? mapper.createObjectNode() : mapper.readTree(text);
            return new Res(r.getResponse().getStatus(), json, r);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    protected Res get(String path, String token) {
        return call(HttpMethod.GET, path, token, null);
    }

    protected Res post(String path, String token, Object body, String... headers) {
        return call(HttpMethod.POST, path, token, body, headers);
    }

    protected Res put(String path, String token, Object body) {
        return call(HttpMethod.PUT, path, token, body);
    }

    protected Res patch(String path, String token, Object body) {
        return call(HttpMethod.PATCH, path, token, body);
    }

    protected Res delete(String path, String token) {
        return call(HttpMethod.DELETE, path, token, null);
    }

    /** JSON gọn: json("a", 1, "b", "x"). Giữ thứ tự, cho phép giá trị null. */
    protected static Map<String, Object> json(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    // ------------------------------------------------------------------ Dữ liệu

    protected String token(String email, String password) {
        CachedToken c = TOKENS.get(email);
        if (c != null && System.currentTimeMillis() - c.at() < 10 * 60_000) {
            return c.token();
        }
        Res r = post("/auth/login", null, json("email", email, "password", password));
        if (r.status() != 200) {
            throw new IllegalStateException("Đăng nhập " + email + " lỗi: " + r);
        }
        String t = r.data().path("accessToken").asText();
        TOKENS.put(email, new CachedToken(t, System.currentTimeMillis()));
        return t;
    }

    protected String admin() {
        return token(ADMIN, ADMIN_PW);
    }

    protected String reception() {
        return token(RECEPTION, RECEPTION_PW);
    }

    protected String seededGuest() {
        return token(GUEST, GUEST_PW);
    }

    /** Khách mới đăng ký, mỗi lần gọi một tài khoản riêng. Trả access token. */
    protected String newGuest() {
        String email = "guest-" + UUID.randomUUID().toString().substring(0, 8) + "@test.vn";
        Res r = post("/auth/register", null, json("fullName", "Khách Kiểm Thử", "email", email, "phone", "0900000000",
                "password", "Matkhau123"));
        if (r.status() != 201) {
            throw new IllegalStateException("Đăng ký lỗi: " + r);
        }
        return r.data().path("accessToken").asText();
    }

    protected UUID roomId(String roomNumber) {
        return jdbc.queryForObject("select id from rooms where room_number = ?", UUID.class, roomNumber);
    }

    protected String roomStatus(String roomNumber) {
        return jdbc.queryForObject("select status from rooms where room_number = ?", String.class, roomNumber);
    }

    protected LocalDate today() {
        return clock.today();
    }

    /** Lễ tân đặt một phòng cụ thể cho khách vãng lai. */
    protected Res staffBooking(String roomNumber, LocalDate in, LocalDate out, Object... extra) {
        Map<String, Object> body = json("roomId", roomId(roomNumber).toString(), "planCode", "EP",
                "checkIn", in.toString(), "checkOut", out.toString(), "adults", 2,
                "guest", json("fullName", "Khách Quầy " + roomNumber, "phone", "0911" + roomNumber + "000"));
        body.putAll(json(extra));
        return post("/bookings", reception(), body);
    }

    /** Chờ (tối đa 10 giây, vì email gửi @Async) tới khi có thư gửi tới địa chỉ này; trả thư mới nhất. */
    protected org.springframework.mail.SimpleMailMessage awaitMailTo(String email) {
        java.util.concurrent.atomic.AtomicReference<org.springframework.mail.SimpleMailMessage> found =
                new java.util.concurrent.atomic.AtomicReference<>();
        org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(10)).until(() -> {
            for (var inv : org.mockito.Mockito.mockingDetails(mailSender).getInvocations()) {
                for (Object arg : inv.getArguments()) {
                    if (arg instanceof org.springframework.mail.SimpleMailMessage m && m.getTo() != null
                            && java.util.Arrays.asList(m.getTo()).contains(email)) {
                        found.set(m);
                    }
                }
            }
            return found.get() != null;
        });
        return found.get();
    }

    protected JsonNode okData(Res r) {
        if (r.status() < 200 || r.status() >= 300) {
            throw new AssertionError("Mong đợi 2xx nhưng nhận " + r);
        }
        return r.data();
    }
}
