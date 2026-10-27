git branch -m# Aurelia HBS — Hệ thống Đặt phòng Khách sạn (full stack)

Hệ thống đặt phòng cho **Aurelia Oceanfront Resort, Đà Nẵng** (45 phòng) theo SRS v2.0, gồm ba cổng:

| Cổng | Người dùng | Chức năng chính |
|---|---|---|
| Khách (song ngữ VI/EN) | Khách lưu trú | Tìm phòng trống, xem chi tiết & báo giá từng đêm, đặt phòng với mã khuyến mãi, voucher QR, thanh toán VNPay/MoMo, quản lý & hủy đặt phòng, đăng nhập Google/Apple |
| Lễ tân | Receptionist | Lịch phòng × ngày theo kênh, check-in/out, folio (phí phát sinh, thanh toán, hoàn tiền), đặt tại quầy có kiểm tra trùng lịch, buồng phòng, danh bạ khách, tìm kiếm ⌘K |
| Quản trị | Admin | Dashboard doanh thu (ADR, RevPAR, công suất), giá & gói & mùa & hoa hồng kênh, mã khuyến mãi, phòng & loại phòng & ảnh, nhân viên, báo cáo PDF/Excel, cấu hình khách sạn, nhật ký thao tác |

```
aurelia-hbs/
├── backend/     Spring Boot 3.3 · Java 21 · PostgreSQL 16 · Redis · S3 (SeaweedFS)   (xem backend/README.md)
├── frontend/    React 18 · Vite · TypeScript · Tailwind v4 · TanStack Query
├── docker-compose.yml   chạy toàn bộ hệ thống (máy local)
├── deploy/              production trên VPS: Caddy HTTPS, sao lưu, deploy.sh
├── .github/workflows/ci.yml
└── docs/TESTING.md      chiến lược kiểm thử toàn hệ thống
```

## Chạy toàn bộ bằng Docker

```bash
cp .env.example .env          # đổi JWT_SECRET, mật khẩu trước khi lên production
docker compose up -d --build
```

| Dịch vụ | Địa chỉ |
|---|---|
| **Web** (khách, lễ tân, quản trị) | http://localhost |
| API | http://localhost/api/v1 (qua Nginx) hoặc http://localhost:8080/api/v1 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Mailpit (email xác nhận, quên mật khẩu) | http://localhost:8025 |
| Kho ảnh S3 (SeaweedFS) | http://localhost:9000 |

Nginx trong container `web` phục vụ SPA và chuyển `/api` sang `api:8080`, nên frontend và API cùng một origin:
cookie `refresh_token` (HttpOnly, SameSite=Strict) hoạt động mà không cần mở CORS.

| Tài khoản mẫu | Mật khẩu | Vào thẳng |
|---|---|---|
| admin@aureliaresort.vn | Admin@123 | /admin/dashboard |
| letan@aureliaresort.vn | Letan@123 | /staff/front-desk |
| nguyenvana@gmail.com | Guest@123 | /my-bookings |

Mã khuyến mãi mẫu: `EARLY15` (đặt trước 30 ngày, từ 2 đêm), `RAINY500K` (mùa mưa, từ 3 đêm).

## Triển khai VPS

```bash
cd deploy && sudo bash deploy.sh
```

Tự cài Docker, sinh mật khẩu, bật HTTPS khi có tên miền, sao lưu CSDL hằng ngày. Chi tiết: [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Phát triển

```bash
# Backend: hạ tầng bằng Docker, API chạy trên máy
cd backend && docker compose up -d postgres redis s3 mailpit && mvn spring-boot:run

# Frontend: Vite proxy /api → localhost:8080
cd frontend && npm install && npm run dev            # http://localhost:5173

# Frontend không cần backend: MSW giả lập toàn bộ API trong trình duyệt
cd frontend && npm run dev:mock
```

Khi chạy frontend ở cổng 5173, đặt `APP_FRONTEND_URL=http://localhost:5173` cho backend để link trong email,
OAuth và return URL thanh toán trỏ đúng.

## Kiểm thử

| Tầng | Lệnh | Công cụ |
|---|---|---|
| Backend unit + kiến trúc | `cd backend && mvn test` | JUnit 5, Mockito, ArchUnit |
| Backend integration + độ phủ | `cd backend && mvn verify` | Testcontainers (PostgreSQL, Redis), JaCoCo |
| Frontend unit + component | `cd frontend && npm test` / `npm run test:coverage` | Vitest, Testing Library, MSW |
| Frontend E2E (mock) | `cd frontend && npx playwright install chromium && npm run e2e` | Playwright + MSW |
| E2E trên hệ thống thật | `docker compose up -d` rồi `cd frontend && E2E_BASE_URL=http://localhost npx playwright test --project=chromium` | Playwright |
| Smoke sau deploy | `API=http://localhost:8080 ./backend/scripts/smoke.sh` | curl |
| Hiệu năng | `docker compose --profile perf run --rm k6 run /perf/search-load.js` | k6 |

Chi tiết: [`docs/TESTING.md`](docs/TESTING.md) và [`backend/docs/TEST_PLAN.md`](backend/docs/TEST_PLAN.md) (78 test case TC-…).

## CI (GitHub Actions)

`backend` (mvn verify) và `frontend` (lint, typecheck, Vitest có độ phủ, build) chạy song song →
`frontend-e2e` (Playwright với MSW) → `system` (docker compose up, smoke test API, Playwright trên hệ thống thật,
k6 khi chạy tay) → `images` (đẩy `aurelia-api`, `aurelia-web` lên GHCR với nhánh main/develop).

## Nhóm phát triển

| Thành viên | MSSV | Vai trò |
|---|---|---|
| Nguyễn Quang Huy (Leader) | B21DCCN001 | Backend Lead |
| Hồ Khánh Linh | B21DCCN002 | Frontend Lead |
| Trần Thị Khánh Huyền | B21DCCN003 | DB Lead |
| Lê Trung Đông | B21DCCN004 | DevOps & QA |
