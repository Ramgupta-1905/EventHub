import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarDays, LogOut, Menu, Ticket, UserRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MainLayout() {
  const { account, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const navigate = useNavigate();

  async function handleLogout() {
    setLogoutError('');
    try {
      await signOut();
    } catch (error) {
      setLogoutError(error.message || 'The session could not be ended on the server. Please try again.');
    } finally {
      navigate('/', { replace: true });
    }
  }

  const links = [
    { to: '/events', label: 'Events', icon: CalendarDays },
    ...(account?.role === 'user' ? [{ to: '/dashboard', label: 'My dashboard', icon: UserRound }] : []),
    ...(account?.role === 'admin' ? [{ to: '/admin', label: 'Admin dashboard', icon: UserRound }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"><Ticket size={19} /></span>
            EventHub
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {links.map(({ to, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `rounded-full px-4 py-2 text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            {account ? (
              <>
                <span className="max-w-40 truncate text-sm text-slate-600">{account.name}</span>
                <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><LogOut size={15} /> Sign out</button>
              </>
            ) : (
              <>
                <Link to="/signin" className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign in</Link>
                <Link to="/signup" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Create account</Link>
              </>
            )}
          </div>
          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="rounded-xl border border-slate-200 p-2 text-slate-700 md:hidden" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <nav className="space-y-1 border-t border-slate-100 bg-white px-4 py-3 md:hidden" aria-label="Mobile navigation">
            {links.map(({ to, label }) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{label}</NavLink>)}
            {account ? (
              <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign out</button>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link to="/signin" onClick={() => setMenuOpen(false)} className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-700">Sign in</Link>
                <Link to="/signup" onClick={() => setMenuOpen(false)} className="flex-1 rounded-full bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white">Create account</Link>
              </div>
            )}
          </nav>
        )}
      </header>
      <main className="mx-auto min-h-[calc(100vh-160px)] max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        {logoutError && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{logoutError}</p>}
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© 2026 EventHub. Discover events, connect, and grow.</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/events" className="hover:text-blue-700">Browse events</Link>
            {!account && <Link to="/signup" className="hover:text-blue-700">Create account</Link>}
            <Link to="/admin/login" className="hover:text-blue-700">Admin access</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
