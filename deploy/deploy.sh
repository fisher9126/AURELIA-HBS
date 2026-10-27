#!/usr/bin/env bash
# Triển khai Aurelia HBS lên VPS Ubuntu 22.04/24.04 (hoặc Debian 12). Chạy bằng root hoặc sudo:
#   cd aurelia-hbs/deploy && sudo bash deploy.sh                 # lần đầu: hỏi tên miền, sinh mật khẩu
#   sudo bash deploy.sh update                                   # sau khi chép code mới lên: build lại, khởi động lại
#   sudo bash deploy.sh logs | status | backup | down
set -euo pipefail
cd "$(dirname "$0")"
ENV=.env.prod
DC="docker compose -f docker-compose.prod.yml --env-file $ENV"
say() { printf '\033[1;33m▶ %s\033[0m\n' "$*"; }
rand() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "${1:-32}"; }

need_root() { [ "$(id -u)" -eq 0 ] || { echo "Chạy bằng sudo: sudo bash deploy.sh $*"; exit 1; }; }

install_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    say "Cài Docker"
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
  fi
  docker compose version >/dev/null || { echo "Thiếu docker compose plugin"; exit 1; }
}

check_disk() {
  local avail_gb; avail_gb=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
  if [ "$avail_gb" -lt 6 ]; then
    echo "⚠ Ổ đĩa chỉ còn ${avail_gb}GB trống, cần khoảng 6GB để build image."
    echo "  Xem chỗ chiếm: docker system df ; du -sh /var/log /root/* 2>/dev/null | sort -h | tail"
    echo "  Dọn image/cache Docker không dùng: docker system prune -af  (xóa cả image của dự án khác đang dừng)"
    read -rp "Vẫn tiếp tục? [y/N] " a; [ "$a" = "y" ] || exit 1
  fi
}

ensure_swap() {
  local mem_mb avail_gb size
  mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  avail_gb=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
  if [ "$mem_mb" -lt 3500 ] && ! swapon --show | grep -q .; then
    size=$(( avail_gb - 6 )); [ "$size" -gt 4 ] && size=4
    if [ "$size" -lt 1 ]; then
      echo "⚠ RAM ${mem_mb}MB, không đủ chỗ đĩa để tạo swap — build có thể bị kill, nên dọn đĩa trước."
      return
    fi
    say "RAM ${mem_mb}MB — tạo ${size}GB swap để build Maven/Vite không bị kill"
    fallocate -l "${size}G" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=$(( size * 1024 ))
    chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
}

firewall() {
  if command -v ufw >/dev/null 2>&1; then
    say "Mở cổng 22, 80, 443 trên ufw"
    ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
    ufw --force enable >/dev/null || true
  fi
}

setval() { # setval KEY VALUE → ghi vào .env.prod
  if grep -q "^$1=" "$ENV"; then sed -i "s|^$1=.*|$1=$2|" "$ENV"; else echo "$1=$2" >> "$ENV"; fi
}
getval() { grep "^$1=" "$ENV" | head -1 | cut -d= -f2-; }

configure() {
  [ -f "$ENV" ] || cp .env.prod.example "$ENV"
  chmod 600 "$ENV"
  if [ "$(getval PUBLIC_URL)" = "http://YOUR_VPS_IP" ] || [ -z "$(getval PUBLIC_URL)" ]; then
    local ip; ip=$(curl -fs4 https://api.ipify.org || hostname -I | awk '{print $1}')
    read -rp "Tên miền đã trỏ về $ip (Enter để bỏ qua, chạy HTTP theo IP): " domain
    if [ -n "$domain" ]; then
      setval SITE_ADDRESS "$domain"; setval PUBLIC_URL "https://$domain"
    else
      setval SITE_ADDRESS ":80"; setval PUBLIC_URL "http://$ip"
    fi
  fi
  for k in DB_PASSWORD REDIS_PASSWORD MINIO_SECRET_KEY; do [ -n "$(getval $k)" ] || setval "$k" "$(rand 28)"; done
  [ -n "$(getval JWT_SECRET)" ] || setval JWT_SECRET "$(rand 64)"
  if [ -z "$(getval MAILPIT_HASH)" ]; then
    local pw; pw=$(rand 14)
    # nháy đơn: compose không nội suy ký tự $ trong hash bcrypt
    setval MAILPIT_HASH "'$(docker run --rm caddy:2.8-alpine caddy hash-password --plaintext "$pw")'"
    echo "$pw" > .mailpit-password && chmod 600 .mailpit-password
  fi
}

wait_ready() {
  local url; url=$(getval PUBLIC_URL)
  say "Chờ hệ thống sẵn sàng (lần đầu build mất 5–15 phút)…"
  for _ in $(seq 1 90); do
    if curl -fsk "$url/api/v1/settings" >/dev/null 2>&1 || curl -fs -H "Host: $(getval SITE_ADDRESS)" http://127.0.0.1/api/v1/settings >/dev/null 2>&1; then
      echo; say "Xong!"; summary; return 0
    fi
    printf '.'; sleep 10
  done
  echo; echo "Chưa lên sau 15 phút. Xem log: sudo bash deploy.sh logs"; exit 1
}

summary() {
  local url; url=$(getval PUBLIC_URL)
  cat <<MSG

  Web             : $url
  Lễ tân          : $url/staff/front-desk   (letan@aureliaresort.vn / Letan@123)
  Quản trị        : $url/admin/dashboard    (admin@aureliaresort.vn / Admin@123)
  Hộp thư thử     : $url/mailpit            (user: $(getval MAILPIT_USER), mật khẩu trong deploy/.mailpit-password)
  Sao lưu CSDL    : deploy/backups (02:00 hằng ngày)

  ⚠ Đổi mật khẩu 3 tài khoản mẫu ngay sau khi đăng nhập.
MSG
}

case "${1:-install}" in
  install)
    need_root
    install_docker; check_disk; ensure_swap; firewall; configure
    say "Build và khởi động"
    $DC up -d --build
    wait_ready ;;
  update)
    need_root
    $DC build && $DC up -d
    docker image prune -f >/dev/null
    wait_ready ;;
  status) $DC ps ;;
  logs) $DC logs -f --tail 200 "${2:-api}" ;;
  backup)
    f="backups/manual-$(date +%F-%H%M).sql.gz"; mkdir -p backups
    $DC exec -T postgres pg_dump -U "$(getval DB_USER)" "$(getval DB_NAME)" | gzip > "$f" && echo "Đã lưu $f" ;;
  restore)
    [ -f "${2:-}" ] || { echo "Dùng: sudo bash deploy.sh restore backups/xxx.sql.gz"; exit 1; }
    gunzip -c "$2" | $DC exec -T postgres psql -U "$(getval DB_USER)" "$(getval DB_NAME)" ;;
  down) $DC down ;;
  *) echo "Lệnh: install | update | status | logs [service] | backup | restore <file> | down"; exit 1 ;;
esac
