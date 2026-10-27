import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

const initialForm = { fullName: '', email: '', password: '', confirmPassword: '' };

export default function SignUpPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '', form: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (form.fullName.trim().length < 2) nextErrors.fullName = 'Enter your name (at least 2 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (form.password.length < 8 || form.password.length > 128) nextErrors.password = 'Use a password between 8 and 128 characters.';
    if (form.confirmPassword !== form.password) nextErrors.confirmPassword = 'Passwords do not match.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const account = await signUp({ fullName: form.fullName, email: form.email, password: form.password });
      navigate(account.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (requestError) {
      const fieldErrors = requestError instanceof ApiError ? requestError.details : null;
      setErrors({
        ...(fieldErrors && typeof fieldErrors === 'object' ? fieldErrors : {}),
        form: requestError.message || 'Account creation could not be completed.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-600">Join the community</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Create your account</h1>
      <p className="mt-2 text-slate-600">Sign up to register for events and keep track of your plans.</p>
      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <div>
          <label htmlFor="signup-name" className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
          <input id="signup-name" name="fullName" autoComplete="name" value={form.fullName} onChange={updateField} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-blue-400" required />
          {errors.fullName && <p className="mt-1 text-sm text-rose-700">{errors.fullName}</p>}
        </div>
        <div>
          <label htmlFor="signup-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input id="signup-email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-blue-400" required />
          {errors.email && <p className="mt-1 text-sm text-rose-700">{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="signup-password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <input id="signup-password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={updateField} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-blue-400" required />
          <p className="mt-1 text-xs text-slate-500">Choose 8 to 128 characters.</p>
          {errors.password && <p className="mt-1 text-sm text-rose-700">{errors.password}</p>}
        </div>
        <div>
          <label htmlFor="signup-confirm-password" className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
          <input id="signup-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={updateField} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-blue-400" required />
          {errors.confirmPassword && <p className="mt-1 text-sm text-rose-700">{errors.confirmPassword}</p>}
        </div>
        {errors.form && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errors.form}</p>}
        <button type="submit" disabled={submitting} className="w-full rounded-full bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">Already have an account? <Link to="/signin" className="font-semibold text-blue-700 hover:text-blue-800">Sign in</Link></p>
    </div>
  );
}
