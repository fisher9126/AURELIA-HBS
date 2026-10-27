# Triển khai Aurelia HBS lên VPS

## 1. Chuẩn bị

| Hạng mục | Tối thiểu | Khuyến nghị |
|---|---|---|
| VPS | 2 vCPU, 2 GB RAM, 25 GB SSD | 2 vCPU, 4 GB RAM |
| Hệ điều hành | Ubuntu 22.04 / 24.04 hoặc Debian 12 | Ubuntu 24.04 |
| Cổng mở | 22, 80, 443 | |
| Tên miền | không bắt buộc (chạy HTTP theo IP) | có, để có HTTPS |

Máy 2 GB RAM vẫn chạy được: script tự tạo 4 GB swap để build Maven và Vite không bị hết RAM.

Có tên miền: tạo bản ghi **A** `aurelia.tenmien.vn → IP VPS` trước khi chạy script, Caddy sẽ tự xin chứng chỉ Let's Encrypt.
Đăng nhập Apple và return URL của VNPay/MoMo cần HTTPS, nên muốn demo đủ hai phần này thì phải có tên miền.

## 2. Đưa code lên VPS

Từ máy của bạn (thay `IP_VPS`):

```bash
scp aurelia-hbs.zip root@IP_VPS:~
ssh root@IP_VPS
apt update && apt install -y unzip
unzip aurelia-hbs.zip && cd aurelia-hbs/deploy
```

Hoặc dùng Git: `git clone <repo> aurelia-hbs && cd aurelia-hbs/deploy`.

## 3. Chạy

```bash
sudo bash deploy.sh
```

Script sẽ:

1. Cài Docker nếu chưa có, tạo swap khi RAM < 3,5 GB, mở cổng 22/80/443 trên ufw.
2. Hỏi tên miền (Enter để chạy theo IP), sinh ngẫu nhiên mật khẩu PostgreSQL, Redis, kho S3, JWT secret vào `deploy/.env.prod`.
3. Build và chạy 8 container: `postgres`, `redis`, `s3` (SeaweedFS), `mailpit`, `api`, `web`, `caddy`, `backup`.
4. Chờ API trả lời rồi in địa chỉ truy cập.

Lần đầu mất khoảng 5–15 phút (tải image, build Maven và Vite).

```
Internet ──80/443──▶ Caddy ──▶ web (Nginx: SPA + /api) ──▶ api (Spring Boot) ──▶ PostgreSQL, Redis
                         ├──▶ /media/*   → SeaweedFS S3 (ảnh phòng)
                         └──▶ /mailpit   → Mailpit (có mật khẩu)
```

Chỉ Caddy mở cổng ra ngoài. PostgreSQL, Redis, S3 và API chỉ nằm trong mạng Docker nội bộ;
Swagger và `/actuator` bị chặn từ bên ngoài.

## 4. Vận hành

| Việc | Lệnh (trong `deploy/`) |
|---|---|
| Trạng thái | `sudo bash deploy.sh status` |
| Xem log | `sudo bash deploy.sh logs api` (hoặc `web`, `caddy`, `postgres`) |
| Cập nhật code | chép code mới đè lên, rồi `sudo bash deploy.sh update` |
| Sao lưu ngay | `sudo bash deploy.sh backup` → `deploy/backups/manual-….sql.gz` |
| Khôi phục | `sudo bash deploy.sh restore backups/aurelia-2026-10-24.sql.gz` |
| Dừng | `sudo bash deploy.sh down` (dữ liệu vẫn còn trong volume) |

Sao lưu tự động chạy 02:00 hằng ngày, giữ 14 bản gần nhất.

## 5. Sau khi chạy

- Đăng nhập `admin@aureliaresort.vn / Admin@123`, đổi mật khẩu cả 3 tài khoản mẫu.
- Email (xác nhận đặt phòng, quên mật khẩu) mặc định vào Mailpit tại `/mailpit`; mật khẩu nằm trong `deploy/.mailpit-password`.
- Gửi email thật qua Gmail: tạo App Password, sửa `deploy/.env.prod`:
  ```
  MAIL_HOST=smtp.gmail.com
  MAIL_PORT=587
  MAIL_USER=ban@gmail.com
  MAIL_PASSWORD=<app password 16 ký tự>
  MAIL_SMTP_AUTH=true
  MAIL_STARTTLS=true
  MAIL_FROM=ban@gmail.com
  ```
  rồi `sudo bash deploy.sh update`.
- Google login: Authorized redirect URI `https://<tên miền>/api/v1/auth/oauth/google/callback`.
- VNPay sandbox: IPN URL `https://<tên miền>/api/v1/payments/vnpay/ipn`.

## 6. Lỗi thường gặp

| Hiện tượng | Nguyên nhân, cách xử lý |
|---|---|
| Build dừng giữa chừng, log có `Killed` | Thiếu RAM: kiểm tra `swapon --show`, chạy lại `deploy.sh update` |
| Truy cập tên miền báo lỗi chứng chỉ | Bản ghi A chưa trỏ đúng hoặc cổng 80 bị chặn ở firewall của nhà cung cấp VPS; xem `deploy.sh logs caddy` |
| Đăng nhập xong F5 lại bị đăng xuất | `PUBLIC_URL` trong `.env.prod` khác địa chỉ đang mở trên trình duyệt; sửa cho khớp rồi `update` |
| Ảnh phòng không hiện | `PUBLIC_URL` sai, ảnh được trả về theo `PUBLIC_URL/media/...` |
| Cần xem CSDL | `docker compose -f docker-compose.prod.yml --env-file .env.prod exec postgres psql -U aurelia` |
