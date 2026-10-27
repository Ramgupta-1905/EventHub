import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      const account = await signIn(email, password);
      navigate(account.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (requestError) {
      const message = requestError instanceof ApiError
        ? requestError.message
        : 'Sign in could not be completed.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-600">Welcome back</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Sign in to EventHub</h1>
      <p className="mt-2 text-slate-600">Your next great event is just around the corner.</p>
      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <div>
          <label htmlFor="signin-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input id="signin-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-blue-400" required />
        </div>
        <div>
          <label htmlFor="signin-password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <input id="signin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-blue-400" required />
        </div>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={submitting} className="w-full rounded-full bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">New to EventHub? <Link to="/signup" className="font-semibold text-blue-700 hover:text-blue-800">Create an account</Link></p>
    </div>
  );
}
