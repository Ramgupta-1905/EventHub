import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, formatShortDate } from '../lib/api';

const emptyForm = {
  title: '',
  description: '',
  category: 'Workshop',
  startAt: '',
  endAt: '',
  venue: '',
  capacity: 50,
  registrationOpen: true,
  featured: false,
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const navigate = useNavigate();

  const loadEvents = async () => {
    try {
      const data = await apiFetch('/admin/events');
      setEvents(data);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        navigate('/admin/login', { replace: true });
      } else {
        setLoadError(error.message || 'Events could not be loaded.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const payload = { ...form, capacity: Number(form.capacity) };
      if (editId) {
        await apiFetch(`/admin/events/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/admin/events', { method: 'POST', body: JSON.stringify(payload) });
      }
      setForm(emptyForm);
      setEditId(null);
      await loadEvents();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleEdit = (event) => {
    setEditId(event.id);
    setForm({
      title: event.title,
      description: event.description,
      category: event.category,
      startAt: event.startAt.slice(0, 16),
      endAt: event.endAt ? event.endAt.slice(0, 16) : '',
      venue: event.venue,
      capacity: event.capacity,
      registrationOpen: event.registrationOpen,
      featured: event.featured,
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event and all associated registrations?')) return;
    try {
      await apiFetch(`/admin/events/${id}`, { method: 'DELETE' });
      await loadEvents();
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">Loading events…</div>;
  if (loadError) return <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{loadError}</div>;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">{editId ? 'Edit event' : 'Create event'}</h2>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Capacity</label>
              <input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start</label>
              <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">End</label>
              <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Venue</label>
            <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </div>
          <div className="flex gap-5">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.registrationOpen} onChange={(e) => setForm({ ...form, registrationOpen: e.target.checked })} /> Registration open</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="rounded-full bg-blue-600 px-5 py-2.5 font-semibold text-white">{editId ? 'Save changes' : 'Create event'}</button>
            {editId && <button type="button" onClick={() => { setEditId(null); setForm(emptyForm); }} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 font-semibold text-slate-700">Cancel</button>}
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Event list</h2>
        <div className="mt-4 space-y-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{event.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{event.category} • {formatShortDate(event.startAt)}</div>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${event.registrationStatus === 'closed' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{event.registrationStatus === 'closed' ? 'Closed' : 'Open'}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                <span>{event.registrationCount} / {event.capacity} seats</span>
                <span>{event.availableSeats} available</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => handleEdit(event)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Edit</button>
                <button onClick={() => handleDelete(event.id)} className="rounded-full bg-rose-600 px-3 py-2 text-sm font-semibold text-white">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
