# [QA-15] Kịch bản Kiểm thử Bảo mật — Aurelia HBS

Tài liệu kiểm thử bảo mật cho Hệ thống Đặt phòng Khách sạn Aurelia theo SRS v2.0 (nhóm NFR-S01 đến NFR-S10) phục vụ nghiệm thu Sprint và vai trò QA Lead của **Lê Trung Đông (MSV: PTIT-HN-010)**.

---

## 1. Mục tiêu kiểm thử
Xác minh hệ thống đáp ứng các tiêu chuẩn bảo mật theo đặc tả:
- Chống tấn công brute-force tài khoản.
- Chống tấn công Injection (SQL Injection, XSS).
- Bảo vệ an toàn phiên làm việc, Cookie, Token.
- Bảo vệ dữ liệu nhạy cảm của khách lưu trú (CCCD/Passport theo Nghị định 13/2023/NĐ-CP).
- Đảm bảo an ninh hạ tầng mạng và máy chủ VPS.

---

## 2. Danh mục kịch bản kiểm thử bảo mật (Test Cases)

| Mã TC | Tiêu chuẩn SRS | Kịch bản kiểm thử | Hành vi kỳ vọng | Trạng thái |
|---|---|---|---|:---:|
| **SEC-01** | **NFR-S05** (Brute-Force) | Đăng nhập sai mật khẩu 5 lần liên tiếp | - Sau lần thứ 5, tài khoản bị khóa tạm trong 15 phút (`locked_until`).<br>- Trả về mã lỗi HTTP 403 `ACCOUNT_LOCKED`. | **ĐẠT** |
| **SEC-02** | **NFR-S09** (Dữ liệu cá nhân) | Lễ tân/Khách xem danh sách hồ sơ | - Số CCCD/Passport chỉ được hiển thị 4 số cuối (ví dụ `********1234`).<br>- Không để lộ toàn bộ số giấy tờ ở API công khai. | **ĐẠT** |
| **SEC-03** | **NFR-S06** (SQL Injection) | Nhập chuỗi SQL Injection (`' OR 1=1 --`) vào ô tìm kiếm phòng, ô mã đặt phòng | - Hệ thống xử lý qua truy vấn tham số (Parameterized Query) của JPA/Hibernate.<br>- Không lỗi cú pháp SQL, không rò rỉ dữ liệu ngoài phạm vi. | **ĐẠT** |
| **SEC-04** | **NFR-S07** (XSS) | Nhập mã script `<script>alert('xss')</script>` vào trường ghi chú đặt phòng, tên khách | - Dữ liệu được encode/escape an toàn khi hiển thị trên giao diện React.<br>- Không thực thi mã JavaScript tùy tiện. | **ĐẠT** |
| **SEC-05** | **NFR-S01** (Token & Cookie) | Kiểm tra thuộc tính của Refresh Token | - Cookie `refresh_token` có cờ `HttpOnly`, `SameSite=Strict`, `Secure`.<br>- JavaScript phía client không thể đọc được cookie này. | **ĐẠT** |
| **SEC-06** | **NFR-S10** (Đặt lại mật khẩu) | Yêu cầu quên mật khẩu và kiểm tra token | - Token đặt lại mật khẩu lưu dạng băm (SHA-256).<br>- Hết hạn sau 30 phút và chỉ sử dụng được 1 lần duy nhất. | **ĐẠT** |
| **SEC-07** | **NFR-S02** (Phân quyền RBAC) | Dùng tài khoản Guest/Lễ tân gọi API Admin (`/admin/users`, `/seasonal-rules`) | - Trả về HTTP 403 `FORBIDDEN`.<br>- Chặn phân quyền ở cả tầng API Backend và Router Frontend. | **ĐẠT** |
| **SEC-08** | **NFR-S08** (An toàn VPS) | Quét cổng ngoài Internet của VPS | - Chỉ mở cổng 80 (HTTP) và 443 (HTTPS) qua Caddy.<br>- Cổng CSDL PostgreSQL (5432), Redis (6379), Swagger và Actuator bị chặn từ bên ngoài. | **ĐẠT** |

---

## 3. Kết quả nghiệm thu
Toàn bộ các tiêu chí kiểm thử bảo mật đã được bao phủ bởi các kịch bản kiểm thử tự động tại:
- `backend/src/test/java/vn/aurelia/hbs/it/SecurityMatrixIT.java`
- `backend/src/test/java/vn/aurelia/hbs/it/AuthIT.java`
- `backend/src/test/java/vn/aurelia/hbs/guest/MaskingTest.java`
- Cấu hình tường lửa UFW trong `deploy/deploy.sh` và proxy Caddy tại `deploy/Caddyfile`.
