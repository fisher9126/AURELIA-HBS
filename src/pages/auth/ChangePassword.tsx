import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Button, Field, Input, useToast } from '@/components/ui';
import { homeFor, useAuth } from '@/auth/AuthContext';
import { ApiError, post } from '@/lib/api';
import { AuthHeading, PASSWORD_RE } from './shared';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại'),
    newPassword: z.string().regex(PASSWORD_RE, 'Tối thiểu 8 ký tự, gồm chữ và số'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp' });
type Form = z.infer<typeof schema>;

/** nhân viên mới phải đổi mật khẩu tạm ở lần đăng nhập đầu. */
export default function ChangePassword() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword });
      if (user) setUser({ ...user, mustChangePassword: false });
      toast.success('Đã đổi mật khẩu');
      navigate(homeFor(user?.role), { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không đổi được mật khẩu.');
    }
  });

  return (
    <>
      <AuthHeading title="Đổi mật khẩu" lead={user?.mustChangePassword ? 'Vì lý do bảo mật, hãy đặt mật khẩu mới trước khi tiếp tục.' : undefined} />
      {error && <Alert tone="bad" className="mb-5">{error}</Alert>}
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="Mật khẩu hiện tại" error={formState.errors.currentPassword?.message}>
          {(id) => <Input id={id} type="password" autoComplete="current-password" {...register('currentPassword')} />}
        </Field>
        <Field label="Mật khẩu mới" error={formState.errors.newPassword?.message} hint="Tối thiểu 8 ký tự, gồm chữ và số">
          {(id) => <Input id={id} type="password" autoComplete="new-password" {...register('newPassword')} />}
        </Field>
        <Field label="Nhập lại mật khẩu mới" error={formState.errors.confirm?.message}>
          {(id) => <Input id={id} type="password" autoComplete="new-password" {...register('confirm')} />}
        </Field>
        <Button type="submit" variant="navy" loading={formState.isSubmitting}>Lưu mật khẩu</Button>
      </form>
    </>
  );
}
