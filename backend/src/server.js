import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'node:path';

import { getConfig } from './config.js';
import {
  createId,
  initializeDataStore,
  normalizeEmail,
  readRevokedSessions,
  readEvents,
  readRegistrations,
  readUsers,
  resetDemoData,
  withWriteLock,
  writeEvents,
  writeRegistrations,
  writeRevokedSessions,
  writeUsers,
} from './storage.js';

const VALID_STATUSES = ['confirmed', 'attended', 'cancelled', 'waitlist', 'pending'];
const CAPACITY_COUNTING_STATUSES = ['confirmed', 'attended', 'waitlist'];

function getRegistrationSummary(eventId, registrations = []) {
  return registrations.filter(
    (registration) => String(registration.eventId) === String(eventId) && CAPACITY_COUNTING_STATUSES.includes(String(registration.status || '').toLowerCase())
  ).length;
}

function enrichEvent(event, registrations) {
  const count = getRegistrationSummary(event.id, registrations);
  const availableSeats = Math.max(0, Number(event.capacity) - count);
  const isClosed = !event.registrationOpen || count >= Number(event.capacity);

  return {
    ...event,
    registrationCount: count,
    availableSeats,
    isClosed,
    registrationStatus: isClosed ? 'closed' : 'open',
  };
}

export function createApp(options = {}) {
  const config = getConfig(options);
  if (!config.adminPassword || !config.jwtSecret) {
    throw new Error('Set ADMIN_PASSWORD and JWT_SECRET in backend/.env before starting EventHub.');
  }
  const dataDir = options.dataDir || config.dataDir || path.resolve(process.cwd(), 'data');
  initializeDataStore(dataDir);

  const adminHash = bcrypt.hashSync(config.adminPassword, 10);
  const app = express();
  const sessionCookieName = 'eventhub_session';
  const allowedFrontendOrigins = String(config.frontendOrigin)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => callback(null, allowedFrontendOrigins.includes(origin)),
    credentials: true,
  }));
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && !allowedFrontendOrigins.includes(origin) && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED', message: 'This request origin is not allowed.' });
    }
    return next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.locals.dataDir = dataDir;

  function sendError(res, status, code, message, details) {
    const payload = { error: code, message };
    if (details) payload.details = details;
    return res.status(status).json(payload);
  }

  function readCurrentState() {
    return {
      events: readEvents(dataDir),
      registrations: readRegistrations(dataDir),
    };
  }

  function getCookie(req, name) {
    const cookies = String(req.headers.cookie || '').split(';');
    const cookie = cookies.find((item) => item.trim().startsWith(`${name}=`));
    if (!cookie) return null;
    try {
      return decodeURIComponent(cookie.trim().slice(name.length + 1));
    } catch {
      return null;
    }
  }

  function setSessionCookie(res, token) {
    const secure = config.nodeEnv === 'production' ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`
    );
  }

  function clearSessionCookie(res) {
    const secure = config.nodeEnv === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
  }

  function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : getCookie(req, sessionCookieName);

    if (!token) {
      return sendError(res, 401, 'AUTHENTICATION_REQUIRED', 'Please sign in to continue.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (error) {
      return sendError(res, 401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
    }
    if (decoded.jti && readRevokedSessions(dataDir).some((session) => session.jti === decoded.jti && session.expiresAt > Date.now())) {
      return sendError(res, 401, 'SESSION_EXPIRED', 'Your session has ended. Please sign in again.');
    }
    req.auth = decoded;
    return next();
  }

  function requireAdmin(req, res, next) {
    return authenticate(req, res, () => {
      if (req.auth.role !== 'admin') {
        return sendError(res, 403, 'FORBIDDEN', 'Administrator access is required.');
      }
      req.admin = { email: req.auth.email, sub: req.auth.sub };
      return next();
    });
  }

  function requireUser(req, res, next) {
    return authenticate(req, res, () => {
      if (req.auth.role !== 'user') {
        return sendError(res, 403, 'FORBIDDEN', 'A user account is required for this action.');
      }
      req.user = { id: req.auth.sub, email: req.auth.email, name: req.auth.name };
      return next();
    });
  }

  function issueSession(claims) {
    const jti = createId('session');
    const token = jwt.sign({ ...claims, jti }, config.jwtSecret, { expiresIn: '12h' });
    return { token, jti };
  }

  async function endSession(req, res) {
    const token = getCookie(req, sessionCookieName);
    if (token) {
      let decoded;
      try {
        decoded = jwt.verify(token, config.jwtSecret);
      } catch {
        decoded = null;
      }
      if (decoded?.jti) {
        try {
          await withWriteLock(async () => {
            const activeSessions = readRevokedSessions(dataDir).filter((session) => session.expiresAt > Date.now());
            activeSessions.push({ jti: decoded.jti, expiresAt: decoded.exp * 1000 });
            writeRevokedSessions(activeSessions, dataDir);
          });
        } catch (error) {
          console.error(error);
          return sendError(res, 500, 'LOGOUT_FAILED', 'Your session could not be ended. Please try again.');
        }
      }
    }
    clearSessionCookie(res);
    return res.json({ ok: true, message: 'You are signed out.' });
  }

  function validateRegistrationPayload(payload) {
    const errors = {};
    const fullName = String(payload?.fullName || '').trim();
    const email = String(payload?.email || '').trim();
    const organization = String(payload?.organization || '').trim();
    const interests = String(payload?.interests || '').trim();

    if (!fullName) {
      errors.fullName = 'Full name is required.';
    } else if (fullName.length < 2 || fullName.length > 120) {
      errors.fullName = 'Full name must be between 2 and 120 characters.';
    }

    if (!email) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!organization) {
      errors.organization = 'College or organization is required.';
    } else if (organization.length < 2 || organization.length > 180) {
      errors.organization = 'Organization should be between 2 and 180 characters.';
    }

    if (!interests) {
      errors.interests = 'Domain interests are required.';
    } else if (interests.length < 2 || interests.length > 200) {
      errors.interests = 'Domain interests should be between 2 and 200 characters.';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      data: { fullName, email, organization, interests },
    };
  }

  function validateEventPayload(payload) {
    const errors = {};
    const title = String(payload?.title || '').trim();
    const description = String(payload?.description || '').trim();
    const category = String(payload?.category || '').trim();
    const venue = String(payload?.venue || '').trim();
    const capacity = Number(payload?.capacity);
    const startAt = new Date(String(payload?.startAt || ''));
    const endAt = new Date(String(payload?.endAt || ''));

    if (!title) {
      errors.title = 'Event title is required.';
    } else if (title.length < 3 || title.length > 160) {
      errors.title = 'Event title must be between 3 and 160 characters.';
    }

    if (!description) {
      errors.description = 'Description is required.';
    } else if (description.length < 10 || description.length > 1200) {
      errors.description = 'Description must be between 10 and 1200 characters.';
    }

    if (!category) errors.category = 'Category is required.';
    if (!venue) errors.venue = 'Venue is required.';
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 5000) {
      errors.capacity = 'Capacity must be a number between 1 and 5000.';
    }

    if (Number.isNaN(startAt.getTime())) {
      errors.startAt = 'Start date is required.';
    }
    if (String(payload?.endAt || '').trim() && Number.isNaN(endAt.getTime())) {
      errors.endAt = 'End date is invalid.';
    }
    if (!Number.isNaN(startAt.getTime()) && !Number.isNaN(endAt.getTime()) && endAt < startAt) {
      errors.endAt = 'End date must be after the start date.';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      data: {
        title,
        description,
        category,
        venue,
        capacity: Number(capacity),
        startAt: payload?.startAt,
        endAt: payload?.endAt,
      },
    };
  }

  function buildPublicStats() {
    const { events, registrations } = readCurrentState();
    const now = new Date();
    return {
      totalEvents: events.length,
      totalRegistrations: registrations.length,
      upcomingEvents: events.filter((event) => new Date(event.startAt) >= now).length,
      availableSeats: events.reduce(
        (sum, event) => sum + Math.max(0, Number(event.capacity) - getRegistrationSummary(event.id, registrations)),
        0
      ),
      featuredEvents: events.filter((event) => event.featured).slice(0, 4).map((event) => enrichEvent(event, registrations)),
    };
  }

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'EventHub API' });
  });

  app.post('/api/auth/signup', async (req, res) => {
    const fullName = String(req.body?.fullName || '').trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const errors = {};

    if (fullName.length < 2 || fullName.length > 120) {
      errors.fullName = 'Full name must be between 2 and 120 characters.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (password.length < 8 || password.length > 128) {
      errors.password = 'Password must be between 8 and 128 characters.';
    }
    if (Object.keys(errors).length) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', errors);
    }

    try {
      let user;
      await withWriteLock(async () => {
        const users = readUsers(dataDir);
        if (users.some((item) => normalizeEmail(item.email) === email)) {
          throw Object.assign(new Error('ACCOUNT_EXISTS'), { status: 409, code: 'ACCOUNT_EXISTS' });
        }
        user = {
          id: createId('user'),
          name: fullName,
          email,
          passwordHash: await bcrypt.hash(password, 12),
          role: 'user',
          createdAt: new Date().toISOString(),
        };
        users.push(user);
        writeUsers(users, dataDir);
      });

      const { token } = issueSession({ sub: user.id, name: user.name, email: user.email, role: 'user' });
      setSessionCookie(res, token);
      return res.status(201).json({
        account: { id: user.id, name: user.name, email: user.email, role: user.role },
        message: 'Your account has been created.',
      });
    } catch (error) {
      if (error.code === 'ACCOUNT_EXISTS') {
        return sendError(res, 409, error.code, 'An account with this email already exists.');
      }
      return sendError(res, 500, 'SIGNUP_FAILED', 'Your account could not be created. Please try again.');
    }
  });

  app.post('/api/auth/signin', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Email and password are required.');
    }

    const user = readUsers(dataDir).find((item) => normalizeEmail(item.email) === email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return sendError(res, 401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.');
    }

    const { token } = issueSession({ sub: user.id, name: user.name, email: user.email, role: 'user' });
    setSessionCookie(res, token);
    return res.json({
      account: { id: user.id, name: user.name, email: user.email, role: user.role },
      message: 'You are signed in.',
    });
  });

  app.post('/api/auth/logout', endSession);

  app.get('/api/auth/me', (req, res) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ') && !getCookie(req, sessionCookieName)) {
      return res.json({ account: null });
    }
    return authenticate(req, res, () => {
      const account = req.auth.role === 'user'
        ? { id: req.auth.sub, name: req.auth.name, email: req.auth.email, role: 'user' }
        : { id: req.auth.sub, name: 'EventHub Admin', email: req.auth.email, role: 'admin' };
      return res.json({ account });
    });
  });

  app.get('/api/events', (req, res) => {
    const { events, registrations } = readCurrentState();
    res.json(events.map((event) => enrichEvent(event, registrations)));
  });

  app.get('/api/events/:id', (req, res) => {
    const { events, registrations } = readCurrentState();
    const event = events.find((item) => item.id === req.params.id);
    if (!event) {
      return sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
    }
    res.json(enrichEvent(event, registrations));
  });

  app.get('/api/events/:id/registrations/count', (req, res) => {
    const { events, registrations } = readCurrentState();
    const event = events.find((item) => item.id === req.params.id);
    if (!event) {
      return sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
    }
    const count = getRegistrationSummary(event.id, registrations);
    res.json({
      eventId: event.id,
      registrationCount: count,
      capacity: Number(event.capacity),
      availableSeats: Math.max(0, Number(event.capacity) - count),
    });
  });

  app.post('/api/events/:id/registrations', requireUser, async (req, res) => {
    const validation = validateRegistrationPayload({
      ...req.body,
      fullName: req.user.name,
      email: req.user.email,
    });
    if (!validation.isValid) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Please correct the form and try again.', validation.errors);
    }

    const eventId = req.params.id;
    const normalizedEmail = normalizeEmail(validation.data.email);

    try {
      await withWriteLock(async () => {
        const current = readCurrentState();
        const event = current.events.find((item) => item.id === eventId);
        if (!event) {
          throw Object.assign(new Error('EVENT_NOT_FOUND'), { status: 404, code: 'EVENT_NOT_FOUND' });
        }
        if (!event.registrationOpen) {
          throw Object.assign(new Error('REGISTRATION_CLOSED'), { status: 409, code: 'REGISTRATION_CLOSED' });
        }

        const duplicate = current.registrations.some(
          (registration) => String(registration.eventId) === String(eventId) && normalizeEmail(registration.email) === normalizedEmail
        );
        if (duplicate) {
          throw Object.assign(new Error('DUPLICATE_REGISTRATION'), { status: 409, code: 'DUPLICATE_REGISTRATION' });
        }

        const count = getRegistrationSummary(eventId, current.registrations);
        if (count >= Number(event.capacity)) {
          throw Object.assign(new Error('EVENT_FULL'), { status: 409, code: 'EVENT_FULL' });
        }

        const registration = {
          id: createId('reg'),
          eventId,
          userId: req.user.id,
          fullName: validation.data.fullName,
          email: normalizedEmail,
          organization: validation.data.organization,
          interests: validation.data.interests,
          status: 'confirmed',
          createdAt: new Date().toISOString(),
        };

        current.registrations.push(registration);
        writeRegistrations(current.registrations, dataDir);
        return registration;
      });

      const finalState = readCurrentState();
      const event = finalState.events.find((item) => item.id === eventId);
      const registration = finalState.registrations.find(
        (item) => item.eventId === eventId && normalizeEmail(item.email) === normalizedEmail
      );

      res.status(201).json({
        registration,
        event: enrichEvent(event, finalState.registrations),
        registrationCount: getRegistrationSummary(eventId, finalState.registrations),
      });
    } catch (error) {
      if (error && error.code) {
        const message =
          error.code === 'DUPLICATE_REGISTRATION'
            ? 'This email is already registered for this event.'
            : error.code === 'REGISTRATION_CLOSED'
              ? 'Registration for this event is currently closed.'
              : error.code === 'EVENT_FULL'
                ? 'This event has reached capacity.'
                : 'Registration could not be completed.';
        return sendError(res, error.status || 500, error.code, message);
      }
      return sendError(res, 500, 'REGISTRATION_FAILED', 'Registration could not be completed.');
    }
  });

  app.get('/api/stats/public', (req, res) => {
    res.json(buildPublicStats());
  });

  app.post('/api/admin/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const validEmail = email === config.adminEmail.toLowerCase();
    const validPassword = bcrypt.compareSync(password, adminHash);

    if (!validEmail || !validPassword) {
      return sendError(res, 401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
    }

    const { token } = issueSession({ sub: 'admin', email, role: 'admin' });
    setSessionCookie(res, token);
    return res.json({ account: { id: 'admin', name: 'EventHub Admin', email, role: 'admin' }, message: 'Admin login successful.' });
  });

  app.post('/api/admin/logout', endSession);

  app.get('/api/admin/me', requireAdmin, (req, res) => {
    res.json({ admin: { email: req.admin.email } });
  });

  app.get('/api/my/registrations', requireUser, (req, res) => {
    const { events, registrations } = readCurrentState();
    const rows = registrations
      .filter((registration) =>
        registration.userId
          ? registration.userId === req.user.id
          : normalizeEmail(registration.email) === normalizeEmail(req.user.email)
      )
      .map((registration) => ({
        ...registration,
        event: events.find((event) => event.id === registration.eventId) || null,
      }))
      .sort((a, b) => new Date(a.event?.startAt || a.createdAt) - new Date(b.event?.startAt || b.createdAt));
    return res.json(rows);
  });

  app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
    const { events, registrations } = readCurrentState();
    const now = new Date();
    const recentRegistrations = registrations
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8)
      .map((registration) => ({
        ...registration,
        eventTitle: events.find((event) => event.id === registration.eventId)?.title || 'Unknown event',
      }));

    const eventStats = events.map((event) => {
      const count = getRegistrationSummary(event.id, registrations);
      return {
        id: event.id,
        title: event.title,
        category: event.category,
        count,
        capacity: Number(event.capacity),
        availableSeats: Math.max(0, Number(event.capacity) - count),
        registrationOpen: event.registrationOpen,
      };
    });

    const upcomingEvents = events
      .filter((event) => new Date(event.startAt) >= now)
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
      .slice(0, 6);

    const summary = {
      totalEvents: events.length,
      totalRegistrations: registrations.length,
      upcomingEvents: upcomingEvents.length,
      availableSeats: events.reduce(
        (sum, event) => sum + Math.max(0, Number(event.capacity) - getRegistrationSummary(event.id, registrations)),
        0
      ),
    };

    res.json({ summary, recentRegistrations, eventStats, upcomingEvents });
  });

  app.get('/api/admin/events', requireAdmin, (req, res) => {
    const { events, registrations } = readCurrentState();
    res.json(events.map((event) => enrichEvent(event, registrations)));
  });

  app.post('/api/admin/events', requireAdmin, async (req, res) => {
    const validation = validateEventPayload(req.body);
    if (!validation.isValid) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Event details are invalid.', validation.errors);
    }

    const event = {
      id: req.body.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...validation.data,
      registrationOpen: req.body.registrationOpen !== false,
      featured: Boolean(req.body.featured),
      createdAt: new Date().toISOString(),
    };

    try {
      await withWriteLock(async () => {
        const current = readCurrentState();
        current.events.push(event);
        writeEvents(current.events, dataDir);
      });
      res.status(201).json({ event, message: 'Event created successfully.' });
    } catch (error) {
      return sendError(res, 500, 'EVENT_CREATE_FAILED', 'Event could not be created.');
    }
  });

  app.put('/api/admin/events/:id', requireAdmin, async (req, res) => {
    const validation = validateEventPayload(req.body);
    if (!validation.isValid) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Event details are invalid.', validation.errors);
    }

    try {
      await withWriteLock(async () => {
        const current = readCurrentState();
        const index = current.events.findIndex((event) => event.id === req.params.id);
        if (index === -1) {
          throw Object.assign(new Error('EVENT_NOT_FOUND'), { status: 404, code: 'EVENT_NOT_FOUND' });
        }

        const nextCapacity = Number(req.body.capacity);
        const currentCount = getRegistrationSummary(req.params.id, current.registrations);
        if (nextCapacity < currentCount) {
          throw Object.assign(new Error('CAPACITY_TOO_LOW'), { status: 400, code: 'CAPACITY_TOO_LOW' });
        }

        current.events[index] = {
          ...current.events[index],
          ...validation.data,
          capacity: nextCapacity,
          registrationOpen: req.body.registrationOpen !== undefined ? Boolean(req.body.registrationOpen) : current.events[index].registrationOpen,
          featured: Boolean(req.body.featured),
        };
        writeEvents(current.events, dataDir);
        return current.events[index];
      });

      const refreshed = readCurrentState();
      const event = refreshed.events.find((item) => item.id === req.params.id);
      res.json({ event: enrichEvent(event, refreshed.registrations), message: 'Event updated successfully.' });
    } catch (error) {
      if (error && error.code) {
        return sendError(
          res,
          error.status || 400,
          error.code,
          error.code === 'EVENT_NOT_FOUND' ? 'Event not found.' : 'Capacity cannot be reduced below current registrations.'
        );
      }
      return sendError(res, 500, 'EVENT_UPDATE_FAILED', 'Event update failed.');
    }
  });

  app.delete('/api/admin/events/:id', requireAdmin, async (req, res) => {
    try {
      await withWriteLock(async () => {
        const current = readCurrentState();
        const exists = current.events.some((event) => event.id === req.params.id);
        if (!exists) {
          throw Object.assign(new Error('EVENT_NOT_FOUND'), { status: 404, code: 'EVENT_NOT_FOUND' });
        }
        current.events = current.events.filter((event) => event.id !== req.params.id);
        current.registrations = current.registrations.filter((registration) => registration.eventId !== req.params.id);
        writeEvents(current.events, dataDir);
        writeRegistrations(current.registrations, dataDir);
      });
      res.json({ ok: true, message: 'Event and related registrations deleted.' });
    } catch (error) {
      if (error && error.code) {
        return sendError(res, error.status || 404, error.code, 'Event not found.');
      }
      return sendError(res, 500, 'EVENT_DELETE_FAILED', 'Event could not be deleted.');
    }
  });

  app.get('/api/admin/registrations', requireAdmin, (req, res) => {
    const { events, registrations } = readCurrentState();
    const rows = registrations
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((registration) => ({
        ...registration,
        eventTitle: events.find((event) => event.id === registration.eventId)?.title || 'Unknown event',
      }));
    res.json(rows);
  });

  app.get('/api/admin/registrations/:id', requireAdmin, (req, res) => {
    const { events, registrations } = readCurrentState();
    const registration = registrations.find((item) => item.id === req.params.id);
    if (!registration) {
      return sendError(res, 404, 'REGISTRATION_NOT_FOUND', 'Registration not found.');
    }
    const event = events.find((item) => item.id === registration.eventId);
    res.json({ ...registration, eventTitle: event ? event.title : 'Unknown event' });
  });

  app.patch('/api/admin/registrations/:id/status', requireAdmin, async (req, res) => {
    const status = String(req.body?.status || '').trim().toLowerCase();
    if (!VALID_STATUSES.includes(status)) {
      return sendError(res, 400, 'INVALID_STATUS', 'Status must be one of confirmed, attended, cancelled, waitlist, or pending.');
    }

    try {
      await withWriteLock(async () => {
        const current = readCurrentState();
        const index = current.registrations.findIndex((registration) => registration.id === req.params.id);
        if (index === -1) {
          throw Object.assign(new Error('REGISTRATION_NOT_FOUND'), { status: 404, code: 'REGISTRATION_NOT_FOUND' });
        }
        const previousStatus = current.registrations[index].status;
        if (
          !CAPACITY_COUNTING_STATUSES.includes(String(previousStatus || '').toLowerCase()) &&
          CAPACITY_COUNTING_STATUSES.includes(status)
        ) {
          const registration = current.registrations[index];
          const event = current.events.find((item) => item.id === registration.eventId);
          const count = getRegistrationSummary(registration.eventId, current.registrations);
          if (event && count >= Number(event.capacity)) {
            throw Object.assign(new Error('EVENT_FULL'), { status: 409, code: 'EVENT_FULL' });
          }
        }
        current.registrations[index].status = status;
        writeRegistrations(current.registrations, dataDir);
        return current.registrations[index];
      });

      const refreshed = readCurrentState();
      const saved = refreshed.registrations.find((registration) => registration.id === req.params.id);
      res.json({ registration: saved, message: 'Registration status updated.' });
    } catch (error) {
      if (error && error.code) {
        return sendError(
          res,
          error.status || 404,
          error.code,
          error.code === 'EVENT_FULL' ? 'This event has reached capacity.' : 'Registration not found.'
        );
      }
      return sendError(res, 500, 'STATUS_UPDATE_FAILED', 'Registration status update failed.');
    }
  });

  app.post('/api/admin/reset-demo-data', requireAdmin, (req, res) => {
    const confirmation = String(req.body?.confirmation || '');
    if (confirmation !== 'RESET_DEMO_DATA') {
      return sendError(res, 400, 'CONFIRMATION_REQUIRED', 'Add confirmation: RESET_DEMO_DATA.');
    }

    const result = resetDemoData(dataDir);
    res.json({ ok: true, message: 'Demo data reset successfully.', counts: { events: result.events.length, registrations: result.registrations.length } });
  });

  app.use((req, res) => {
    sendError(res, 404, 'NOT_FOUND', 'The requested resource was not found.');
  });

  app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected server error occurred.');
  });

  return app;
}
