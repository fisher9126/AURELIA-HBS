# Chiến lược kiểm thử toàn hệ thống Aurelia HBS

Tài liệu này bổ sung [`backend/docs/TEST_PLAN.md`](../backend/docs/TEST_PLAN.md) (78 test case backend TC-…)
bằng phần kiểm thử frontend và kiểm thử đầu-cuối.

## 1. Kim tự tháp kiểm thử

| Tầng | Phạm vi | Công cụ | Chạy ở |
|---|---|---|---|
| Unit backend | Service, tính giá, bậc phí hủy, ký HMAC VNPay/MoMo | JUnit 5, Mockito | `mvn test` |
| Integration backend | API thật + PostgreSQL 16 + Redis 7, đồng thời, phân quyền | Testcontainers, MockMvc | `mvn verify` |
| Unit frontend | Định dạng tiền/ngày, API client (envelope, lỗi, refresh token) | Vitest | `npm test` |
| Component frontend | Trang React render với API giả lập MSW, thao tác như người dùng | Testing Library, user-event, MSW | `npm test` |
| E2E (mock) | Luồng chính trên trình duyệt thật, desktop và mobile | Playwright + `npm run dev:mock` | `npm run e2e` |
| E2E (hệ thống) | Cùng kịch bản trên docker compose: Nginx → Spring Boot → PostgreSQL | Playwright `E2E_BASE_URL` | CI job `system` |
| Smoke | Đăng nhập, tìm phòng, đặt rồi hủy, folio, dashboard | `backend/scripts/smoke.sh` | sau deploy |
| Hiệu năng | Tìm phòng 50 VU, đặt phòng đồng loạt, dashboard lễ tân | k6 | chạy tay |

## 2. Mock API (MSW)

`frontend/src/mocks/handlers.ts` mô phỏng `/api/v1` trong bộ nhớ, dùng chung cho:

- `npm run dev:mock`: demo giao diện không cần Docker (phiên lưu trong sessionStorage).
- Vitest (`msw/node`, `onUnhandledRequest: 'error'` để phát hiện gọi API ngoài dự kiến).
- Playwright mặc định.

Dữ liệu mẫu (`fixtures.ts`) khớp seed Flyway V2/V4: 3 loại phòng, 45 phòng, 5 kênh, 4 bậc phí hủy, 2 mã khuyến mãi,
3 tài khoản demo. Các quy tắc được mô phỏng: chồng lấn đặt phòng, giới hạn giảm giá 10% của lễ tân,
Idempotency-Key, chặn check-out khi còn nợ, phòng chuyển DIRTY sau check-out, phí hủy theo số giờ trước nhận phòng.

## 3. Test case frontend

| Mã | File | Kịch bản | Kỳ vọng |
|---|---|---|---|
| FE-01 | `lib/format.test.ts` | Định dạng VND, rút gọn tỷ/triệu | `1.500.000 ₫`, `1,25 tỷ` |
| FE-02 | `lib/format.test.ts` | Cộng ngày qua tháng/năm, đếm đêm | Không lệch múi giờ |
| FE-03 | `lib/api.test.ts` | Bóc `{data}`, gắn `Authorization: Bearer` | Đúng dữ liệu, đúng header |
| FE-04 | `lib/api.test.ts` | Lỗi `VALIDATION_ERROR` có `details` | `ApiError.fieldErrors()` theo trường |
| FE-05 | `lib/api.test.ts` | 3 request cùng nhận 401 | Chỉ gọi `/auth/refresh` 1 lần rồi gửi lại cả 3 |
| FE-06 | `auth/auth.test.tsx` | Sai mật khẩu | Hiện thông báo từ server |
| FE-07 | `auth/auth.test.tsx` | Admin đăng nhập | Chuyển tới `/admin/dashboard` |
| FE-08 | `auth/auth.test.tsx` | `returnTo=//evil.com` | Bỏ qua, về trang mặc định (chống open redirect) |
| FE-09 | `auth/auth.test.tsx` | Đăng ký mật khẩu yếu, chưa tick điều khoản | Báo lỗi phía client, không gọi API |
| FE-10 | `auth/auth.test.tsx` | Khách vào trang lễ tân | Bị đưa về `/my-bookings` |
| FE-11 | `auth/auth.test.tsx` | Chưa đăng nhập vào trang riêng | Chuyển tới `/auth/login` |
| FE-12 | `pages/guest/guest.test.tsx` | Tìm phòng 3 đêm, 2 người lớn | Liệt kê 3 loại phòng còn trống |
| FE-13 | `pages/guest/guest.test.tsx` | Lọc gói AP | Chỉ còn loại phòng có AP |
| FE-14 | `pages/guest/guest.test.tsx` | 1 trẻ em | Standard King (0 trẻ em) bị loại |
| FE-15 | `pages/guest/guest.test.tsx` | Vào `/book` khi chưa đăng nhập | Yêu cầu đăng nhập |
| FE-16 | `pages/guest/guest.test.tsx` | Đặt Luxury CP 3 đêm + `EARLY15` | Tiền phòng 4.500.000, giảm 675.000, sang trang xác nhận |
| FE-17 | `pages/guest/guest.test.tsx` | Hủy đặt phòng | Hiện phí theo bậc, hủy thành công |
| FE-18 | `pages/staff/staff.test.tsx` | Check-in chưa xác minh giấy tờ | Nút xác nhận bị khóa; bật xác minh thì nhận phòng được |
| FE-19 | `pages/staff/staff.test.tsx` | Check-out khi còn nợ | Bị khóa cho tới khi bật “cho phép nợ” |
| FE-20 | `pages/staff/staff.test.tsx` | Phòng DIRTY → “Đã dọn xong” | Thông báo phòng sạch & sẵn sàng |
| FE-21 | `pages/staff/staff.test.tsx` | Lễ tân nhập giảm 15% | Báo lỗi tối đa 10% |
| FE-22 | `pages/staff/staff.test.tsx` | Walk-in chọn phòng đang có khách | Cảnh báo trùng lịch + gợi ý phòng khác |
| FE-23 | `pages/admin/admin.test.tsx` | Dashboard | KPI doanh thu và bảng doanh thu theo kênh |
| FE-24 | `pages/admin/admin.test.tsx` | Xóa bậc 48–72h khỏi chính sách hủy | Báo khung giờ hở, khóa nút lưu |
| FE-25 | `pages/admin/admin.test.tsx` | Tab mã khuyến mãi | Hiện EARLY15, RAINY500K |
| FE-26 | `pages/admin/admin.test.tsx` | Màu heatmap công suất | Dải tuần tự một tông theo ngưỡng |

## 4. Kịch bản E2E (Playwright)

| Mã | Spec | Kịch bản |
|---|---|---|
| E2E-01 | `e2e/guest.spec.ts` | Trang chủ → Kiểm tra phòng trống → kết quả (desktop + Pixel 7) |
| E2E-02 | `e2e/guest.spec.ts` | Đăng nhập khách → đặt phòng với EARLY15 → trang xác nhận có mã AUR-… |
| E2E-03 | `e2e/guest.spec.ts` | Đổi ngôn ngữ EN |
| E2E-04 | `e2e/staff.spec.ts` | Lễ tân check-in khách đến hôm nay |
| E2E-05 | `e2e/staff.spec.ts` | Lễ tân mở `/admin/dashboard` bị chuyển về quầy lễ tân |
| E2E-06 | `e2e/staff.spec.ts` | Lịch đặt phòng có thanh đặt phòng, mở ngăn kéo walk-in |
| E2E-07 | `e2e/staff.spec.ts` | Admin xem dashboard, tìm “Sanjay” bằng Ctrl+K |

## 5. Tiêu chí hoàn thành

- Toàn bộ test backend và frontend xanh trên CI; ESLint và `tsc` không lỗi.
- Độ phủ dòng: backend ≥ 70% (JaCoCo), frontend báo cáo trong `frontend/coverage`.
- E2E-01 → E2E-07 xanh trên cả mock và hệ thống thật.
- Smoke test xanh sau mỗi lần deploy staging.
