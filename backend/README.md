# Aurelia HBS – Backend

Backend đầy đủ cho **Hệ thống Đặt phòng Khách sạn Aurelia** theo SRS v2.0: toàn bộ yêu cầu MVP và Giai đoạn 2
(111 endpoint REST, 120 file Java).

| Thành phần | Công nghệ |
|---|---|
| Ngôn ngữ, khung | Java 21, Spring Boot 3.3, Maven |
| Dữ liệu | PostgreSQL 16, Spring Data JPA (Hibernate 6), Flyway |
| Xác thực | Spring Security, JWT HS256 (access 15 phút) + refresh token xoay vòng 7 ngày trong cookie HttpOnly |
| Cache, giới hạn tần suất | Redis 7 (fail-open: Redis lỗi thì API vẫn chạy, chỉ mất cache) |
| Ảnh | Kho S3: MinIO Java SDK, server SeaweedFS (MinIO đã gỡ image miễn phí) |
| Đăng nhập mạng xã hội | Google (Authorization Code), Apple (form_post), xác minh id_token qua JWKS |
| Thanh toán online | VNPay 2.1.0 (HMAC-SHA512), MoMo v2 captureWallet (HMAC-SHA256), sandbox |
| Tài liệu | OpenPDF (voucher, folio, báo cáo, font DejaVu đủ tiếng Việt), ZXing (QR), Apache POI (Excel) |
| Email | JavaMail + `@Async`, thử lại 3 lần; môi trường dev bắt thư bằng Mailpit |
| Tài liệu API | springdoc-openapi (Swagger UI) |
| Đóng gói | Docker multi-stage, Docker Compose |

## Chạy nhanh

```bash
cp .env.example .env        # đổi JWT_SECRET và mật khẩu trước khi lên production
docker compose up --build
```

| Dịch vụ | Địa chỉ |
|---|---|
| API | http://localhost:8080/api/v1 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Health | http://localhost:8080/actuator/health |
| Mailpit (xem email gửi đi) | http://localhost:8025 |
| Redis | localhost:6379 |
| Kho ảnh S3 (SeaweedFS) | http://localhost:9000 (aurelia / aurelia_minio_dev) |

Flyway (V1–V4) tự tạo 21 bảng và nạp dữ liệu mẫu: 1 khách sạn, 3 loại phòng, 45 phòng, 9 gói, 8 tiện nghi, 5 kênh,
4 mốc phí hủy, 2 quy tắc mùa, 2 mã khuyến mãi (`EARLY15`, `RAINY500K`).

| Tài khoản mẫu | Mật khẩu | Vai trò |
|---|---|---|
| admin@aureliaresort.vn | Admin@123 | ADMIN |
| letan@aureliaresort.vn | Letan@123 | RECEPTIONIST |
| nguyenvana@gmail.com | Guest@123 | GUEST |

Chạy không cần Docker cho API (vẫn cần Postgres, Redis): `docker compose up -d postgres redis s3 mailpit` rồi
`mvn spring-boot:run`. Yêu cầu mẫu theo luồng nghiệp vụ: `http/aurelia.http`.

## Kiểm thử

Chi tiết chiến lược, kỹ thuật thiết kế và danh sách 78 test case có mã TC-…: [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md).

| Loại | Lệnh | Ghi chú |
|---|---|---|
| Unit + kiến trúc | `mvn test` | JUnit 5, Mockito, ArchUnit; không cần Docker |
| Unit + integration + độ phủ | `mvn verify` | Testcontainers tự bật PostgreSQL 16 và Redis 7; cần Docker đang chạy |
| Không cài JDK/Maven | `docker compose -f docker-compose.test.yml run --rm tests` | chạy toàn bộ trong container Maven |
| Hiệu năng | `docker compose up -d` rồi `docker compose --profile perf run --rm k6 run /perf/search-load.js` | thêm `booking-spike.js`, `staff-dashboard.js` |
| Smoke sau deploy | `./scripts/smoke.sh` (hoặc `API=https://api.aureliaresort.vn ./scripts/smoke.sh`) | tạo rồi hủy 1 đặt phòng thử |

Báo cáo: `target/surefire-reports`, `target/failsafe-reports`, độ phủ `target/site/jacoco/index.html`.
Bộ test gồm 36 lớp, khoảng 140 phương thức (hơn 200 trường hợp khi tính tham số hóa): luồng đặt phòng đầy đủ,
biên các mốc phí hủy, 12–15 yêu cầu đặt phòng đồng thời không overbooking, ma trận phân quyền 45 trường hợp,
IPN VNPay/MoMo đã ký và giả mạo, ràng buộc CSDL, cache Redis, giới hạn tần suất, xuất PDF/CSV/Excel.

## Cấu trúc

```
src/main/java/vn/aurelia/hbs
├── auth/          đăng ký, đăng nhập, refresh, quên/đổi mật khẩu, Google/Apple (AUTH)
├── security/      JWT filter, SecurityConfig, CurrentUser
├── user/ staff/   tài khoản, quản lý nhân viên (STAFF, BR-13)
├── property/      cấu hình khách sạn, mốc phí hủy (SET)
├── room/          phòng, loại phòng, gói, ảnh, tiện nghi, tìm phòng trống (ROOM, RT, SEARCH)
├── pricing/       quy tắc mùa, kênh bán, báo giá (RT-03, RT-04, SRS 13.3)
├── booking/       đặt phòng, trạng thái, lịch, trùng lịch, no-show job (BK, CD, CAL)
├── folio/         phí phát sinh, thanh toán, hoàn tiền (PAY)
├── payment/       VNPay, MoMo: tạo link, IPN, return URL, hết hạn giao dịch (PAY-06)
├── promotion/     mã khuyến mãi: quản lý, kiểm tra, áp dụng, đếm lượt (BK-15, SET-06)
├── document/      voucher PDF có QR, folio PDF, xuất CSV/PDF/Excel (BK-09, BK-11, PAY-04, RPT-07)
├── search/        tìm kiếm toàn hệ thống ⌘K, danh sách chi nhánh (DASH-08, DASH-10)
├── housekeeping/  trạng thái phòng và việc buồng phòng (HK)
├── guest/         hồ sơ khách, VIP (GUEST)
├── dashboard/     tổng quan, KPI, doanh thu theo kênh, heatmap công suất, ADR/RevPAR 12 tháng, phân tích hủy
├── storage/       MinIO
├── notification/  email
└── common/        lỗi chuẩn, phân trang, tiền tệ, Idempotency-Key, audit log, cache Redis, rate limit
```

## Quy ước API (SRS 9.1)

- Tiền là số nguyên VND (`BIGINT`), làm tròn đến đồng sau mỗi bước tính.
- Thành công: `{ "data": …, "meta": { page, limit, total, totalPages } }`; lỗi: `{ "error": { code, message, details } }` với mã ở SRS 13.1.
- Phân trang `?page=1&limit=20`, sắp xếp `?sort=-created_at`.
- `POST /bookings` và `POST /bookings/:id/payments` nhận header `Idempotency-Key` (lưu 24 giờ).
- Khoảng ngày lưu trú là `[checkIn, checkOut)`; báo cáo dùng `[from, to)`.

## Các quy tắc nghiệp vụ được backend kiểm tra

| Quy tắc | Nơi kiểm tra |
|---|---|
| BR-01–04 ngày, quá khứ, tối đa 30 đêm, sức chứa | `StayRules` |
| BR-05 không chồng lịch | khóa dòng phòng + `ex_bookings_no_overlap` (EXCLUDE gist) trong Postgres |
| BR-06 không đặt phòng hỏng | `findAvailable`, `checkRoomBookable` |
| BR-07 chốt giá lúc tạo | giá lưu trên `bookings`, chỉ tính lại khi đổi ngày/gói/loại/giảm giá |
| BR-08 hệ số mùa theo đêm, priority rồi quy tắc tạo sau | `PricingService.pickRule` |
| BR-09 lễ tân giảm tối đa 10% | `BookingService.checkDiscount` |
| BR-10 phí hủy theo giờ tới 14:00 ngày nhận | `BookingService.quoteCancellation` |
| BR-11 check-in khi phòng available | `HousekeepingService.onCheckIn` |
| BR-13 luôn còn 1 Admin | `StaffService.ensureAnotherAdmin` |
| BR-14 mã BK-YYYYMMDD-XXXX | `BookingService.newRef` |
| Trạng thái phòng/đặt phòng (12.2) | `BookingService`, `HousekeepingService` |

Việc định kỳ (giờ Việt Nam): 09:00 gửi thư nhắc khách đến trong ngày; 23:59 chuyển đặt phòng confirmed chưa đến thành
`NO_SHOW`; mỗi 5 phút đóng giao dịch online quá hạn; 03:00 dọn token hết hạn, Idempotency-Key cũ, nhật ký quá 12 tháng.

## Cấu hình cổng thanh toán và đăng nhập mạng xã hội

Điền vào `.env` (để trống thì endpoint tương ứng trả lỗi "Chưa cấu hình …", phần còn lại vẫn chạy):

| Biến | Lấy ở đâu | Ghi chú |
|---|---|---|
| `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` | https://sandbox.vnpayment.vn/devreg/ | IPN URL khai báo với VNPay: `{APP_API_URL}/api/v1/payments/vnpay/ipn` |
| `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY` | trang developer MoMo (môi trường test) | IPN tự gửi tới `{APP_API_URL}/api/v1/payments/momo/ipn` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → Credentials | Redirect URI: `{APP_API_URL}/api/v1/auth/oauth/google/callback` |
| `APPLE_CLIENT_ID` | Apple Developer → Services ID | Return URL: `{APP_API_URL}/api/v1/auth/oauth/apple/callback` (Apple bắt buộc HTTPS) |
| `APP_API_URL` | địa chỉ công khai của API | Chạy local muốn nhận IPN thì dùng ngrok / Cloudflare Tunnel |

Ở môi trường local, cổng không gọi được IPN vào `localhost`; khi khách quay về return URL, API vẫn xác minh chữ ký
và ghi nhận kết quả (xử lý idempotent, IPN tới sau không ghi trùng).

Luồng thanh toán online: `POST /bookings/{id}/online-payments {"gateway":"VNPAY"}` → nhận `payUrl` → mở cho khách
→ cổng gọi IPN → payment `COMPLETED`, folio và `payment_status` cập nhật → khách về `{frontend}/payment-result?status=success&ref=BK-…`.

Luồng đăng nhập Google: frontend mở `GET /api/v1/auth/oauth/google?returnTo=/my-bookings` → Google → API →
`{frontend}/auth/oauth-callback#access_token=…&expires_in=900&return_to=/my-bookings` (refresh token trong cookie).
Ứng dụng đã có id_token (Google Identity Services, Sign in with Apple JS) gọi `POST /api/v1/auth/oauth/{google|apple}/token`.

## Danh sách endpoint bổ sung so với MVP

| Nhóm | Endpoint |
|---|---|
| AUTH-08 | `GET /auth/oauth/{google,apple}`, `GET /auth/oauth/google/callback`, `POST /auth/oauth/apple/callback`, `POST /auth/oauth/{provider}/token` |
| PAY-06 | `POST /bookings/{id}/online-payments`, `GET /payments/{id}`, `GET /payments/vnpay/{ipn,return}`, `POST /payments/momo/ipn`, `GET /payments/momo/return` |
| BK-15, SET-06 | `POST /promotions/validate`, `GET/POST /promotions`, `PUT/DELETE /promotions/{id}`; `promoCode` trong `POST /bookings` và `POST /pricing/quote` |
| BK-12 | `POST /booking-groups`, `GET /booking-groups/{id}` |
| BK-09, BK-11, PAY-04 | `GET /bookings/export?format=csv\|pdf`, `GET /bookings/{id}/voucher.pdf`, `GET /bookings/{id}/folio.pdf` |
| CD-03, RPT-05–07 | `GET /dashboard/occupancy`, `GET /reports/adr-revpar`, `GET /reports/cancellations`, `GET /reports/export?type=…&format=pdf\|xlsx` |
| HK-04, HK-05 | `PATCH /housekeeping/tasks/{id}`, `PATCH /rooms/{id}/dnd` |
| STAFF-05 | `GET /audit-logs` (lưu 12 tháng, job 03:00 tự dọn) |
| DASH-08, DASH-10 | `GET /search?q=`, `GET /properties` |

Quy tắc mã khuyến mãi: đúng hạn dùng, đủ số đêm tối thiểu, đặt trước đủ số ngày (early bird), ngày lưu trú nằm trong
khoảng áp dụng, còn lượt (tăng lượt nguyên tử trong giao dịch đặt phòng, hủy phòng trả lại lượt). Mỗi đặt phòng dùng
mã hoặc giảm giá tay, không dùng cả hai (BR-09).

## Ghi chú vận hành

- Giới hạn tần suất: `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`,
  `/promotions/validate` tối đa 10 lần/phút/IP (Redis, trả `429 RATE_LIMIT_EXCEEDED`). Sau Nginx cần chuyển
  header `X-Forwarded-For`.
- Cache Redis: danh mục loại phòng, tiện nghi, cấu hình (10 phút), phòng trống (60 giây, SRS 13.4). Mọi thao tác ghi
  liên quan xóa cache ngay và sau commit. Đặt phòng luôn kiểm tra lại trên CSDL nên cache không gây overbooking.
- Access token còn hiệu lực tối đa 15 phút sau khi nhân viên bị khóa; refresh token bị thu hồi ngay.
- Chạy một instance; job định kỳ (nhắc check-in, no-show, hết hạn giao dịch online, dọn dữ liệu) và email `@Async`
  chưa cần khóa phân tán. Chạy nhiều instance thì thêm ShedLock.
- CI: `.github/workflows/ci.yml` gồm 3 job: `mvn verify` (unit + integration với Testcontainers, JaCoCo, báo cáo
  JUnit), smoke test trên toàn bộ Docker Compose (tùy chọn chạy thêm k6), build và đẩy image lên GHCR với nhánh
  `main`/`develop`.
- `spring.jpa.hibernate.ddl-auto=none`: schema do Flyway quản lý hoàn toàn.
