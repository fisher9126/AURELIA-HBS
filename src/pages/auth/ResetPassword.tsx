import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field, Input, useToast } from '@/components/ui';
import { ApiError, post } from '@/lib/api';
import { AuthHeading, PASSWORD_RE } from './shared';

const schema = z
  .object({ newPassword: z.string().regex(PASSWORD_RE, 'Tối thiểu 8 ký tự, gồm chữ và số'), confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp' });
type Form = z.infer<typeof schema>;

export default function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState<string | null>(token ? null : 'Liên kết không hợp lệ hoặc đã hết hạn.');
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await post('/auth/reset-password', { token, newPassword: v.newPassword });
      toast.success(t('auth.resetDone'));
      navigate('/auth/login', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không đổi được mật khẩu.');
    }
  });

  return (
    <>
      <AuthHeading title={t('auth.resetTitle')} />
      {error && <Alert tone="bad" className="mb-5">{error}</Alert>}
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field label={t('auth.newPassword')} error={formState.errors.newPassword?.message} hint={t('auth.passwordHint')}>
          {(id) => <Input id={id} type="password" autoComplete="new-password" {...register('newPassword')} />}
        </Field>
        <Field label="Nhập lại mật khẩu / Confirm" error={formState.errors.confirm?.message}>
          {(id) => <Input id={id} type="password" autoComplete="new-password" {...register('confirm')} />}
        </Field>
        <Button type="submit" variant="navy" disabled={!token} loading={formState.isSubmitting}>{t('auth.save')}</Button>
      </form>
      <p className="mt-8 text-center"><Link to="/auth/login" className="text-[14px] font-medium text-gold hover:underline">← {t('auth.backToSignIn')}</Link></p>
    </>
  );
}
