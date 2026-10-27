import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Download, Wallet } from 'lucide-react';
import { useBooking, useOnlinePayment } from '@/api/bookings';
import { openPdf } from '@/api/admin';
import { Alert, Button, ErrorState, Spinner, useToast } from '@/components/ui';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { Money } from '@/components/Money';
import { dmy, weekday } from '@/lib/format';

/** xác nhận, mã QR nhận phòng, voucher PDF, thanh toán VNPay/MoMo. */
export default function Confirmation() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'vi';
  const toast = useToast();
  const { data: b, isLoading, error, refetch } = useBooking(id);
  const pay = useOnlinePayment();

  if (isLoading) return <Spinner className="min-h-[60vh]" />;
  if (error || !b) return <div className="py-24"><ErrorState error={error} onRetry={refetch} /></div>;
  const canPay = b.paymentStatus !== 'PAID' && ['PENDING', 'CONFIRMED'].includes(b.status);

  return (
    <div className="bg-sand py-16">
      <div className="mx-auto max-w-[920px] px-6">
        <div className="text-center">
          <CheckCircle2 className="mx-auto size-14 text-ok" />
          <h1 className="mt-4 font-display text-[48px]">{t('confirm.title')}</h1>
          <p className="mt-2 text-muted">{t('confirm.lead', { name: b.guest.fullName })}</p>
        </div>

        <div className="card mt-10 grid overflow-hidden md:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-5 p-8">
            <div className="flex flex-wrap items-center gap-3">
              <p className="label">{t('confirm.ref')}</p>
              <span className="font-mono text-[22px] font-semibold tracking-wider text-gold">{b.bookingRef}</span>
              <BookingStatusBadge status={b.status} />
              <PaymentStatusBadge status={b.paymentStatus} />
            </div>
            <div>
              <h2 className="font-display text-[30px]">{b.room.roomTypeName}</h2>
              <p className="text-[14px] text-muted">Phòng {b.room.roomNumber} · {b.plan.code} — {b.plan.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-mist p-5 text-[14px]">
              <div><p className="label text-[10.5px]">{t('common.checkIn')}</p><p className="font-semibold">{weekday(b.checkInDate, lang)}, {dmy(b.checkInDate)}</p></div>
              <div><p className="label text-[10.5px]">{t('common.checkOut')}</p><p className="font-semibold">{weekday(b.checkOutDate, lang)}, {dmy(b.checkOutDate)}</p></div>
              <div>{t('common.nights', { count: b.nights })}</div>
              <div>{t('common.adultsCount', { count: b.adults })}, {t('common.childrenCount', { count: b.children })}</div>
            </div>
            <div className="flex flex-col gap-1.5 text-[14px] text-ink2">
              <p className="flex justify-between"><span>{t('common.roomAmount')}</span><Money value={b.roomAmount} /></p>
              {b.discountAmount > 0 && <p className="flex justify-between text-ok-d"><span>{t('common.discount')}</span><Money value={-b.discountAmount} /></p>}
              <p className="flex justify-between"><span>{t('common.serviceFee')}</span><Money value={b.serviceFee} /></p>
              <p className="flex justify-between"><span>{t('common.vat')}</span><Money value={b.taxAmount} /></p>
              <p className="mt-1 flex justify-between border-t border-line pt-3 text-[18px] font-semibold text-ink"><span>{t('common.total')}</span><Money value={b.totalAmount} /></p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 bg-navy p-8 text-center text-white">
            <div className="rounded-2xl bg-white p-4"><QRCodeSVG value={b.qrPayload || b.bookingRef} size={180} level="M" /></div>
            <p className="text-[13px] text-white/75">{t('confirm.showQr')}</p>
          </div>
        </div>

        {canPay && (
          <div className="card mt-6 p-7">
            <h3 className="flex items-center gap-2 font-display text-[24px]"><Wallet className="size-5 text-gold" /> {t('confirm.payNow')}</h3>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="navy" loading={pay.isPending && pay.variables?.gateway === 'VNPAY'} onClick={() => pay.mutate({ bookingId: b.id, gateway: 'VNPAY' }, { onError: (e) => toast.error(e) })}>
                {t('confirm.payVnpay')}
              </Button>
              <Button variant="line" className="border-[#A50064] text-[#A50064]" loading={pay.isPending && pay.variables?.gateway === 'MOMO'} onClick={() => pay.mutate({ bookingId: b.id, gateway: 'MOMO' }, { onError: (e) => toast.error(e) })}>
                {t('confirm.payMomo')}
              </Button>
            </div>
          </div>
        )}
        {b.status === 'CANCELLED' && <Alert tone="bad" className="mt-6">Đặt phòng đã bị hủy.</Alert>}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="line" onClick={() => openPdf(`/bookings/${b.id}/voucher.pdf`).catch(toast.error)}><Download className="size-4" /> {t('confirm.voucher')}</Button>
          <Link to="/my-bookings" className="inline-flex h-12 items-center rounded-xl bg-navy px-6 font-semibold text-white">{t('confirm.manage')}</Link>
        </div>
      </div>
    </div>
  );
}
