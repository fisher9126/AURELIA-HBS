import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { RequireAuth } from '@/auth/RequireAuth';
import { GuestLayout } from '@/layouts/GuestLayout';
import { StaffLayout } from '@/layouts/StaffLayout';
import { AuthLayout } from '@/pages/auth/AuthLayout';

// Trang khách
const Home = lazy(() => import('@/pages/guest/Home'));
const Search = lazy(() => import('@/pages/guest/Search'));
const RoomDetail = lazy(() => import('@/pages/guest/RoomDetail'));
const Booking = lazy(() => import('@/pages/guest/Booking'));
const Confirmation = lazy(() => import('@/pages/guest/Confirmation'));
const MyBookings = lazy(() => import('@/pages/guest/MyBookings'));
const Account = lazy(() => import('@/pages/guest/Account'));
const PaymentResult = lazy(() => import('@/pages/guest/PaymentResult'));
const Policies = lazy(() => import('@/pages/guest/Policies'));
// Xác thực
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const OAuthCallback = lazy(() => import('@/pages/auth/OAuthCallback'));
const ChangePassword = lazy(() => import('@/pages/auth/ChangePassword'));
// Lễ tân
const Calendar = lazy(() => import('@/pages/staff/Calendar'));
const FrontDesk = lazy(() => import('@/pages/staff/FrontDesk'));
const Bookings = lazy(() => import('@/pages/staff/Bookings'));
const BookingDetail = lazy(() => import('@/pages/staff/BookingDetail'));
const WalkIn = lazy(() => import('@/pages/staff/WalkIn'));
const Housekeeping = lazy(() => import('@/pages/staff/Housekeeping'));
const Guests = lazy(() => import('@/pages/staff/Guests'));
// Quản trị
const Dashboard = lazy(() => import('@/pages/admin/Dashboard'));
const Pricing = lazy(() => import('@/pages/admin/Pricing'));
const Rooms = lazy(() => import('@/pages/admin/Rooms'));
const RoomTypeEdit = lazy(() => import('@/pages/admin/RoomTypeEdit'));
const Staff = lazy(() => import('@/pages/admin/Staff'));
const Reports = lazy(() => import('@/pages/admin/Reports'));
const SettingsPage = lazy(() => import('@/pages/admin/Settings'));
const AuditLogs = lazy(() => import('@/pages/admin/AuditLogs'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const staff = (el: ReactNode) => <RequireAuth roles={['RECEPTIONIST', 'ADMIN']}>{el}</RequireAuth>;
const admin = (el: ReactNode) => <RequireAuth roles={['ADMIN']}>{el}</RequireAuth>;

export default function App() {
  return (
    <Suspense fallback={<Spinner className="min-h-[60vh]" />}>
      <Routes>
        <Route element={<GuestLayout />}>
          <Route index element={<Home />} />
          <Route path="rooms" element={<Search />} />
          <Route path="rooms/:slug" element={<RoomDetail />} />
          <Route path="book" element={<Booking />} />
          <Route path="booking/:id/confirmation" element={<Confirmation />} />
          <Route path="payment-result" element={<PaymentResult />} />
          <Route path="policies" element={<Policies />} />
          <Route path="my-bookings" element={<RequireAuth><MyBookings /></RequireAuth>} />
          <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />
        </Route>

        <Route path="auth" element={<AuthLayout />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="oauth-callback" element={<OAuthCallback />} />
          <Route path="change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
        </Route>

        <Route element={staff(<StaffLayout />)}>
          <Route path="staff" element={<Navigate to="/staff/front-desk" replace />} />
          <Route path="staff/calendar" element={<Calendar />} />
          <Route path="staff/front-desk" element={<FrontDesk />} />
          <Route path="staff/bookings" element={<Bookings />} />
          <Route path="staff/bookings/:id" element={<BookingDetail />} />
          <Route path="staff/walk-in" element={<WalkIn />} />
          <Route path="staff/housekeeping" element={<Housekeeping />} />
          <Route path="staff/guests" element={<Guests />} />

          <Route path="admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="admin/dashboard" element={admin(<Dashboard />)} />
          <Route path="admin/pricing" element={admin(<Pricing />)} />
          <Route path="admin/rooms" element={admin(<Rooms />)} />
          <Route path="admin/rooms/types/:id" element={admin(<RoomTypeEdit />)} />
          <Route path="admin/staff" element={admin(<Staff />)} />
          <Route path="admin/reports" element={admin(<Reports />)} />
          <Route path="admin/settings" element={admin(<SettingsPage />)} />
          <Route path="admin/audit-logs" element={admin(<AuditLogs />)} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
