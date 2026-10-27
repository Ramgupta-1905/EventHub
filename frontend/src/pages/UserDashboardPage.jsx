import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Search, Ticket, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, formatDate, formatShortDate, getStatusTone } from '../lib/api';

export default function UserDashboardPage() {
  const { account } = useAuth();
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([apiFetch('/events'), apiFetch('/my/registrations')])
      .then(([eventRows, registrationRows]) => {
        if (!active) return;
        setEvents(eventRows);
        setRegistrations(registrationRows);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Dashboard data could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => ['All', ...new Set(events.map((event) => event.category))], [events]);
  const upcomingEvents = events.filter((event) => new Date(event.startAt) >= new Date());
  const availableEventCount = upcomingEvents.filter((event) => !event.isClosed && event.availableSeats > 0).length;
  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return upcomingEvents
      .filter((event) => category === 'All' || event.category === category)
      .filter((event) => !needle || `${event.title} ${event.description} ${event.venue}`.toLowerCase().includes(needle))
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  }, [upcomingEvents, query, category]);

  const upcomingRegistrations = registrations.filter((registration) =>
    registration.event && new Date(registration.event.startAt) >= new Date() && registration.status !== 'cancelled'
  );

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">Loading your dashboard…</div>;
  if (error) return <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800">{error}</div>;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-700">Your EventHub</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Welcome, {account?.name || 'there'}.</h1>
        <p className="mt-2 text-slate-600">Find your next experience and keep all your registrations in one place.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Available upcoming events', value: availableEventCount, icon: CalendarDays },
          { label: 'Your registrations', value: registrations.length, icon: Ticket },
          { label: 'Upcoming registrations', value: upcomingRegistrations.length, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>{label}</span><Icon size={18} className="text-blue-600" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-600">Discover</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Upcoming events</h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <span className="sr-only">Search events</span>
              <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events" className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-400 sm:w-64" />
            </label>
            <select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-400">
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </div>
        {filteredEvents.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredEvents.map((event) => (
              <article key={event.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{event.category}</span>
                  <span className="text-sm font-medium text-slate-600">{event.availableSeats} seats left</span>
                </div>
                <h3 className="mt-3 text-xl font-bold text-slate-900">{event.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{event.description}</p>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p><CalendarDays size={15} className="mr-2 inline text-blue-600" />{formatDate(event.startAt)}</p>
                  <p><MapPin size={15} className="mr-2 inline text-blue-600" />{event.venue}</p>
                  <p><Users size={15} className="mr-2 inline text-blue-600" />Capacity {event.registrationCount} / {event.capacity}</p>
                </div>
                <Link to={`/events/${event.id}`} className="mt-4 inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">View event</Link>
              </article>
            ))}
          </div>
        ) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No upcoming events match this search.</div>}
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-600">Your plans</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">My registrations</h2>
        </div>
        {registrations.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">Event</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Details</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registrations.map((registration) => (
                    <tr key={registration.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{registration.event?.title || 'Event unavailable'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{registration.event ? formatShortDate(registration.event.startAt) : formatShortDate(registration.createdAt)}</td>
                      <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(registration.status)}`}>{registration.status}</span></td>
                      <td className="px-4 py-3">{registration.event && <Link to={`/events/${registration.event.id}`} className="text-sm font-semibold text-blue-700">View event</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            You have no registrations yet. <Link to="/events" className="font-semibold text-blue-700">Explore events</Link>
          </div>
        )}
      </section>
    </div>
  );
}
