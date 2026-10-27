import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, MapPin, Sparkles, Users } from 'lucide-react';
import { apiFetch, formatShortDate } from '../lib/api';

export default function HomePage() {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadEvents() {
    setLoading(true);
    setError('');
    try {
      const events = await apiFetch('/events');
      setFeatured(events.filter((event) => event.featured).slice(0, 3));
    } catch (requestError) {
      setError(requestError.message || 'Featured events could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEvents(); }, []);

  return (
    <div className="space-y-16 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-700"><Sparkles size={14} /> EventHub community</div>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">Find your people.<br className="hidden sm:block" /> Build what’s next.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">Discover practical workshops, inspiring meetups, and career-building events made for curious creators and technologists.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/events" className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700">Explore events <ArrowRight size={17} /></Link>
            <Link to="/signup" className="rounded-full border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700">Create your account</Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-600">
            <span><Users size={15} className="mr-1.5 inline text-blue-600" />A welcoming community</span>
            <span><CalendarDays size={15} className="mr-1.5 inline text-blue-600" />Real-time availability</span>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-600">Curated for you</p>
            <h2 className="mt-1 text-3xl font-bold text-slate-900">Featured events</h2>
          </div>
          <Link to="/events" className="inline-flex items-center gap-1 self-start font-semibold text-blue-700 hover:text-blue-800 sm:self-auto">Browse all events <ArrowRight size={16} /></Link>
        </div>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white" />)}
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
            <p>{error}</p><button onClick={loadEvents} className="mt-3 font-semibold underline underline-offset-2">Try again</button>
          </div>
        ) : featured.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((event) => (
              <article key={event.id} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{event.category}</span>
                  <span className={`text-xs font-semibold ${event.registrationStatus === 'closed' ? 'text-rose-700' : 'text-emerald-700'}`}>{event.registrationStatus === 'closed' ? 'Registration closed' : `${event.availableSeats} seats left`}</span>
                </div>
                <h3 className="mt-4 text-xl font-bold text-slate-900">{event.title}</h3>
                <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">{event.description}</p>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p><CalendarDays size={15} className="mr-2 inline text-blue-600" />{formatShortDate(event.startAt)}</p>
                  <p><MapPin size={15} className="mr-2 inline text-blue-600" />{event.venue}</p>
                  <p className="text-slate-500">{event.registrationCount} registered of {event.capacity} places</p>
                </div>
                <Link to={`/events/${event.id}`} className="mt-5 inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">View event <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-9 text-center text-slate-600">No featured events are available yet. <Link to="/events" className="font-semibold text-blue-700">Browse all events</Link>.</div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['Learn by doing', 'Hands-on sessions turn new ideas into real skills you can use.'],
          ['Meet your community', 'Connect with people who share your curiosity and ambition.'],
          ['Keep plans together', 'Create an account to register and track your upcoming events.'],
        ].map(([title, description], index) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700">0{index + 1}</span>
            <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
