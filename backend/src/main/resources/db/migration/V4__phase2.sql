-- Giai đoạn 2: đăng nhập Google/Apple, cổng thanh toán online, mã khuyến mãi mẫu.

-- AUTH-08: định danh tài khoản ở nhà cung cấp OAuth (claim "sub")
ALTER TABLE users ADD COLUMN oauth_subject VARCHAR(255);
CREATE UNIQUE INDEX uq_users_oauth ON users(oauth_provider, oauth_subject) WHERE oauth_subject IS NOT NULL;

-- PAY-06: giao dịch VNPay / MoMo. transaction_ref là mã đơn gửi sang cổng, gateway_txn_no là mã giao dịch cổng trả về.
ALTER TABLE payments ADD COLUMN gateway_txn_no VARCHAR(100);
ALTER TABLE payments ADD COLUMN expires_at TIMESTAMPTZ;
CREATE UNIQUE INDEX uq_payments_txn_ref ON payments(method, transaction_ref)
    WHERE method IN ('VNPAY','MOMO') AND transaction_ref IS NOT NULL;
CREATE INDEX idx_payments_pending ON payments(status, expires_at) WHERE status = 'PENDING';

-- BK-15 / SET-06: tổng số lượt dùng không vượt max_uses
ALTER TABLE promotions ADD COLUMN description VARCHAR(200);
ALTER TABLE promotions ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE promotions ADD CONSTRAINT ck_promotions_uses CHECK (max_uses IS NULL OR used_count <= max_uses);
ALTER TABLE promotions ADD CONSTRAINT ck_promotions_valid CHECK (valid_to >= valid_from);
ALTER TABLE promotions ADD CONSTRAINT ck_promotions_percent CHECK (discount_type <> 'PERCENT' OR discount_value <= 100);

-- Tra cứu nhật ký thao tác (STAFF-05)
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

INSERT INTO promotions (code, description, discount_type, discount_value, min_nights, book_before_days,
                        stay_from, stay_to, valid_from, valid_to, max_uses) VALUES
('EARLY15', 'Đặt trước 30 ngày giảm 15% tiền phòng', 'PERCENT', 15, 2, 30, NULL, NULL, '2026-01-01', '2027-12-31', NULL),
('RAINY500K', 'Mùa mưa giảm 500.000đ cho kỳ nghỉ từ 3 đêm', 'AMOUNT', 500000, 3, NULL, '2026-10-15', '2026-12-15', '2026-10-01', '2026-12-10', 200);
