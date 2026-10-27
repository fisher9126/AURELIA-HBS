import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Ảnh phòng: dùng ảnh tải lên MinIO; chưa có ảnh hoặc ảnh lỗi thì dùng ảnh minh họa theo loại phòng,
 * cuối cùng là nền gradient (khi không có mạng ngoài).
 */
const FALLBACK: Record<string, string> = {
  'luxury-suite': 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=70',
  'deluxe-ocean': 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=70',
  'standard-king': 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=70',
};
const GRADIENTS = [
  'linear-gradient(135deg,#d9c3a5 0%,#b9a07f 40%,#7d6a58 100%)',
  'linear-gradient(135deg,#bcd3e6 0%,#8fb1cc 45%,#55748f 100%)',
  'linear-gradient(135deg,#e2d6c4 0%,#c5b096 50%,#8c7660 100%)',
];

export function RoomImage({ src, slug, alt, className }: { src?: string | null; slug?: string; alt: string; className?: string }) {
  const candidates = [src, slug ? FALLBACK[slug] : undefined].filter(Boolean) as string[];
  const [idx, setIdx] = useState(0);
  const gradient = GRADIENTS[[...(slug ?? alt)].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTS.length];
  const url = candidates[idx];
  return (
    <div className={cn('relative overflow-hidden bg-cover bg-center', className)} style={{ background: gradient }}>
      {url && (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => setIdx((i) => i + 1)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  );
}
