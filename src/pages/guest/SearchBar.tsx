import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui';
import { Counter, DateRange, type Stay } from '@/components/StayPicker';
import { useRoomTypes } from '@/api/catalog';
import { cn } from '@/lib/utils';

/** Thanh tìm phòng dùng ở trang chủ và trang kết quả. */
export function SearchBar({ value, roomTypeId, onSubmit, className, compact }: {
  value: Stay;
  roomTypeId?: string;
  onSubmit: (s: Stay, roomTypeId?: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [stay, setStay] = useState(value);
  const [type, setType] = useState(roomTypeId ?? '');
  const [open, setOpen] = useState(false);
  const { data: types } = useRoomTypes();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(stay, type || undefined);
      }}
      className={cn('grid items-center gap-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-pop)] md:grid-cols-[1fr_1fr_1.2fr_1.2fr_auto] md:gap-0 md:divide-x md:divide-line', className)}
    >
      <div className="md:px-5"><DateRange value={stay} onChange={(v) => setStay({ ...stay, ...v })} compact={compact} labels={{ checkIn: t('common.checkIn'), checkOut: t('common.checkOut') }} /></div>
      <div className="relative md:px-5">
        <button type="button" className="flex w-full flex-col items-start gap-1 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="label text-[10.5px] text-muted">{t('common.guests')}</span>
          <span className="flex items-center gap-2 text-[15px] font-medium">
            <Users className="size-4 text-faint" />
            {t('common.adultsCount', { count: stay.adults })}, {t('common.childrenCount', { count: stay.children })}
          </span>
        </button>
        {open && (
          <div className="absolute left-0 top-14 z-30 flex w-72 flex-col gap-4 rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-pop)]">
            <Counter label={t('common.adults')} value={stay.adults} min={1} max={6} onChange={(adults) => setStay({ ...stay, adults })} />
            <Counter label={t('common.children')} value={stay.children} min={0} max={4} onChange={(children) => setStay({ ...stay, children })} />
            <Button size="sm" variant="navy" onClick={() => setOpen(false)}>OK</Button>
          </div>
        )}
      </div>
      <label className="flex flex-col gap-1 md:px-5">
        <span className="label text-[10.5px] text-muted">Loại phòng / Room type</span>
        <select value={type} onChange={(e) => setType(e.target.value)} className="bg-transparent text-[15px] font-medium outline-none">
          <option value="">{t('common.allRoomTypes')}</option>
          {types?.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
        </select>
      </label>
      <div className="md:pl-5">
        <Button type="submit" variant="gold" size="lg" className="w-full">{t('home.checkAvailability')}</Button>
      </div>
    </form>
  );
}
