#!/usr/bin/env bash
# Smoke test sau khi deploy (staging/production): kiểm tra nhanh các luồng sống còn, thoát mã 1 nếu có bước lỗi.
#   ./scripts/smoke.sh                      # mặc định http://localhost:8080
#   API=https://api.aureliaresort.vn ./scripts/smoke.sh
# Cần: bash, curl. Tạo 1 đặt phòng thử ở ngày +400 rồi hủy ngay (Admin miễn phí hủy).
set -u
API="${API:-http://localhost:8080}"
BASE="$API/api/v1"
STAFF_EMAIL="${STAFF_EMAIL:-letan@aureliaresort.vn}"
STAFF_PASSWORD="${STAFF_PASSWORD:-Letan@123}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@aureliaresort.vn}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@123}"
FAIL=0
pass() { printf '  \033[32m✔\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✘\033[0m %s\n' "$1"; FAIL=1; }
# giá trị chuỗi đầu tiên của trường JSON (đủ dùng cho smoke test, không cần jq)
field() { grep -o "\"$1\":\"[^\"]*\"" | head -1 | sed 's/^.*":"\(.*\)"$/\1/'; }
day() { date -d "+$1 day" +%F 2>/dev/null || date -v+"$1"d +%F; }

echo "Smoke test $BASE"

code=$(curl -s -o /tmp/smoke_health -w '%{http_code}' "$API/actuator/health")
[ "$code" = 200 ] && grep -q '"UP"' /tmp/smoke_health && pass "health UP" || fail "health ($code)"

code=$(curl -s -o /tmp/smoke_rt -w '%{http_code}' "$BASE/room-types")
[ "$code" = 200 ] && grep -q 'luxury-suite' /tmp/smoke_rt && pass "danh sách loại phòng" || fail "room-types ($code)"

IN=$(day 400); OUT=$(day 402)
code=$(curl -s -o /tmp/smoke_av -w '%{http_code}' "$BASE/rooms/available?checkIn=$IN&checkOut=$OUT&adults=2")
[ "$code" = 200 ] && grep -q 'roomTypeId' /tmp/smoke_av && pass "tìm phòng trống $IN → $OUT" || fail "available ($code)"

login() {
  curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | field accessToken
}
STAFF=$(login "$STAFF_EMAIL" "$STAFF_PASSWORD"); [ -n "$STAFF" ] && pass "lễ tân đăng nhập" || fail "đăng nhập lễ tân"
ADMIN=$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD"); [ -n "$ADMIN" ] && pass "admin đăng nhập" || fail "đăng nhập admin"

BODY="{\"roomTypeId\":\"00000000-0000-0000-0000-0000000000c3\",\"planCode\":\"EP\",\"checkIn\":\"$IN\",\"checkOut\":\"$OUT\",\"adults\":1,\"guest\":{\"fullName\":\"Smoke Test\",\"phone\":\"0900000001\"}}"
code=$(curl -s -o /tmp/smoke_bk -w '%{http_code}' -X POST "$BASE/bookings" -H "Authorization: Bearer $STAFF" \
  -H 'Content-Type: application/json' -H "Idempotency-Key: smoke-$(date +%s)" -d "$BODY")
ID=$(field id < /tmp/smoke_bk); REF=$(field bookingRef < /tmp/smoke_bk)
[ "$code" = 201 ] && [ -n "$ID" ] && pass "tạo đặt phòng $REF" || fail "tạo đặt phòng ($code) $(cat /tmp/smoke_bk)"

if [ -n "${ID:-}" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/bookings/calendar?from=$IN&to=$OUT" -H "Authorization: Bearer $STAFF")
  [ "$code" = 200 ] && pass "lịch đặt phòng" || fail "calendar ($code)"
  code=$(curl -s -o /tmp/smoke_v.pdf -w '%{http_code}' "$BASE/bookings/$ID/voucher.pdf" -H "Authorization: Bearer $STAFF")
  [ "$code" = 200 ] && head -c 4 /tmp/smoke_v.pdf | grep -q '%PDF' && pass "voucher PDF" || fail "voucher ($code)"
  code=$(curl -s -o /tmp/smoke_c -w '%{http_code}' -X PATCH "$BASE/bookings/$ID/cancel" -H "Authorization: Bearer $ADMIN" \
    -H 'Content-Type: application/json' -d '{"reason":"OTHER","note":"smoke test","waiveFee":true}')
  [ "$code" = 200 ] && grep -q '"CANCELLED"' /tmp/smoke_c && pass "hủy đặt phòng thử" || fail "hủy ($code)"
fi

code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/staff" -H "Authorization: Bearer $STAFF")
[ "$code" = 403 ] && pass "phân quyền: lễ tân không vào /staff" || fail "phân quyền /staff ($code)"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/bookings")
[ "$code" = 401 ] && pass "chưa đăng nhập bị chặn" || fail "401 ($code)"

rm -f /tmp/smoke_*
[ $FAIL = 0 ] && echo "SMOKE PASS" || { echo "SMOKE FAIL"; exit 1; }
