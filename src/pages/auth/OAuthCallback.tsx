import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Spinner } from '@/components/ui';
import { homeFor, useAuth } from '@/auth/AuthContext';

/** Nhận #access_token=…&return_to=… từ backend sau Google/Apple, rồi xóa fragment khỏi URL. */
export default function OAuthCallback() {
  const { acceptAccessToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const frag = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    window.history.replaceState(null, '', window.location.pathname);
    const token = frag.get('access_token');
    if (!token) {
      setError(query.get('error') === 'access_denied' ? 'Bạn đã hủy đăng nhập.' : 'Đăng nhập mạng xã hội không thành công.');
      return;
    }
    const returnTo = frag.get('return_to');
    acceptAccessToken(token)
      .then((u) => navigate(returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : homeFor(u.role), { replace: true }))
      .catch(() => setError('Phiên đăng nhập không hợp lệ.'));
  }, [acceptAccessToken, navigate]);

  if (error)
    return (
      <div className="flex flex-col gap-6">
        <Alert tone="bad">{error}</Alert>
        <Link to="/auth/login" className="text-center font-medium text-gold">← Quay lại đăng nhập</Link>
      </div>
    );
  return <Spinner label="Đang hoàn tất đăng nhập…" className="min-h-[40vh]" />;
}
