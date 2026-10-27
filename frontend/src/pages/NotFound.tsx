import { Link } from 'react-router-dom';
import { Brand } from '@/components/Brand';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-sand px-6 text-center">
      <Brand />
      <p className="font-display text-[96px] leading-none text-gold">404</p>
      <h1 className="font-display text-3xl">Không tìm thấy trang</h1>
      <p className="max-w-md text-muted">Đường dẫn có thể đã thay đổi hoặc không tồn tại. / The page you are looking for does not exist.</p>
      <Link to="/" className="inline-flex h-12 items-center rounded-xl bg-navy px-6 font-semibold text-white">Về trang chủ</Link>
    </div>
  );
}
