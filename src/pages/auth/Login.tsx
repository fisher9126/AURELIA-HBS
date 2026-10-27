import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { homeFor, useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/lib/api';
import { AuthHeading, SocialButtons } from './shared';

const schema = z.object({ email: z.string().email('Email không hợp lệ'), password: z.string().min(1, 'Vui lòng nhập mật khẩu') });
type Form = z.infer<typeof schema>;

/** AUTH-02: đăng nhập; khóa 15 phút sau 5 lần sai (backend trả ACCOUNT_LOCKED). */
export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo') ?? undefined;
  const staffMode = params.get('staff') === '1';
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const user = await login(v.email.trim(), v.password);
      if (user.mustChangePassword) return navigate('/auth/change-password', { replace: true });
      const safe = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : null;
      navigate(safe ?? homeFor(user.role), { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không đăng nhập được, vui lòng thử lại.');
    }
  });

  return (
    <>
      <AuthHeading title={t('auth.signInTitle')} lead={staffMode ? t('auth.staffHint') : t('auth.signInLead')} />
      {error && <Alert tone="bad" className="mb-5">{error}</Alert>}
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field label={t('auth.email')} error={formState.errors.email?.message}>
          {(id) => <Input id={id} type="email" autoComplete="email" invalid={!!formState.errors.email} {...register('email')} />}
        </Field>
        <Field label={t('auth.password')} error={formState.errors.password?.message}>
          {(id) => (
            <div className="relative">
              <Input id={id} type={show ? 'text' : 'password'} autoComplete="current-password" className="pr-12" {...register('password')} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-faint" aria-label="Hiện/ẩn mật khẩu">
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          )}
        </Field>
        <div className="flex justify-end -mt-2">
          <Link to="/auth/forgot-password" className="text-[13.5px] font-medium text-gold hover:underline">{t('auth.forgot')}</Link>
        </div>
        <Button type="submit" variant="navy" size="md" loading={formState.isSubmitting}>{t('auth.signIn')}</Button>
      </form>
      {!staffMode && <SocialButtons returnTo={returnTo} />}
      <p className="mt-8 text-center text-[14px] text-muted">
        {t('auth.noAccount')}{' '}
        <Link to={`/auth/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="font-semibold text-gold hover:underline">{t('auth.createOne')}</Link>
      </p>
    </>
  );
}
