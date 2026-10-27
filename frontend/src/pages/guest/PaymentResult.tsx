import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { findByRef } from '@/api/bookings';
import { useAuth } from '@/auth/AuthContext';

/** Trang khách quay về sau VNPay/MoMo: /payment-result?status=success|failed|invalid&ref=AUR-… */
export default function PaymentResult() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const status = params.get('status') ?? 'invalid';
  const ref = params.get('ref') ?? '';
  const { user } = useAuth();
  const { data: booking } = useQuery({ queryKey: ['booking-ref', ref], queryFn: () => findByRef(ref), enabled: !!ref && !!user && user.role !== 'GUEST', retry: false });
  const Icon = status === 'success' ? CheckCircle2 : status === 'failed' ? XCircle : ShieldAlert;
  const color = status === 'success' ? 'text-ok' : status === 'failed' ? 'text-bad' : 'text-dirty';

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-sand px-6 py-20">
      <div className="card max-w-lg p-10 text-center">
        <Icon className={`mx-auto size-14 ${color}`} />
        <h1 className="mt-4 font-display text-[36px]">
          {status === 'success' ? t('pay.success') : status === 'failed' ? t('pay.failed') : t('pay.invalid')}
        </h1>
        <p className="mt-3 text-muted">{status === 'success' ? t('pay.successText', { ref }) : t('pay.failedText')}</p>
        {ref && <p className="mt-4 font-mono text-[18px] font-semibold text-gold">{ref}</p>}
        <div className="mt-8 flex justify-center gap-3">
          <Link to={booking ? `/staff/bookings/${booking.id}` : '/my-bookings'} className="inline-flex h-12 items-center rounded-xl bg-navy px-6 font-semibold text-white">{t('confirm.manage')}</Link>
          <Link to="/" className="inline-flex h-12 items-center rounded-xl border border-slate-300 px-6 font-semibold">Trang chủ</Link>
        </div>
      </div>
    </div>
  );
}
