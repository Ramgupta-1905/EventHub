import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, Filter, MapPin, Search, Users } from 'lucide-react';
import { apiFetch, formatShortDate, getStatusTone } from '../lib/api';

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [timeFilter, setTimeFilter] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await apiFetch('/events');
        setEvents(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const categories = useMemo(() => ['All', ...new Set(events.map((event) => event.category))], [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch = [event.title, event.description].join(' ').toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === 'All' || event.category === category;
      const isUpcoming = new Date(event.startAt) >= new Date();
      const matchesTime = timeFilter === 'all' ? true : timeFilter === 'upcoming' ? isUpcoming : !isUpcoming;
      return matchesSearch && matchesCategory && matchesTime;
    });
  }, [events, query, category, timeFilter]);

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">Loading events…</div>;
  if (error) return <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-blue-600">Event showcase</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Explore upcoming events</h1>
          </div>
          <div className="flex w-full max-w-2xl flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={18} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title or description" className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none ring-0 transition focus:border-blue-400" />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400">
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400">
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">No events match your filters right now.</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {filteredEvents.map((event) => (
            <div key={event.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">{event.category}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(event.registrationStatus)}`}>{event.registrationStatus === 'closed' ? 'Closed' : 'Open'}</span>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{event.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{event.description}</p>
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2"><CalendarRange size={14} /> {formatShortDate(event.startAt)}</div>
                  <div className="flex items-center gap-2"><MapPin size={14} /> {event.venue}</div>
                  <div className="flex items-center gap-2"><Users size={14} /> {event.registrationCount} registered / {event.capacity} capacity</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">Seats left: <span className="font-semibold text-slate-900">{event.availableSeats}</span></div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">Status: <span className="font-semibold text-slate-900">{event.registrationStatus}</span></div>
                </div>
                <div className="flex gap-2">
                  <Link to={`/events/${event.id}`} className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-400">View details</Link>
                  <Link to={`/events/${event.id}`} className={`flex-1 rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white transition ${event.registrationStatus === 'closed' ? 'cursor-not-allowed bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    {event.registrationStatus === 'closed' ? 'Closed' : 'Register'}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
