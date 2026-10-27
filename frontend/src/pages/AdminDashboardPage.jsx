import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, LayoutDashboard, LogOut, Ticket, Users } from 'lucide-react';
import { apiFetch, formatShortDate, getStatusTone } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { signOut } = useAuth();

  useEffect(() => {
    async function load() {
      try {
        const response = await apiFetch('/admin/dashboard');
        setDashboard(response);
      } catch (requestError) {
        if (requestError.status === 401 || requestError.status === 403) {
          navigate('/admin/login', { replace: true });
        } else {
          setError(requestError.message || 'The admin dashboard could not be loaded.');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [navigate]);

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">Loading dashboard…</div>;
  if (error) return <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>;
  if (!dashboard) return null;

  const cards = [
    { label: 'Total events', value: dashboard.summary.totalEvents, icon: LayoutDashboard },
    { label: 'Total registrations', value: dashboard.summary.totalRegistrations, icon: Users },
    { label: 'Upcoming events', value: dashboard.summary.upcomingEvents, icon: CalendarClock },
    { label: 'Available seats', value: dashboard.summary.availableSeats, icon: Ticket },
  ];

  async function handleLogout() {
    try {
      await signOut();
    } catch (logoutError) {
      setError(logoutError.message || 'The server could not end this session.');
    } finally {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-blue-600">Admin dashboard</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Operations overview</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/events" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Manage events</Link>
          <Link to="/admin/registrations" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Attendee table</Link>
          <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><LogOut size={15} /> Logout</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{label}</p>
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600"><Icon size={16} /></div>
            </div>
            <div className="mt-5 text-3xl font-bold text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Recent registrations</h2>
            <Link to="/admin/registrations" className="text-sm font-semibold text-blue-700">View all</Link>
          </div>
          <div className="space-y-3">
            {dashboard.recentRegistrations.map((registration) => (
              <div key={registration.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <div className="font-semibold text-slate-900">{registration.fullName}</div>
                  <div className="text-sm text-slate-500">{registration.email} • {registration.eventTitle}</div>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(registration.status)}`}>{registration.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Upcoming events</h2>
          <div className="mt-4 space-y-3">
            {dashboard.upcomingEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-semibold text-slate-900">{event.title}</div>
                <div className="mt-1 text-xs text-slate-500">{formatShortDate(event.startAt)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Event registration statistics</h2>
        <div className="mt-4 space-y-3">
          {dashboard.eventStats.map((event) => (
            <div key={event.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{event.title}</span>
                <span className="text-slate-500">{event.count}/{event.capacity}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min((event.count / event.capacity) * 100, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
