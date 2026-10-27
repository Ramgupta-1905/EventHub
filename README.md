# EventHub Event Registration Platform

EventHub is a full-stack event registration platform. Visitors can explore events without an account. Participants can create an account, register for events, and see their own registration history. Administrators have a separate protected dashboard for event and attendee operations.

## Features

- Responsive, light-themed public landing page and event catalogue
- Public event schedules, descriptions, categories, venues, capacity, and live seat counts
- Account signup and signin with server-side validation and bcrypt password hashes
- HttpOnly, SameSite session cookies; Secure cookies in production
- Participant dashboard and backend-scoped personal registration list
- Authenticated event registration, normalized-email duplicate protection, and capacity enforcement
- Separate admin login, dashboard, event CRUD, searchable attendee table, and status updates
- JSON file persistence with seed data copied only on first initialization
- Backend API tests and a Vite production build

## Technology

- Frontend: React 18, React Router, Vite, Tailwind CSS
- Backend: Node.js, Express, bcryptjs, JWT
- Storage: local JSON files (no database or hosted service required)

## Prerequisites

- Node.js 18 or later
- npm

## Install

From the project root:

```powershell
npm install
npm install --prefix backend
npm install --prefix frontend
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Set `ADMIN_PASSWORD` and `JWT_SECRET` in `backend\.env` before starting the API. Use a unique password and a long random secret; do not commit `.env` files.

Example PowerShell secret generation:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

## Run locally

Start both development servers from the project root:

```powershell
npm run dev
```

Or start them separately in different terminals:

```powershell
npm run dev --prefix backend
npm run dev --prefix frontend
```

Default local addresses:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`
- Health check: `http://localhost:4000/api/health`

The frontend defaults to the API host used to open the website, on port `4000`, which supports localhost and LAN access when frontend and backend run on the same computer. Set `VITE_API_BASE_URL` to the backend API base URL (including `/api`) when the backend runs on a different host or port. For LAN access to a backend on another computer, use that computer's reachable LAN IPv4 address, not `localhost`. The backend `FRONTEND_ORIGIN` must list each exact browser origin (including scheme and port), separated by commas.

On Windows, find the backend computer's active LAN address with:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.AddressState -eq 'Preferred' } | Select-Object InterfaceAlias,IPAddress
```

For example, set `VITE_API_BASE_URL=http://<backend-lan-ip>:4000/api` in `frontend/.env` and add the frontend origin, such as `http://<frontend-lan-ip>:5173`, to `FRONTEND_ORIGIN` in `backend/.env`. Replace both placeholders with the actual reachable addresses; do not include the angle brackets. Restart Vite after changing its environment. The backend already listens on `0.0.0.0` for LAN testing; keep CORS limited to the exact origins you use.

## Environment variables

### Backend (`backend/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Express listening port | `4000` |
| `FRONTEND_ORIGIN` | Comma-separated exact allowed frontend origins for CORS and write-request origin checks | `http://localhost:5173` |
| `ADMIN_EMAIL` | Admin login email | `admin@eventhub.local` |
| `ADMIN_PASSWORD` | Admin password; required | none |
| `JWT_SECRET` | Session-signing secret; required | none |
| `NODE_ENV` | Enables Secure session cookies when set to `production` | `development` |
| `DATA_DIR` | Optional JSON data directory | `backend/data` when started with the backend package script |

### Frontend (`frontend/.env`)

| Variable | Purpose | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Optional backend API base URL, including `/api`; use the backend's reachable LAN host for a separate computer | Unset (uses the browser hostname on port `4000`) |

Restart Vite after changing frontend environment variables.

## Authentication and authorization

- Public event browsing and event details do not require an account.
- Participant registration requires a signed-in user account.
- Signup passwords are bcrypt-hashed before storage; password hashes are never returned by API responses.
- Authentication uses an HttpOnly, SameSite=Lax cookie. The browser does not store bearer tokens in local storage.
- Cookie credentials are sent by the centralized API client. The backend enables credentialed CORS only for the configured frontend origins and checks write-request origins.
- Participant identity and role are derived from the verified server-side session. Personal registration queries do not accept a client-supplied user ID.
- Admin credentials are configured only through backend environment variables. Admin endpoints enforce the admin role on the backend; changing client state cannot grant access.

For local admin access, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`. There is no hardcoded demo password.

## API overview

All endpoints are prefixed with `/api`.

| Method | Endpoint | Access |
|---|---|---|
| `GET` | `/health` | Public |
| `GET` | `/events` | Public |
| `GET` | `/events/:id` | Public |
| `GET` | `/events/:id/registrations/count` | Public |
| `POST` | `/events/:id/registrations` | Signed-in participant |
| `GET` | `/stats/public` | Public |
| `POST` | `/auth/signup` | Public |
| `POST` | `/auth/signin` | Public |
| `POST` | `/auth/logout` | Signed-in session, idempotent |
| `GET` | `/auth/me` | Signed-in session |
| `GET` | `/my/registrations` | Signed-in participant; only the current account's rows |
| `POST` | `/admin/login` | Public login |
| `GET` | `/admin/me` | Admin |
| `GET` | `/admin/dashboard` | Admin |
| `GET`, `POST` | `/admin/events` | Admin |
| `PUT`, `DELETE` | `/admin/events/:id` | Admin |
| `GET` | `/admin/registrations` | Admin |
| `GET` | `/admin/registrations/:id` | Admin |
| `PATCH` | `/admin/registrations/:id/status` | Admin |
| `POST` | `/admin/reset-demo-data` | Admin; requires `RESET_DEMO_DATA` confirmation |

Registration rejects a repeated normalized email for the same event with HTTP `409 DUPLICATE_REGISTRATION`. Capacity counts are calculated from stored registration statuses (`confirmed`, `attended`, and `waitlist`).

## JSON data and deployment limits

The backend stores runtime data in `backend/data/` (or `DATA_DIR`): events, registrations, users with bcrypt hashes, and revoked session IDs. The checked-in files in `backend/data/seed/` are copied for first initialization; normal restarts do not overwrite runtime JSON changes. Runtime files are ignored by Git.

JSON file storage is intended for local demos and a single backend process. It is not safe for multiple application instances sharing traffic, and it does not provide database transactions, distributed locking, or database backup/recovery. Use a transactional database and shared session infrastructure before multi-instance or production deployment.

## Test and build

From the project root:

```powershell
npm test
npm run build
```

Backend tests cover signup/signin, duplicate accounts, logout/session invalidation, protected routes, user isolation, event listing and detail, registration duplicates and capacity, admin authorization, persistence, and validation.
