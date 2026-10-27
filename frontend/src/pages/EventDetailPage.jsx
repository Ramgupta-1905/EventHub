import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarRange, CheckCircle2, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch, formatDate } from '../lib/api';

const initialForm = {
  organization: '',
  interests: '',
};

export default function EventDetailPage() {
  const { eventId } = useParams();
  const { account } = useAuth();
  const [event, setEvent] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch(`/events/${eventId}`);
        setEvent(data);
      } catch (error) {
        setLoadError(error.message || 'Event details could not be loaded.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [eventId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    const formErrors = {};
    if (form.organization.trim().length < 2) formErrors.organization = 'Enter your college or organization.';
    if (form.interests.trim().length < 2) formErrors.interests = 'Tell us about your areas of interest.';
    if (Object.keys(formErrors).length) {
      setErrors(formErrors);
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch(`/events/${eventId}/registrations`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSuccess(`Successfully registered for ${response.event.title}. You are confirmed for this event.`);
      setEvent(response.event);
      setForm(initialForm);
      setErrors({});
    } catch (error) {
      if (error.status === 409 && error.code === 'DUPLICATE_REGISTRATION') {
        setErrors({ form: 'Your account is already registered for this event.' });
      } else {
        setErrors({ form: error.message || 'Registration failed.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">Loading event details…</div>;
  if (loadError) return <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-700">{loadError}</div>;
  if (!event) return <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">Event not found.</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">{event.category}</div>
        <h1 className="text-3xl font-bold text-slate-900">{event.title}</h1>
        <p className="mt-4 text-slate-600">{event.description}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500"><CalendarRange size={16} /> Start</div>
            <div className="mt-2 font-semibold text-slate-900">{formatDate(event.startAt)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500"><CalendarRange size={16} /> End</div>
            <div className="mt-2 font-semibold text-slate-900">{formatDate(event.endAt)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500"><MapPin size={16} /> Venue</div>
            <div className="mt-2 font-semibold text-slate-900">{event.venue}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500"><Users size={16} /> Capacity</div>
            <div className="mt-2 font-semibold text-slate-900">{event.registrationCount} / {event.capacity}</div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Register now</h2>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${event.registrationStatus === 'closed' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {event.registrationStatus === 'closed' ? 'Closed' : 'Open'}
          </span>
        </div>

        {event.isClosed ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Registration is currently closed for this event.
          </div>
        ) : !account ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm leading-6 text-slate-700">Sign in or create a free account to register and track this event from your dashboard.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/signin" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Sign in to register</Link>
              <Link to="/signup" className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">Create account</Link>
            </div>
          </div>
        ) : account.role !== 'user' ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Participant accounts are required to register for events.</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Registering as <span className="font-semibold text-slate-900">{account.name}</span> ({account.email})</div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">College or organization</label>
              <input name="organization" value={form.organization} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-blue-400" placeholder="University or company" required />
              {errors.organization && <p className="mt-1 text-sm text-red-600">{errors.organization}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Domain interests</label>
              <textarea name="interests" value={form.interests} onChange={handleChange} rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-blue-400" placeholder="e.g. Frontend, AI, cybersecurity" required />
              {errors.interests && <p className="mt-1 text-sm text-red-600">{errors.interests}</p>}
            </div>
            {errors.form && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{errors.form}</p>}
            {success && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle2 size={18} className="mt-0.5" /> {success}
              </div>
            )}
            <button type="submit" disabled={submitting} className="w-full rounded-full bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Submitting...' : 'Complete registration'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
