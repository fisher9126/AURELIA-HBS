import { useTiers, useSettings } from '@/api/admin';
import { pct } from '@/lib/format';

export default function Policies() {
  const { data: tiers } = useTiers();
  const { data: s } = useSettings();
  return (
    <div className="mx-auto max-w-[860px] px-6 py-16 text-[15.5px] leading-relaxed text-ink2">
      <h1 className="font-display text-[48px] text-ink">Chính sách & điều khoản</h1>
      <section id="cancellation" className="mt-10">
        <h2 className="font-display text-[30px] text-ink">Chính sách hủy</h2>
        <table className="tbl mt-4">
          <thead><tr><th>Thời điểm hủy (trước giờ nhận phòng)</th><th className="text-right">Phí hủy</th></tr></thead>
          <tbody>
            {tiers?.map((t) => (
              <tr key={t.hoursFrom}><td>{t.description ?? `${t.hoursFrom}h – ${t.hoursTo ?? '∞'}h`}</td><td className="text-right font-semibold">{pct(t.penaltyPercent, 0)}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3">Không đến (no-show) tính 100% giá trị đặt phòng. Tiền hoàn trả về phương thức thanh toán ban đầu trong 5–7 ngày làm việc.</p>
      </section>
      <section id="terms" className="mt-10">
        <h2 className="font-display text-[30px] text-ink">Điều khoản đặt phòng</h2>
        <p className="mt-3 whitespace-pre-line">{s?.termsText ?? `Nhận phòng từ ${s?.checkInTime?.slice(0, 5) ?? '14:00'}, trả phòng trước ${s?.checkOutTime?.slice(0, 5) ?? '12:00'}. Khách xuất trình CCCD hoặc hộ chiếu khi nhận phòng.`}</p>
        <p className="mt-3">Giá đã gồm phí dịch vụ {pct(s?.serviceRate)} và VAT {pct(s?.vatRate)}.</p>
      </section>
      <section id="privacy" className="mt-10">
        <h2 className="font-display text-[30px] text-ink">Quyền riêng tư</h2>
        <p className="mt-3">Aurelia chỉ dùng thông tin cá nhân để xử lý đặt phòng, khai báo lưu trú theo quy định và gửi xác nhận. Số giấy tờ tùy thân được che khi hiển thị và chỉ nhân viên được phân quyền mới xem đầy đủ. Dữ liệu thanh toán thẻ không lưu trên hệ thống — giao dịch do VNPay/MoMo xử lý.</p>
      </section>
    </div>
  );
}
