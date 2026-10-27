-- Idempotency-Key cho POST /bookings và POST /bookings/:id/payments (SRS 9.1).
-- Lưu khóa kèm id kết quả; gửi lại cùng khóa trong 24 giờ trả lại đúng kết quả cũ.
CREATE TABLE idempotency_keys (
    idem_key     VARCHAR(100) NOT NULL,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope        VARCHAR(60) NOT NULL,
    resource_id  UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, scope, idem_key)
);
CREATE INDEX idx_idem_created ON idempotency_keys(created_at);
