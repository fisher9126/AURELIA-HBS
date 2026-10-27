package vn.aurelia.hbs.common;

import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import vn.aurelia.hbs.config.AppProperties;

/**
 * Bộ đệm Redis dạng JSON (NFR-SC02, SRS 13.4: phòng trống cache 60 giây).
 * Lưu chuỗi JSON với kiểu đích tường minh nên không cần thông tin kiểu đa hình trong dữ liệu.
 * Redis lỗi thì bỏ qua cache và đọc thẳng CSDL (fail-open), không làm hỏng yêu cầu.
 */
@Component
public class JsonCache {
    public static final String AVAILABILITY = "avail:";
    public static final String CATALOG = "catalog:";
    public static final String SETTINGS = "settings:";

    private static final Logger log = LoggerFactory.getLogger(JsonCache.class);

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    private final AppProperties.Cache cfg;

    public JsonCache(StringRedisTemplate redis, ObjectMapper mapper, AppProperties props) {
        this.redis = redis;
        this.mapper = mapper;
        this.cfg = props.cache() == null ? new AppProperties.Cache(false, 60, 600) : props.cache();
    }

    public Duration availabilityTtl() {
        return Duration.ofSeconds(cfg.availabilitySeconds());
    }

    public Duration catalogTtl() {
        return Duration.ofSeconds(cfg.catalogSeconds());
    }

    public <T> T get(String key, Duration ttl, Class<T> type, Supplier<T> loader) {
        return get(key, ttl, mapper.constructType(type), loader);
    }

    public <T> T getList(String key, Duration ttl, Class<?> elementType, Supplier<T> loader) {
        return get(key, ttl, mapper.getTypeFactory().constructCollectionType(java.util.List.class, elementType), loader);
    }

    private <T> T get(String key, Duration ttl, JavaType type, Supplier<T> loader) {
        if (!cfg.enabled()) {
            return loader.get();
        }
        try {
            String hit = redis.opsForValue().get(key);
            if (hit != null) {
                return mapper.readValue(hit, type);
            }
        } catch (Exception e) {
            log.debug("Cache đọc lỗi {}: {}", key, e.getMessage());
        }
        T value = loader.get();
        try {
            redis.opsForValue().set(key, mapper.writeValueAsString(value), ttl);
        } catch (Exception e) {
            log.debug("Cache ghi lỗi {}: {}", key, e.getMessage());
        }
        return value;
    }

    /**
     * Xóa mọi khóa bắt đầu bằng prefix (SCAN, không chặn Redis như KEYS). Trong giao dịch thì xóa ngay
     * và xóa lại sau commit, để yêu cầu đọc chen giữa không ghi lại dữ liệu cũ vào cache.
     */
    public void evictPrefix(String... prefixes) {
        if (!cfg.enabled()) {
            return;
        }
        doEvict(prefixes);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    doEvict(prefixes);
                }
            });
        }
    }

    private void doEvict(String... prefixes) {
        for (String prefix : prefixes) {
            try {
                Set<String> keys = new HashSet<>();
                try (Cursor<String> c = redis.scan(ScanOptions.scanOptions().match(prefix + "*").count(500).build())) {
                    c.forEachRemaining(keys::add);
                }
                if (!keys.isEmpty()) {
                    redis.delete(keys);
                }
            } catch (Exception e) {
                log.debug("Cache xóa lỗi {}: {}", prefix, e.getMessage());
            }
        }
    }
}
