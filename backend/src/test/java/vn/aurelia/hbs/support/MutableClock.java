package vn.aurelia.hbs.support;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** Đồng hồ điều khiển được trong test: mặc định chạy theo giờ thật, có thể "đóng băng" tại một thời điểm. */
public class MutableClock extends Clock {
    public static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private volatile Instant fixed;

    @Override
    public ZoneId getZone() {
        return VN;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return this;
    }

    @Override
    public Instant instant() {
        Instant f = fixed;
        return f != null ? f : Instant.now();
    }

    public void setTo(LocalDateTime localVn) {
        this.fixed = localVn.atZone(VN).toInstant();
    }

    public void advance(Duration d) {
        this.fixed = instant().plus(d);
    }

    public void reset() {
        this.fixed = null;
    }

    public LocalDate today() {
        return LocalDate.now(this);
    }
}
