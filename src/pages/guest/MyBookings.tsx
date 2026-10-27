import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Download, Luggage } from 'lucide-react';
import { useBookingActions, useCancellationQuote, useMyBookings } from '@/api/bookings';
import { openPdf } from '@/api/admin';
import { Alert, Button, EmptyState, ErrorState, Field, Modal, Select, Spinner, Tabs, Textarea, useToast } from '@/components/ui';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';
import { RoomImage } from '@/components/RoomImage';
import { Money } from '@/components/Money';
import { CANCEL_REASON } from '@/lib/labels';
import { dmy, pct } from '@/lib/format';
import type { Booking, CancelReason } from '@/lib/types';

type Tab = 'upcoming' | 'completed' | 'cancelled';

/** danh sách đặt phòng của khách, hủy kèm báo phí theo bậc. */
export default function MyBookings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('upcoming');
  const { data, isLoading, error, refetch } = useMyBookings(tab);
  const [cancelling, setCancelling] = useState<Booking | null>(null);

  return (
    <div className="bg-sand py-14">
      <div className="mx-auto max-w-[1000px] px-6">
        <h1 className="font-display text-[44px]">{t('my.title')}</h1>
        <Tabs
          className="mt-6"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'upcoming', label: t('my.upcoming') },
            { value: 'completed', label: t('my.completed') },
            { value: 'cancelled', label: t('my.cancelled') },
          ]}
        />
        <div className="mt-6 flex flex-col gap-5">
          {isLoading ? <Spinner /> : error ? <ErrorState error={error} onRetry={refetch} /> : !data?.length ? (
            <div className="card">
              <EmptyState icon={<Luggage className="size-6" />} title={t('my.empty')} text={t('my.emptyText')} action={<Button onClick={() => navigate('/rooms')}>{t('nav.bookNow')}</Button>} />
            </div>
          ) : (
            data.map((b) => (
              <article key={b.id} className="card grid overflow-hidden md:grid-cols-[220px_1fr]">
                <RoomImage slug={b.room.roomTypeName.toLowerCase().replace(/\s+/g, '-')} alt={b.room.roomTypeName} className="h-full min-h-[160px]" />
                <div className="flex flex-col gap-3 p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-gold">{b.bookingRef}</span>
                    <BookingStatusBadge status={b.status} />
                    <PaymentStatusBadge status={b.paymentStatus} />
                  </div>
                  <h2 className="font-display text-[26px] leading-tight">{b.room.roomTypeName}</h2>
                  <p className="flex items-center gap-2 text-[14px] text-ink2">
                    <CalendarDays className="size-4 text-gold" /> {dmy(b.checkInDate)} → {dmy(b.checkOutDate)} · {t('common.nights', { count: b.nights })} · {b.plan.code}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line2 pt-4">
                    <p className="text-[18px] font-semibold"><Money value={b.totalAmount} /></p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="line" onClick={() => openPdf(`/bookings/${b.id}/voucher.pdf`).catch((e) => toast.error(e))}><Download className="size-4" /> {t('my.voucher')}</Button>
                      <Link to={`/booking/${b.id}/confirmation`} className="inline-flex h-9 items-center rounded-xl bg-navy px-4 text-[13px] font-semibold text-white">{t('common.viewDetails')}</Link>
                      {['PENDING', 'CONFIRMED'].includes(b.status) && (
                        <Button size="sm" variant="danger" onClick={() => setCancelling(b)}>{t('my.cancel')}</Button>
                      )}
                    </div>
                  </div>
                  {b.status === 'CANCELLED' && b.refundAmount > 0 && <p className="text-[13px] text-muted">{t('my.refund')}: <Money value={b.refundAmount} /></p>}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
      {cancelling && <CancelModal booking={cancelling} onClose={() => setCancelling(null)} />}
    </div>
  );
}

function CancelModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { data: q, isLoading, error } = useCancellationQuote(booking.id);
  const { cancel } = useBookingActions();
  const [reason, setReason] = useState<CancelReason>('CHANGE_OF_PLANS');
  const [note, setNote] = useState('');

  return (
    <Modal
      open
      onClose={onClose}
      title={t('my.cancelTitle', { ref: booking.bookingRef })}
      footer={
        <>
          <Button variant="line" size="sm" onClick={onClose}>{t('common.back')}</Button>
          <Button
            variant="danger"
            size="sm"
            loading={cancel.isPending}
            disabled={!q}
            onClick={() =>
              cancel.mutate(
                { id: booking.id, reason, note: note || undefined },
                { onSuccess: () => { toast.success(t('my.cancelled_ok')); onClose(); }, onError: (e) => toast.error(e) },
              )
            }
          >
            {t('my.confirmCancel')}
          </Button>
        </>
      }
    >
      {isLoading ? <Spinner /> : error ? <ErrorState error={error} /> : q && (
        <div className="flex flex-col gap-4">
          <Alert tone={q.penaltyPercent === 0 ? 'ok' : q.penaltyPercent >= 100 ? 'bad' : 'gold'}>
            {t('my.hoursLeft', { count: Math.max(0, Math.floor(q.hoursBeforeCheckIn)) })} · {q.tierDescription ?? `Phí ${pct(q.penaltyPercent, 0)}`}
          </Alert>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-mist p-3"><p className="label text-[10.5px]">{t('common.total')}</p><p className="font-semibold"><Money value={q.totalAmount} /></p></div>
            <div className="rounded-xl bg-bad-soft p-3"><p className="label text-[10.5px]">{t('my.fee')} ({pct(q.penaltyPercent, 0)})</p><p className="font-semibold text-bad-d"><Money value={q.cancellationFee} /></p></div>
            <div className="rounded-xl bg-ok-soft p-3"><p className="label text-[10.5px]">{t('my.refund')}</p><p className="font-semibold text-ok-d"><Money value={q.refundAmount} /></p></div>
          </div>
          <Field label={t('my.reason')}>
            {(id) => (
              <Select id={id} value={reason} onChange={(e) => setReason(e.target.value as CancelReason)}>
                {Object.entries(CANCEL_REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            )}
          </Field>
          <Field label={t('my.note')}>{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />}</Field>
        </div>
      )}
    </Modal>
  );
}
