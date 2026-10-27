import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { MailCheck } from 'lucide-react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { post } from '@/lib/api';
import { AuthHeading } from './shared';

const schema = z.object({ email: z.string().email('Email không hợp lệ') });

/** AUTH-04: luôn trả cùng thông báo để không lộ email nào đã đăng ký. */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch {
      setError('Không gửi được yêu cầu, vui lòng thử lại.');
    }
  });

  return (
    <>
      <AuthHeading title={t('auth.forgotTitle')} lead={t('auth.forgotLead')} />
      {sent ? (
        <Alert tone="ok"><span className="flex items-center gap-2"><MailCheck className="size-5" /> {t('auth.sent')}</span></Alert>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          {error && <Alert tone="bad">{error}</Alert>}
          <Field label={t('auth.email')} error={formState.errors.email?.message}>
            {(id) => <Input id={id} type="email" autoComplete="email" {...register('email')} />}
          </Field>
          <Button type="submit" variant="navy" loading={formState.isSubmitting}>{t('auth.send')}</Button>
        </form>
      )}
      <p className="mt-8 text-center"><Link to="/auth/login" className="text-[14px] font-medium text-gold hover:underline">← {t('auth.backToSignIn')}</Link></p>
    </>
  );
}
