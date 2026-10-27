-- Dữ liệu mẫu để chạy thử. Mật khẩu băm bằng bcrypt ($2a$, cost 10) qua pgcrypto, tương thích Spring Security.
-- Tài khoản: admin@aureliaresort.vn / Admin@123 · letan@aureliaresort.vn / Letan@123 · nguyenvana@gmail.com / Guest@123

INSERT INTO properties (id, name, address, tax_code, hotline, email, terms_text)
VALUES ('00000000-0000-0000-0000-000000000001', 'Aurelia Oceanfront Resort',
        '88 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng', '0401789256', '1900 6868', 'stay@aureliaresort.vn',
        'Hủy trước 72 giờ miễn phí; 48–72 giờ phí 25%; 24–48 giờ phí 50%; dưới 24 giờ hoặc không đến phí 100%.');

INSERT INTO users (id, property_id, full_name, email, password_hash, phone, role) VALUES
('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'Trần Quốc Bảo', 'admin@aureliaresort.vn',
 crypt('Admin@123', gen_salt('bf', 10)), '0905112233', 'ADMIN'),
('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000001', 'Nguyễn Mai', 'letan@aureliaresort.vn',
 crypt('Letan@123', gen_salt('bf', 10)), '0935448120', 'RECEPTIONIST'),
('00000000-0000-0000-0000-0000000000a3', NULL, 'Nguyễn Văn A', 'nguyenvana@gmail.com',
 crypt('Guest@123', gen_salt('bf', 10)), '0912345678', 'GUEST');

INSERT INTO guests (id, user_id, full_name, email, phone, id_type, id_number, nationality) VALUES
('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a3', 'Nguyễn Văn A', 'nguyenvana@gmail.com',
 '0912345678', 'CCCD', '001203004567', 'VN');
INSERT INTO guests (id, full_name, email, phone, id_type, id_number, nationality, is_vip, notes) VALUES
('00000000-0000-0000-0000-0000000000b2', 'Sanjay Kumar', 'sanjay.k@email.com', '+84912345678', 'PASSPORT', 'P1289471', 'IN', TRUE,
 'Dị ứng gối lông vũ, thích tầng cao yên tĩnh');

INSERT INTO booking_channels (code, name, commission_rate, color) VALUES
('DIRECT', 'Đặt trực tiếp', 0, '#7C3AED'),
('OTA', 'OTA (Agoda, Booking.com)', 15, '#FB7185'),
('AGENT', 'Đại lý du lịch', 10, '#FBBF24'),
('GROUP', 'Khách đoàn', 0, '#34D399'),
('CORPORATE', 'Doanh nghiệp', 0, '#34D399');

INSERT INTO room_types (id, property_id, name, slug, description, area_m2, bed_type, view_type, max_adults, max_children, base_price, status) VALUES
('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'Luxury Suite', 'luxury-suite',
 'Suite góc tầng 5, ban công hướng biển Mỹ Khê, bồn Jacuzzi.', 45, '1 King', 'Biển trực diện', 2, 1, 1200000, 'ACTIVE'),
('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000001', 'Deluxe Ocean', 'deluxe-ocean',
 'Ban công ngắm hoàng hôn, tầng 3–4.', 35, '1 King', 'Biển', 2, 0, 950000, 'ACTIVE'),
('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000001', 'Standard King', 'standard-king',
 'Tiện nghi tiêu chuẩn, tầng 1–2.', 28, '1 King', 'Vườn', 2, 0, 700000, 'ACTIVE');

INSERT INTO room_plans (room_type_id, plan_code, plan_name, meals_included, surcharge_per_night, is_recommended) VALUES
('00000000-0000-0000-0000-0000000000c1', 'EP', 'European Plan', 'Chỉ phòng', 0, FALSE),
('00000000-0000-0000-0000-0000000000c1', 'CP', 'Continental Plan', 'Buffet sáng cho 2 khách', 300000, TRUE),
('00000000-0000-0000-0000-0000000000c1', 'MAP', 'Half Board', 'Sáng và tối set 4 món', 900000, FALSE),
('00000000-0000-0000-0000-0000000000c1', 'AP', 'Full Board', '3 bữa mỗi ngày', 1500000, FALSE),
('00000000-0000-0000-0000-0000000000c2', 'EP', 'European Plan', 'Chỉ phòng', 0, FALSE),
('00000000-0000-0000-0000-0000000000c2', 'CP', 'Continental Plan', 'Buffet sáng cho 2 khách', 300000, TRUE),
('00000000-0000-0000-0000-0000000000c2', 'MAP', 'Half Board', 'Sáng và tối', 900000, FALSE),
('00000000-0000-0000-0000-0000000000c3', 'EP', 'European Plan', 'Chỉ phòng', 0, TRUE),
('00000000-0000-0000-0000-0000000000c3', 'CP', 'Continental Plan', 'Buffet sáng cho 2 khách', 300000, FALSE);

INSERT INTO amenities (name, category, icon, is_filterable) VALUES
('Ban công hướng biển', 'VIEW', 'waves', TRUE),
('Bồn tắm Jacuzzi', 'BATHROOM', 'bath', TRUE),
('Phòng không hút thuốc', 'GENERAL', 'nosmoke', TRUE),
('Bàn làm việc', 'GENERAL', 'desk', TRUE),
('Wi-Fi 6', 'TECH', 'wifi', FALSE),
('Smart TV 55 inch', 'TECH', 'tv', FALSE),
('Minibar miễn phí', 'REFRESHMENT', 'wine', FALSE),
('Máy pha cà phê', 'REFRESHMENT', 'coffee', FALSE);

INSERT INTO room_type_amenities (room_type_id, amenity_id)
SELECT '00000000-0000-0000-0000-0000000000c1', id FROM amenities;
INSERT INTO room_type_amenities (room_type_id, amenity_id)
SELECT '00000000-0000-0000-0000-0000000000c2', id FROM amenities WHERE name <> 'Bồn tắm Jacuzzi';
INSERT INTO room_type_amenities (room_type_id, amenity_id)
SELECT '00000000-0000-0000-0000-0000000000c3', id FROM amenities WHERE category IN ('TECH','GENERAL');

-- 10 Luxury Suite (tầng 5), 15 Deluxe Ocean (tầng 3–4), 20 Standard King (tầng 1–2)
INSERT INTO rooms (property_id, room_number, floor, room_type_id)
SELECT '00000000-0000-0000-0000-000000000001', '5' || lpad(n::text, 2, '0'), 5, '00000000-0000-0000-0000-0000000000c1'
FROM generate_series(1, 10) n;
INSERT INTO rooms (property_id, room_number, floor, room_type_id)
SELECT '00000000-0000-0000-0000-000000000001', (CASE WHEN n <= 8 THEN '3' ELSE '4' END) || lpad((CASE WHEN n <= 8 THEN n ELSE n - 8 END)::text, 2, '0'),
       CASE WHEN n <= 8 THEN 3 ELSE 4 END, '00000000-0000-0000-0000-0000000000c2'
FROM generate_series(1, 15) n;
INSERT INTO rooms (property_id, room_number, floor, room_type_id)
SELECT '00000000-0000-0000-0000-000000000001', (CASE WHEN n <= 10 THEN '1' ELSE '2' END) || lpad((CASE WHEN n <= 10 THEN n ELSE n - 10 END)::text, 2, '0'),
       CASE WHEN n <= 10 THEN 1 ELSE 2 END, '00000000-0000-0000-0000-0000000000c3'
FROM generate_series(1, 20) n;

INSERT INTO cancellation_tiers (property_id, hours_from, hours_to, penalty_percent, description) VALUES
('00000000-0000-0000-0000-000000000001', 72, NULL, 0, 'Miễn phí, hoàn 100%'),
('00000000-0000-0000-0000-000000000001', 48, 72, 25, 'Phí 25% tổng tiền'),
('00000000-0000-0000-0000-000000000001', 24, 48, 50, 'Phí 50% tổng tiền'),
('00000000-0000-0000-0000-000000000001', 0, 24, 100, 'Phí 100%, gồm không đến');

INSERT INTO seasonal_rules (property_id, name, start_date, end_date, multiplier, priority) VALUES
('00000000-0000-0000-0000-000000000001', 'Cao điểm hè 2026', '2026-06-01', '2026-08-31', 1.30, 10),
('00000000-0000-0000-0000-000000000001', 'Thấp điểm mùa mưa 2026', '2026-10-15', '2026-12-15', 0.85, 5);
