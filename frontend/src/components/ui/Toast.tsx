import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

type ToastTone = 'ok' | 'bad' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  text: string;
}
interface ToastApi {
  success: (text: string) => void;
  error: (err: unknown, fallback?: string) => void;
  info: (text: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((tone: ToastTone, text: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, tone, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === 'bad' ? 6000 : 3500);
  }, []);
  const api: ToastApi = {
    success: (t) => push('ok', t),
    info: (t) => push('info', t),
    error: (err, fallback = 'Thao tác không thành công') => push('bad', err instanceof ApiError ? err.message : typeof err === 'string' ? err : fallback),
  };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-[380px] max-w-[calc(100vw-48px)] flex-col gap-3" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'bad' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 text-[13.5px] shadow-[var(--shadow-pop)]',
              t.tone === 'ok' && 'border-ok/30',
              t.tone === 'bad' && 'border-bad/30',
              t.tone === 'info' && 'border-line',
            )}
          >
            {t.tone === 'ok' && <CheckCircle2 className="mt-0.5 size-5 flex-none text-ok" />}
            {t.tone === 'bad' && <XCircle className="mt-0.5 size-5 flex-none text-bad" />}
            {t.tone === 'info' && <Info className="mt-0.5 size-5 flex-none text-due" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast phải nằm trong ToastProvider');
  return c;
}
