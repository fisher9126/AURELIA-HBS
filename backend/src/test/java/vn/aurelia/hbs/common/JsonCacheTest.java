package vn.aurelia.hbs.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import vn.aurelia.hbs.config.AppProperties;

@ExtendWith(MockitoExtension.class)
@DisplayName("JsonCache – cache Redis fail-open")
class JsonCacheTest {
    @Mock StringRedisTemplate redis;
    @Mock ValueOperations<String, String> ops;

    record Item(String name, LocalDate date, List<Integer> values) {}

    private JsonCache cache(boolean enabled) {
        AppProperties props = new AppProperties("Asia/Ho_Chi_Minh", null, null, null, null, null, null, null, null,
                null, null, new AppProperties.Cache(enabled, 60, 600));
        return new JsonCache(redis, new ObjectMapper().registerModule(new JavaTimeModule()), props);
    }

    @Test
    @DisplayName("Trúng cache thì không gọi loader, đọc đúng kiểu kể cả record lồng List")
    void hit() throws Exception {
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.get("k")).thenReturn("{\"name\":\"a\",\"date\":\"2026-10-24\",\"values\":[1,2]}");
        AtomicInteger calls = new AtomicInteger();
        Item v = cache(true).get("k", Duration.ofSeconds(60), Item.class, () -> {
            calls.incrementAndGet();
            return null;
        });
        assertThat(v).isEqualTo(new Item("a", LocalDate.of(2026, 10, 24), List.of(1, 2)));
        assertThat(calls).hasValue(0);
    }

    @Test
    @DisplayName("Trượt cache thì gọi loader và ghi lại với TTL")
    void missWrites() {
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.get("k")).thenReturn(null);
        Item v = cache(true).get("k", Duration.ofSeconds(60), Item.class,
                () -> new Item("b", LocalDate.of(2026, 1, 1), List.of()));
        assertThat(v.name()).isEqualTo("b");
        verify(ops).set(org.mockito.ArgumentMatchers.eq("k"), anyString(),
                org.mockito.ArgumentMatchers.eq(Duration.ofSeconds(60)));
    }

    @Test
    @DisplayName("Redis sập: vẫn trả dữ liệu từ loader, không ném lỗi")
    void redisDown() {
        when(redis.opsForValue()).thenThrow(new RedisConnectionFailureException("down"));
        Item v = cache(true).get("k", Duration.ofSeconds(60), Item.class,
                () -> new Item("c", LocalDate.of(2026, 1, 1), List.of(3)));
        assertThat(v.values()).containsExactly(3);
    }

    @Test
    @DisplayName("Tắt cache thì không chạm Redis")
    void disabled() {
        Item v = cache(false).get("k", Duration.ofSeconds(60), Item.class, () -> new Item("d", null, List.of()));
        assertThat(v.name()).isEqualTo("d");
        verify(redis, never()).opsForValue();
        cache(false).evictPrefix("avail:");
        verify(redis, never()).scan(any());
    }
}
