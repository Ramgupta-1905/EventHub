import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/server.js';

function buildApp(frontendOrigin = 'http://localhost:5173') {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eventhub-test-'));
  fs.writeFileSync(path.join(dataDir, 'events.json'), JSON.stringify([
    {
      id: 'test-event-one',
      title: 'Test Workshop One',
      description: 'A practical workshop for API test coverage.',
      category: 'Workshop',
      startAt: '2026-12-01T10:00:00.000Z',
      endAt: '2026-12-01T13:00:00.000Z',
      venue: 'Test Hall',
      capacity: 1,
      registrationOpen: true,
      featured: true,
      createdAt: '2026-09-01T09:00:00.000Z',
    },
    {
      id: 'test-event-two',
      title: 'Test Seminar Two',
      description: 'A second event for cross-event registration checks.',
      category: 'Seminar',
      startAt: '2026-12-05T11:00:00.000Z',
      endAt: '2026-12-05T14:00:00.000Z',
      venue: 'Community Studio',
      capacity: 20,
      registrationOpen: true,
      featured: false,
      createdAt: '2026-09-02T09:00:00.000Z',
    },
  ], null, 2));
  fs.writeFileSync(path.join(dataDir, 'registrations.json'), '[]');
  const app = createApp({
    dataDir,
    adminEmail: 'admin@test.local',
    adminPassword: 'TestPass123!',
    jwtSecret: 'test-secret',
    frontendOrigin,
  });
  return { app, dataDir };
}

async function signUp(agent, overrides = {}) {
  return agent.post('/api/auth/signup').send({
    fullName: 'Ava Patel',
    email: 'ava@example.test',
    password: 'SafePass123',
    ...overrides,
  });
}

async function signInAdmin(agent) {
  return agent.post('/api/admin/login').send({
    email: 'admin@test.local',
    password: 'TestPass123!',
  });
}

const registrationDetails = {
  organization: 'Test University',
  interests: 'Frontend engineering',
};

test('signup hashes the password and returns an HttpOnly session cookie', async () => {
  const { app, dataDir } = buildApp();
  const agent = request.agent(app);
  const response = await signUp(agent);
  const users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));

  assert.equal(response.status, 201);
  assert.equal(response.body.account.email, 'ava@example.test');
  assert.equal(response.body.account.role, 'user');
  assert.equal(response.body.passwordHash, undefined);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
  assert.equal(users.length, 1);
  assert.notEqual(users[0].passwordHash, 'SafePass123');
  assert.equal(users[0].password, undefined);
});

test('duplicate accounts are rejected with HTTP 409', async () => {
  const { app } = buildApp();
  const agent = request.agent(app);
  await signUp(agent);
  const duplicate = await signUp(request.agent(app), { email: ' AVA@example.test ' });

  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error, 'ACCOUNT_EXISTS');
});

test('signup validates name, email and password on the backend', async () => {
  const { app } = buildApp();
  const response = await request(app).post('/api/auth/signup').send({
    fullName: 'A',
    email: 'not-an-email',
    password: 'short',
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'VALIDATION_ERROR');
  assert.ok(response.body.details.fullName);
  assert.ok(response.body.details.email);
  assert.ok(response.body.details.password);
});

test('signin succeeds and incorrect credentials are rejected', async () => {
  const { app } = buildApp();
  await signUp(request.agent(app));
  const agent = request.agent(app);
  const success = await agent.post('/api/auth/signin').send({ email: 'AVA@example.test', password: 'SafePass123' });
  const incorrect = await request(app).post('/api/auth/signin').send({ email: 'ava@example.test', password: 'wrong-password' });

  assert.equal(success.status, 200);
  assert.equal(success.body.account.name, 'Ava Patel');
  assert.equal(incorrect.status, 401);
  assert.equal(incorrect.body.error, 'INVALID_CREDENTIALS');
});

test('session restores on refresh and logout invalidates the session', async () => {
  const { app } = buildApp();
  const agent = request.agent(app);
  const signup = await signUp(agent);
  const cookie = signup.headers['set-cookie'][0].split(';')[0];

  const restored = await agent.get('/api/auth/me');
  assert.equal(restored.status, 200);
  assert.equal(restored.body.account.email, 'ava@example.test');

  const logout = await agent.post('/api/auth/logout');
  const oldSession = await request(app).get('/api/auth/me').set('Cookie', cookie);
  assert.equal(logout.status, 200);
  assert.equal(oldSession.status, 401);
  assert.equal(oldSession.body.error, 'SESSION_EXPIRED');
});

test('event listing and detail are public and report dynamic counts', async () => {
  const { app } = buildApp();
  const events = await request(app).get('/api/events');
  const anonymousAccount = await request(app).get('/api/auth/me');
  assert.equal(events.status, 200);
  assert.equal(events.body.length, 2);
  assert.equal(anonymousAccount.status, 200);
  assert.equal(anonymousAccount.body.account, null);

  const event = events.body[0];
  const detail = await request(app).get(`/api/events/${event.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.registrationCount, 0);
  assert.equal(detail.body.availableSeats, event.capacity);
});

test('a new data directory is seeded with the official event catalogue on first initialization', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eventhub-seed-test-'));
  const app = createApp({
    dataDir,
    adminEmail: 'admin@test.local',
    adminPassword: 'TestPass123!',
    jwtSecret: 'test-secret',
  });
  const events = await request(app).get('/api/events');

  assert.equal(events.status, 200);
  assert.ok(events.body.length >= 10);
  assert.ok(events.body.some((event) => event.title === 'National Coding Challenge'));
});

test('credentialed CORS accepts configured local and LAN frontend origins and blocks other write origins', async () => {
  const { app } = buildApp('http://localhost:5173, http://eventhub-lan.test:5173');
  const preflight = await request(app)
    .options('/api/auth/signup')
    .set('Origin', 'http://eventhub-lan.test:5173')
    .set('Access-Control-Request-Method', 'POST');
  const blocked = await request(app)
    .post('/api/auth/signup')
    .set('Origin', 'http://malicious.test')
    .send({ fullName: 'Blocked User', email: 'blocked@example.test', password: 'SafePass123' });

  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers['access-control-allow-origin'], 'http://eventhub-lan.test:5173');
  assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error, 'ORIGIN_NOT_ALLOWED');
});

test('event registration requires authentication and persists actual user details', async () => {
  const { app } = buildApp();
  const eventId = (await request(app).get('/api/events')).body[0].id;
  const unauthorized = await request(app).post(`/api/events/${eventId}/registrations`).send(registrationDetails);
  const agent = request.agent(app);
  await signUp(agent);
  const response = await agent.post(`/api/events/${eventId}/registrations`).send(registrationDetails);

  assert.equal(unauthorized.status, 401);
  assert.equal(response.status, 201);
  assert.equal(response.body.registration.fullName, 'Ava Patel');
  assert.equal(response.body.registration.email, 'ava@example.test');
  assert.equal(response.body.registrationCount, 1);
});

test('authenticated registration validates required participant details', async () => {
  const { app } = buildApp();
  const eventId = (await request(app).get('/api/events')).body[0].id;
  const participant = request.agent(app);
  await signUp(participant);
  const invalid = await participant.post(`/api/events/${eventId}/registrations`).send({ organization: '', interests: 'A' });

  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, 'VALIDATION_ERROR');
  assert.ok(invalid.body.details.organization);
  assert.ok(invalid.body.details.interests);
});

test('duplicate registration returns HTTP 409 and a clear message', async () => {
  const { app } = buildApp();
  const eventId = (await request(app).get('/api/events')).body[0].id;
  const agent = request.agent(app);
  await signUp(agent);
  await agent.post(`/api/events/${eventId}/registrations`).send(registrationDetails);
  const duplicate = await agent.post(`/api/events/${eventId}/registrations`).send(registrationDetails);

  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error, 'DUPLICATE_REGISTRATION');
  assert.match(duplicate.body.message, /already registered/i);
});

test('users can register for separate events and cannot read another user registrations', async () => {
  const { app } = buildApp();
  const events = (await request(app).get('/api/events')).body;
  const firstUser = request.agent(app);
  const secondUser = request.agent(app);
  await signUp(firstUser, { email: 'first@example.test' });
  await signUp(secondUser, { email: 'second@example.test' });
  await firstUser.post(`/api/events/${events[0].id}/registrations`).send(registrationDetails);
  const secondEventRegistration = await firstUser.post(`/api/events/${events[1].id}/registrations`).send(registrationDetails);
  const firstUserRows = await firstUser.get('/api/my/registrations');
  const secondUserRows = await secondUser.get('/api/my/registrations');

  assert.equal(secondEventRegistration.status, 201);
  assert.equal(firstUserRows.body.length, 2);
  assert.equal(secondUserRows.body.length, 0);
});

test('admin endpoints reject anonymous and ordinary-user access', async () => {
  const { app } = buildApp();
  const anonymous = await request(app).get('/api/admin/dashboard');
  const user = request.agent(app);
  await signUp(user);
  const forbidden = await user.get('/api/admin/dashboard');

  assert.equal(anonymous.status, 401);
  assert.equal(forbidden.status, 403);
});

test('admin can access dashboard, manage events and update attendee status', async () => {
  const { app } = buildApp();
  const admin = request.agent(app);
  const login = await signInAdmin(admin);
  assert.equal(login.status, 200);
  assert.equal(login.body.account.role, 'admin');

  const dashboard = await admin.get('/api/admin/dashboard');
  const created = await admin.post('/api/admin/events').send({
    title: 'Future Summit',
    description: 'A future-focused demo event for portfolio work.',
    category: 'Community',
    startAt: '2027-01-01T10:00:00.000Z',
    endAt: '2027-01-01T15:00:00.000Z',
    venue: 'Demo Hub',
    capacity: 40,
    registrationOpen: true,
    featured: true,
  });
  const eventId = created.body.event.id;
  const updated = await admin.put(`/api/admin/events/${eventId}`).send({
    ...created.body.event,
    title: 'Future Summit Updated',
    capacity: 50,
  });
  const deleted = await admin.delete(`/api/admin/events/${eventId}`);

  assert.equal(dashboard.status, 200);
  assert.ok(dashboard.body.summary);
  assert.equal(created.status, 201);
  assert.equal(updated.status, 200);
  assert.equal(deleted.status, 200);
});

test('admin can update an attendee registration status', async () => {
  const { app } = buildApp();
  const participant = request.agent(app);
  await signUp(participant);
  const eventId = (await request(app).get('/api/events')).body[0].id;
  await participant.post(`/api/events/${eventId}/registrations`).send(registrationDetails);

  const admin = request.agent(app);
  await signInAdmin(admin);
  const rows = await admin.get('/api/admin/registrations');
  const updated = await admin
    .patch(`/api/admin/registrations/${rows.body[0].id}/status`)
    .send({ status: 'attended' });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.registration.status, 'attended');
});

test('admin event and registration payload validation rejects invalid dates and missing fields', async () => {
  const { app } = buildApp();
  const admin = request.agent(app);
  await signInAdmin(admin);
  const invalid = await admin.post('/api/admin/events').send({
    title: 'No',
    description: 'Short',
    category: '',
    startAt: 'not-a-date',
    endAt: '2026-01-01T09:00:00.000Z',
    venue: '',
    capacity: 0,
  });

  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, 'VALIDATION_ERROR');
  assert.ok(invalid.body.details.startAt);
  assert.ok(invalid.body.details.capacity);
});

test('event capacity is enforced and registration count remains derived from stored registrations', async () => {
  const { app } = buildApp();
  const events = (await request(app).get('/api/events')).body;
  const participant = request.agent(app);
  await signUp(participant);
  const first = await participant.post(`/api/events/${events[0].id}/registrations`).send(registrationDetails);
  const count = await request(app).get(`/api/events/${events[0].id}/registrations/count`);
  const full = await request.agent(app);
  await signUp(full, { email: 'second@example.test' });
  const rejected = await full.post(`/api/events/${events[0].id}/registrations`).send(registrationDetails);

  assert.equal(first.status, 201);
  assert.equal(count.body.registrationCount, 1);
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.error, 'EVENT_FULL');
});

test('user registrations persist across backend restarts', async () => {
  const { app, dataDir } = buildApp();
  const user = request.agent(app);
  await signUp(user);
  const eventId = (await request(app).get('/api/events')).body[1].id;
  await user.post(`/api/events/${eventId}/registrations`).send(registrationDetails);

  const restartedApp = createApp({
    dataDir,
    adminEmail: 'admin@test.local',
    adminPassword: 'TestPass123!',
    jwtSecret: 'test-secret',
  });
  const rows = await request.agent(restartedApp).get('/api/my/registrations');
  assert.equal(rows.status, 401);
  const persisted = JSON.parse(fs.readFileSync(path.join(dataDir, 'registrations.json'), 'utf8'));
  const users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
  assert.equal(persisted.length, 1);
  assert.equal(users.length, 1);
});
