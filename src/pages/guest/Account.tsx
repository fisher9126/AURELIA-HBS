import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button, Field, Input, useToast } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { ApiError, patch, post } from '@/lib/api';
import type { UserView } from '@/lib/types';
import { PASSWORD_RE } from '@/pages/auth/shared';

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên').max(100),
  phone: z.string().regex(/^(\+?84|0)\d{9,10}$/, 'Số điện thoại không hợp lệ'),
});
const pwSchema = z
  .object({ currentPassword: z.string().min(1, 'Bắt buộc'), newPassword: z.string().regex(PASSWORD_RE, 'Tối thiểu 8 ký tự, gồm chữ và số'), confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Không khớp' });

/** hồ sơ và đổi mật khẩu. */
export default function Account() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const profile = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), values: { fullName: user?.fullName ?? '', phone: user?.phone ?? '' } });
  const pw = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) });

  return (
    <div className="bg-sand py-14">
      <div className="mx-auto grid max-w-[1000px] gap-6 px-6 md:grid-cols-2">
        <h1 className="font-display text-[44px] md:col-span-2">{t('nav.account')}</h1>
        <form
          className="card flex flex-col gap-5 p-7"
          onSubmit={profile.handleSubmit(async (v) => {
            setSaving(true);
            try {
              setUser(await patch<UserView>('/auth/me', v));
              toast.success('Đã lưu hồ sơ');
            } catch (e) {
              toast.error(e);
            } finally {
              setSaving(false);
            }
          })}
        >
          <h2 className="font-display text-[26px]">Hồ sơ</h2>
          <Field label="Email">{(id) => <Input id={id} value={user?.email ?? ''} disabled />}</Field>
          <Field label={t('auth.fullName')} error={profile.formState.errors.fullName?.message}>{(id) => <Input id={id} {...profile.register('fullName')} />}</Field>
          <Field label={t('auth.phone')} error={profile.formState.errors.phone?.message}>{(id) => <Input id={id} {...profile.register('phone')} />}</Field>
          <Button type="submit" variant="navy" loading={saving}>Lưu</Button>
        </form>
        <form
          className="card flex flex-col gap-5 p-7"
          onSubmit={pw.handleSubmit(async (v) => {
            try {
              await post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword });
              pw.reset();
              toast.success('Đã đổi mật khẩu');
            } catch (e) {
              if (e instanceof ApiError) pw.setError('currentPassword', { message: e.message });
              else toast.error(e);
            }
          })}
        >
          <h2 className="font-display text-[26px]">Đổi mật khẩu</h2>
          <Field label="Mật khẩu hiện tại" error={pw.formState.errors.currentPassword?.message}>{(id) => <Input id={id} type="password" {...pw.register('currentPassword')} />}</Field>
          <Field label={t('auth.newPassword')} error={pw.formState.errors.newPassword?.message}>{(id) => <Input id={id} type="password" {...pw.register('newPassword')} />}</Field>
          <Field label="Nhập lại" error={pw.formState.errors.confirm?.message}>{(id) => <Input id={id} type="password" {...pw.register('confirm')} />}</Field>
          <Button type="submit" variant="line" loading={pw.formState.isSubmitting}>{t('auth.save')}</Button>
        </form>
      </div>
    </div>
  );
}
