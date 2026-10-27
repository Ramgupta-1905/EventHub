const defaultApiHost = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || `http://${defaultApiHost}:4000/api`).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, { status = null, code = 'NETWORK_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${normalizedPath}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(
      `Cannot reach the EventHub API at ${API_BASE}. Start the backend and check VITE_API_BASE_URL.`,
      { code: 'NETWORK_ERROR' },
    );
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message = data?.message || `The request failed with status ${response.status}.`;
    throw new ApiError(message, {
      status: response.status,
      code: data?.error || 'REQUEST_FAILED',
      details: data?.details || null,
    });
  }

  return data;
}

export function formatDate(dateValue) {
  if (!dateValue) return 'Date to be announced';
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateValue));
}

export function formatShortDate(dateValue) {
  if (!dateValue) return 'Date to be announced';
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateValue));
}

export function getStatusTone(status) {
  const map = {
    confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    attended: 'bg-sky-100 text-sky-700 border-sky-200',
    cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
    waitlist: 'bg-amber-100 text-amber-700 border-amber-200',
    pending: 'bg-slate-100 text-slate-700 border-slate-200',
    open: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    closed: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
}
