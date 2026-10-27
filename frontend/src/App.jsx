import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import { useAuth } from './context/AuthContext';
import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminEventsPage from './pages/AdminEventsPage';
import AdminRegistrationsPage from './pages/AdminRegistrationsPage';
import SignUpPage from './pages/SignUpPage';
import SignInPage from './pages/SignInPage';
import UserDashboardPage from './pages/UserDashboardPage';

function RequireRole({ role, children }) {
  const { account, loading } = useAuth();
  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">Restoring your session…</div>;
  if (!account) return <Navigate to={role === 'admin' ? '/admin/login' : '/signin'} replace />;
  if (account.role !== role) return <Navigate to={account.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/dashboard" element={<RequireRole role="user"><UserDashboardPage /></RequireRole>} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<RequireRole role="admin"><AdminDashboardPage /></RequireRole>} />
        <Route path="/admin/events" element={<RequireRole role="admin"><AdminEventsPage /></RequireRole>} />
        <Route path="/admin/registrations" element={<RequireRole role="admin"><AdminRegistrationsPage /></RequireRole>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
