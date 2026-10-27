import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field, Input } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/lib/api';
import { AuthHeading, PASSWORD_RE, SocialButtons } from './shared';

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên').max(100),
    email: z.string().email('Email không hợp lệ'),
    phone: z.string().regex(/^(\+?84|0)\d{9,10}$/, 'Số điện thoại không hợp lệ'),
    password: z.string().regex(PASSWORD_RE, 'Tối thiểu 8 ký tự, gồm chữ và số'),
    confirm: z.string(),
    agree: z.literal(true, { errorMap: () => ({ message: 'Bạn cần đồng ý điều khoản' }) }),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp' });
type Form = z.infer<typeof schema>;

/** Đăng ký tài khoản khách. */
export default function Register() {
  const { t } = useTranslation();
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo');
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState, setError: setFieldError } = useForm<Form>({ resolver: zodResolver(schema) });
  const e = formState.errors;

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await signUp({ fullName: v.fullName, email: v.email.trim(), phone: v.phone, password: v.password });
      navigate(returnTo?.startsWith('/') ? returnTo : '/my-bookings', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors();
        Object.entries(fe).forEach(([k, m]) => setFieldError(k as keyof Form, { message: m }));
        if (!Object.keys(fe).length) setError(err.message);
      } else setError('Không tạo được tài khoản.');
    }
  });

  return (
    <>
      <AuthHeading title={t('auth.registerTitle')} lead={t('auth.registerLead')} />
      {error && <Alert tone="bad" className="mb-5">{error}</Alert>}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={t('auth.fullName')} required error={e.fullName?.message}>
          {(id) => <Input id={id} autoComplete="name" {...register('fullName')} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('auth.email')} required error={e.email?.message}>
            {(id) => <Input id={id} type="email" autoComplete="email" {...register('email')} />}
          </Field>
          <Field label={t('auth.phone')} required error={e.phone?.message}>
            {(id) => <Input id={id} type="tel" autoComplete="tel" placeholder="0905 123 456" {...register('phone')} />}
          </Field>
        </div>
        <Field label={t('auth.password')} required error={e.password?.message} hint={t('auth.passwordHint')}>
          {(id) => <Input id={id} type="password" autoComplete="new-password" {...register('password')} />}
        </Field>
        <Field label="Nhập lại mật khẩu / Confirm" required error={e.confirm?.message}>
          {(id) => <Input id={id} type="password" autoComplete="new-password" {...register('confirm')} />}
        </Field>
        <label className="flex items-start gap-3 text-[13.5px] text-ink2">
          <input type="checkbox" className="mt-1 size-4 accent-[#CC7A2E]" {...register('agree')} />
          <span>
            Tôi đồng ý với <Link to="/policies#terms" className="text-gold underline">điều khoản</Link> và{' '}
            <Link to="/policies#privacy" className="text-gold underline">chính sách quyền riêng tư</Link>.
          </span>
        </label>
        {e.agree && <p className="-mt-2 text-[12.5px] text-bad-d">{e.agree.message}</p>}
        <Button type="submit" variant="navy" loading={formState.isSubmitting}>{t('auth.register')}</Button>
      </form>
      <SocialButtons returnTo={returnTo ?? undefined} />
      <p className="mt-8 text-center text-[14px] text-muted">
        {t('auth.haveAccount')} <Link to="/auth/login" className="font-semibold text-gold hover:underline">{t('auth.signIn')}</Link>
      </p>
    </>
  );
}
