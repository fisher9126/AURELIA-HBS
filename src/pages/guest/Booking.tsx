import { useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Lock, Tag } from 'lucide-react';
import { useQuote, useRoomType } from '@/api/catalog';
import { useCreateBooking } from '@/api/bookings';
import { useTiers, validatePromo } from '@/api/admin';
import { useAuth } from '@/auth/AuthContext';
import { Alert, Button, EmptyState, Field, Input, Select, Spinner, Textarea } from '@/components/ui';
import { RoomImage } from '@/components/RoomImage';
import { Money } from '@/components/Money';
import { ApiError } from '@/lib/api';
import { dmy, pct, weekday } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/utils';
import type { PlanCode } from '@/lib/types';
import { useStayParams } from './stay';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên'),
  phone: z.string().regex(/^(\+?84|0)\d{9,10}$/, 'Số điện thoại không hợp lệ'),
  email: z.string().email('Email không hợp lệ'),
  nationality: z.string().length(2),
  estimatedArrival: z.string().optional(),
  bedPreference: z.enum(['KING', 'TWIN']),
  specialRequests: z.string().max(500).optional(),
  agree: z.literal(true, { errorMap: () => ({ message: 'Bạn cần đồng ý điều khoản' }) }),
});
type Form = z.infer<typeof schema>;
const QUICK = ['Tầng cao', 'Nôi em bé', 'Trang trí kỷ niệm', 'Dị ứng thực phẩm', 'Trả phòng muộn'];

/** nhập thông tin, mã khuyến mãi, xác nhận. Gửi kèm Idempotency-Key. */
export default function Booking() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'vi';
  const location = useLocation();
  const navigate = useNavigate();
  const { user, status } = useAuth();
  const [stay, , params] = useStayParams();
  const roomTypeId = params.get('roomTypeId') ?? undefined;
  const planCode = (params.get('plan') ?? 'EP') as PlanCode;
  const { data: rt } = useRoomType(roomTypeId);
  const { data: tiers } = useTiers();
  const [promoInput, setPromoInput] = useState(params.get('promo') ?? '');
  const [promo, setPromo] = useState<string | undefined>();
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const idemKey = useRef(newIdempotencyKey('booking'));
  const quote = useQuote(roomTypeId ? { roomTypeId, planCode, ...stay, promoCode: promo } : null);
  const create = useCreateBooking();
  const plan = rt?.plans.find((p) => p.planCode === planCode);

  const defaults = useMemo<Partial<Form>>(
    () => ({ fullName: user?.fullName ?? '', phone: user?.phone ?? '', email: user?.email ?? '', nationality: 'VN', bedPreference: 'KING', estimatedArrival: '14:00' }),
    [user],
  );
  const { register, handleSubmit, formState, setValue, getValues } = useForm<Form>({ resolver: zodResolver(schema), values: defaults as Form });
  const e = formState.errors;

  if (!roomTypeId) return <div className="py-24"><EmptyState title={t('book.missing')} action={<Link to="/rooms" className="font-semibold text-gold">{t('nav.rooms')} →</Link>} /></div>;
  if (status === 'loading') return <Spinner className="min-h-[50vh]" />;
  if (!user) {
    const rt = encodeURIComponent(location.pathname + location.search);
    return (
      <div className="mx-auto max-w-lg py-24">
        <div className="card p-10 text-center">
          <Lock className="mx-auto size-8 text-gold" />
          <h1 className="mt-4 font-display text-3xl">{t('book.signInToBook')}</h1>
          <p className="mt-2 text-muted">{t('book.signInText')}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="navy" onClick={() => navigate(`/auth/login?returnTo=${rt}`)}>{t('nav.signIn')}</Button>
            <Button variant="line" onClick={() => navigate(`/auth/register?returnTo=${rt}`)}>{t('auth.createOne')}</Button>
          </div>
        </div>
      </div>
    );
  }

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await validatePromo({ code, checkIn: stay.checkIn, checkOut: stay.checkOut, roomAmount: quote.data?.roomAmount });
      if (r.valid) {
        setPromo(code);
        setPromoMsg({ ok: true, text: `${t('book.promoApplied', { code })} — ${r.description ?? ''}` });
      } else {
        setPromo(undefined);
        setPromoMsg({ ok: false, text: r.reason ?? 'Mã không hợp lệ' });
      }
    } catch (err) {
      setPromoMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Không kiểm tra được mã' });
    }
  };

  const onSubmit = handleSubmit(async (v) => {
    setSubmitError(null);
    try {
      const b = await create.mutateAsync({
        key: idemKey.current,
        body: {
          roomTypeId,
          planCode,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          adults: stay.adults,
          children: stay.children,
          guest: { fullName: v.fullName, phone: v.phone, email: v.email, nationality: v.nationality },
          estimatedArrival: v.estimatedArrival || undefined,
          bedPreference: v.bedPreference,
          specialRequests: v.specialRequests || undefined,
          promoCode: promo,
        },
      });
      navigate(`/booking/${b.id}/confirmation`, { replace: true });
    } catch (err) {
      // Lỗi nghiệp vụ (hết phòng, mã hết hạn…) → tạo khóa mới cho lần gửi sau
      idemKey.current = newIdempotencyKey('booking');
      setSubmitError(err instanceof ApiError ? err.message : 'Không đặt được phòng, vui lòng thử lại.');
    }
  });

  const q = quote.data;
  return (
    <div className="bg-sand py-12">
      <div className="mx-auto max-w-[1200px] px-6">
        <p className="eyebrow flex items-center gap-2"><Lock className="size-3.5" /> Secure checkout</p>
        <h1 className="mt-2 font-display text-[44px]">{t('book.title')}</h1>

        <form onSubmit={onSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]" noValidate>
          <div className="flex flex-col gap-6">
            <section className="card p-7">
              <h2 className="font-display text-[26px]">{t('book.guestInfo')}</h2>
              <p className="mt-1 text-[13.5px] text-muted">Đăng nhập với {user.email}</p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field label={t('book.fullName')} required error={e.fullName?.message} className="sm:col-span-2">
                  {(id) => <Input id={id} {...register('fullName')} />}
                </Field>
                <Field label={t('book.email')} required error={e.email?.message}>
                  {(id) => <Input id={id} type="email" {...register('email')} />}
                </Field>
                <Field label={t('book.phone')} required error={e.phone?.message}>
                  {(id) => <Input id={id} type="tel" {...register('phone')} />}
                </Field>
                <Field label="Quốc tịch / Nationality">
                  {(id) => (
                    <Select id={id} {...register('nationality')}>
                      {[['VN', 'Việt Nam'], ['US', 'United States'], ['GB', 'United Kingdom'], ['KR', 'Korea'], ['JP', 'Japan'], ['CN', 'China'], ['AU', 'Australia'], ['FR', 'France'], ['DE', 'Germany'], ['SG', 'Singapore']].map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label={t('book.arrival')}>
                  {(id) => (
                    <Select id={id} {...register('estimatedArrival')}>
                      {['12:00', '14:00', '16:00', '18:00', '20:00', '22:00'].map((h) => <option key={h} value={h}>{h}</option>)}
                    </Select>
                  )}
                </Field>
              </div>
            </section>

            <section className="card p-7">
              <h2 className="font-display text-[26px]">{t('book.requests')}</h2>
              <p className="label mt-5 mb-2">{t('book.bed')}</p>
              <div className="flex gap-3">
                {(['KING', 'TWIN'] as const).map((b) => (
                  <label key={b} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-4 py-3 has-[:checked]:border-gold has-[:checked]:bg-gold-soft">
                    <input type="radio" value={b} {...register('bedPreference')} className="accent-[#CC7A2E]" /> {b === 'KING' ? t('book.king') : t('book.twin')}
                  </label>
                ))}
              </div>
              <Field label={t('book.requests')} className="mt-5" error={e.specialRequests?.message}>
                {(id) => <Textarea id={id} placeholder={t('book.requestsPh')} {...register('specialRequests')} />}
              </Field>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK.map((qk) => (
                  <button key={qk} type="button" className="rounded-full border border-line px-3 py-1.5 text-[12.5px] hover:border-gold"
                    onClick={() => setValue('specialRequests', [getValues('specialRequests'), qk].filter(Boolean).join(', '))}>
                    + {qk}
                  </button>
                ))}
              </div>
            </section>

            <section className="card p-7">
              <h2 className="font-display text-[26px]">{t('book.policy')}</h2>
              <table className="tbl mt-4">
                <thead><tr><th>Thời điểm hủy</th><th className="text-right">Phí</th></tr></thead>
                <tbody>
                  {(tiers ?? []).map((tr) => (
                    <tr key={tr.hoursFrom}>
                      <td>{tr.description ?? `${tr.hoursFrom}h – ${tr.hoursTo ?? '∞'}h trước giờ nhận phòng`}</td>
                      <td className="text-right font-semibold">{pct(tr.penaltyPercent, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <label className="mt-5 flex items-start gap-3 text-[14px]">
                <input type="checkbox" {...register('agree')} className="mt-1 size-4 accent-[#CC7A2E]" />
                <span>Tôi đã đọc và đồng ý với <Link to="/policies#terms" className="text-gold underline">điều khoản đặt phòng</Link> và chính sách hủy.</span>
              </label>
              {e.agree && <p className="mt-1 text-[12.5px] text-bad-d">{e.agree.message}</p>}
            </section>
          </div>

          <aside className="card sticky top-28 h-fit overflow-hidden">
            <RoomImage src={rt?.images.find((i) => i.cover)?.url} slug={rt?.slug} alt={rt?.name ?? ''} className="h-40" />
            <div className="flex flex-col gap-4 p-6">
              <div>
                <h3 className="font-display text-[26px] leading-tight">{rt?.name}</h3>
                <p className="text-[13.5px] text-muted">{planCode} — {plan?.planName}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-mist p-4 text-[13.5px]">
                <div><p className="label text-[10.5px]">{t('common.checkIn')}</p><p className="font-semibold">{weekday(stay.checkIn, lang)}, {dmy(stay.checkIn)}</p></div>
                <div><p className="label text-[10.5px]">{t('common.checkOut')}</p><p className="font-semibold">{weekday(stay.checkOut, lang)}, {dmy(stay.checkOut)}</p></div>
                <div className="col-span-2 text-ink2">{t('common.adultsCount', { count: stay.adults })}, {t('common.childrenCount', { count: stay.children })}</div>
              </div>

              <div>
                <p className="label mb-2 flex items-center gap-1"><Tag className="size-3.5" /> {t('book.promo')}</p>
                <div className="flex gap-2">
                  <Input compact value={promoInput} onChange={(ev) => setPromoInput(ev.target.value.toUpperCase())} placeholder="EARLY15" className="font-mono" />
                  <Button size="sm" variant="line" onClick={applyPromo} className="h-10">{t('book.apply')}</Button>
                </div>
                {promoMsg && <p className={promoMsg.ok ? 'mt-2 text-[12.5px] text-ok-d' : 'mt-2 text-[12.5px] text-bad-d'}>{promoMsg.text}</p>}
              </div>

              {quote.isLoading ? <Spinner /> : q ? (
                <div className="flex flex-col gap-2 border-t border-line pt-4 text-[14px] text-ink2">
                  <p className="flex justify-between"><span>{t('common.roomAmount')} · {t('common.nights', { count: q.nights })}</span><Money value={q.roomAmount} /></p>
                  {q.discountAmount > 0 && <p className="flex justify-between text-ok-d"><span>{t('common.discount')}</span><Money value={-q.discountAmount} /></p>}
                  <p className="flex justify-between"><span>{t('common.serviceFee')} ({pct(q.serviceRate)})</span><Money value={q.serviceFee} /></p>
                  <p className="flex justify-between"><span>{t('common.vat')} ({pct(q.vatRate)})</span><Money value={q.taxAmount} /></p>
                  <p className="mt-2 flex justify-between border-t border-line pt-3 text-[18px] font-semibold text-ink"><span>{t('common.total')}</span><Money value={q.totalAmount} /></p>
                </div>
              ) : quote.error ? <Alert tone="bad">{(quote.error as Error).message}</Alert> : null}

              {submitError && <Alert tone="bad">{submitError}</Alert>}
              <Button type="submit" size="lg" loading={create.isPending} disabled={!q}>{t('book.confirm')}</Button>
              <p className="text-center text-[12.5px] text-muted">{t('book.payAtHotel')}</p>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
