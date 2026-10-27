import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getStatusTone } from '../lib/api';

const statusOptions = ['all', 'confirmed', 'attended', 'cancelled', 'waitlist', 'pending'];

export default function AdminRegistrationsPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  const loadRows = async () => {
    try {
      const data = await apiFetch('/admin/registrations');
      setRows(data);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        navigate('/admin/login', { replace: true });
      } else {
        setLoadError(error.message || 'Registrations could not be loaded.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [navigate]);

  const events = Array.from(new Set(rows.map((row) => row.eventTitle))).filter(Boolean);

  const filteredRows = rows.filter((row) => {
    const matchSearch = [row.fullName, row.email].join(' ').toLowerCase().includes(search.toLowerCase());
    const matchEvent = eventFilter === 'all' || row.eventTitle === eventFilter;
    const matchStatus = statusFilter === 'all' || row.status === statusFilter;
    return matchSearch && matchEvent && matchStatus;
  });

  const updateStatus = async (registrationId, status) => {
    try {
      await apiFetch(`/admin/registrations/${registrationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadRows();
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading) return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">Loading registrations…</div>;
  if (loadError) return <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{loadError}</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-blue-600">Attendee management</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Registration table</h1>
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search participant name or email" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
            <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400">
              <option value="all">All events</option>
              {events.map((event) => <option key={event} value={event}>{event}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400">
              {statusOptions.map((status) => <option key={status} value={status}>{status === 'all' ? 'All statuses' : status}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50 text-sm uppercase tracking-[.08em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Participant</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{row.fullName}</div>
                    <div className="text-sm text-slate-500">{row.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.eventTitle}</td>
                  <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(row.status)}`}>{row.status}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-600">{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setSelected(row)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">Details</button>
                      <select onChange={(e) => updateStatus(row.id, e.target.value)} defaultValue="" className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none focus:border-blue-400">
                        <option value="" disabled>Update status</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="attended">Attended</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="waitlist">Waitlist</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Participant details</h2>
              <button onClick={() => setSelected(null)} className="text-sm font-medium text-slate-500">Close</button>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <div><span className="font-semibold text-slate-800">Name:</span> {selected.fullName}</div>
              <div><span className="font-semibold text-slate-800">Email:</span> {selected.email}</div>
              <div><span className="font-semibold text-slate-800">Organization:</span> {selected.organization}</div>
              <div><span className="font-semibold text-slate-800">Interests:</span> {selected.interests}</div>
              <div><span className="font-semibold text-slate-800">Event:</span> {selected.eventTitle}</div>
              <div><span className="font-semibold text-slate-800">Status:</span> <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(selected.status)}`}>{selected.status}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
