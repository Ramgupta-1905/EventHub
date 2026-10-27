import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DATA_DIR = path.resolve(process.cwd(), 'data');
const DEFAULT_SEED_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/seed');

export function resolveDataDir(dataDir = process.env.DATA_DIR || DEFAULT_DATA_DIR) {
  return path.resolve(dataDir);
}

export function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

export function isCapacityCountingStatus(status = '') {
  return ['confirmed', 'attended', 'waitlist'].includes(String(status).trim().toLowerCase());
}

export function getEventRegistrationCount(eventId, registrations = []) {
  return registrations.filter(
    (registration) => String(registration.eventId) === String(eventId) && isCapacityCountingStatus(registration.status)
  ).length;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) {
    return [];
  }
  return JSON.parse(raw);
}

function writeJsonFileAtomic(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tempFile = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tempFile, filePath);
}

export function seedDataFromFiles(dataDir, seedDir = path.join(dataDir, 'seed')) {
  const eventSeedPath = path.join(seedDir, 'events.json');
  const registrationSeedPath = path.join(seedDir, 'registrations.json');
  const eventFile = path.join(dataDir, 'events.json');
  const registrationFile = path.join(dataDir, 'registrations.json');

  ensureDir(dataDir);
  ensureDir(seedDir);

  if (!fs.existsSync(eventSeedPath)) {
    fs.writeFileSync(eventSeedPath, JSON.stringify([], null, 2) + '\n', 'utf8');
  }
  if (!fs.existsSync(registrationSeedPath)) {
    fs.writeFileSync(registrationSeedPath, JSON.stringify([], null, 2) + '\n', 'utf8');
  }

  const sourceEventSeed = fs.existsSync(eventSeedPath) ? eventSeedPath : path.join(DEFAULT_SEED_DIR, 'events.json');
  const sourceRegistrationSeed = fs.existsSync(registrationSeedPath) ? registrationSeedPath : path.join(DEFAULT_SEED_DIR, 'registrations.json');

  if (!fs.existsSync(eventFile)) {
    fs.copyFileSync(sourceEventSeed, eventFile);
  }
  if (!fs.existsSync(registrationFile)) {
    fs.copyFileSync(sourceRegistrationSeed, registrationFile);
  }

  try {
    readJsonFile(eventFile);
    readJsonFile(registrationFile);
  } catch (error) {
    if (fs.existsSync(eventFile)) {
      fs.copyFileSync(eventSeedPath, `${eventFile}.bak-${Date.now()}`);
    }
    if (fs.existsSync(registrationFile)) {
      fs.copyFileSync(registrationSeedPath, `${registrationFile}.bak-${Date.now()}`);
    }
    fs.copyFileSync(sourceEventSeed, eventFile);
    fs.copyFileSync(sourceRegistrationSeed, registrationFile);
  }
}

export function initializeDataStore(dataDir = DEFAULT_DATA_DIR) {
  const resolved = resolveDataDir(dataDir);
  const seedDir = path.join(resolved, 'seed');
  const eventFile = path.join(resolved, 'events.json');
  const registrationFile = path.join(resolved, 'registrations.json');
  const usersFile = path.join(resolved, 'users.json');
  const revokedSessionsFile = path.join(resolved, 'revoked-sessions.json');

  ensureDir(seedDir);
  const defaultEventSeed = path.join(DEFAULT_SEED_DIR, 'events.json');
  const defaultRegistrationSeed = path.join(DEFAULT_SEED_DIR, 'registrations.json');

  if (!fs.existsSync(path.join(seedDir, 'events.json')) && fs.existsSync(defaultEventSeed)) {
    fs.copyFileSync(defaultEventSeed, path.join(seedDir, 'events.json'));
  }
  if (!fs.existsSync(path.join(seedDir, 'registrations.json')) && fs.existsSync(defaultRegistrationSeed)) {
    fs.copyFileSync(defaultRegistrationSeed, path.join(seedDir, 'registrations.json'));
  }

  seedDataFromFiles(resolved, seedDir);
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, '[]\n', 'utf8');
  }
  if (!fs.existsSync(revokedSessionsFile)) {
    fs.writeFileSync(revokedSessionsFile, '[]\n', 'utf8');
  }
  return {
    dataDir: resolved,
    eventsPath: eventFile,
    registrationsPath: registrationFile,
    usersPath: usersFile,
    revokedSessionsPath: revokedSessionsFile,
  };
}

export function readEvents(dataDir = DEFAULT_DATA_DIR) {
  const resolved = resolveDataDir(dataDir);
  const filePath = path.join(resolved, 'events.json');
  const seedDir = path.join(resolved, 'seed');
  if (!fs.existsSync(filePath)) {
    seedDataFromFiles(resolved, seedDir);
  }

  try {
    return readJsonFile(filePath);
  } catch (error) {
    const seedFile = path.join(seedDir, 'events.json');
    if (fs.existsSync(seedFile)) {
      const seedData = readJsonFile(seedFile);
      writeJsonFileAtomic(filePath, seedData);
      return seedData;
    }
    const fallback = [];
    writeJsonFileAtomic(filePath, fallback);
    return fallback;
  }
}

export function readRegistrations(dataDir = DEFAULT_DATA_DIR) {
  const resolved = resolveDataDir(dataDir);
  const filePath = path.join(resolved, 'registrations.json');
  const seedDir = path.join(resolved, 'seed');
  if (!fs.existsSync(filePath)) {
    seedDataFromFiles(resolved, seedDir);
  }

  try {
    return readJsonFile(filePath);
  } catch (error) {
    const seedFile = path.join(seedDir, 'registrations.json');
    if (fs.existsSync(seedFile)) {
      const seedData = readJsonFile(seedFile);
      writeJsonFileAtomic(filePath, seedData);
      return seedData;
    }
    const fallback = [];
    writeJsonFileAtomic(filePath, fallback);
    return fallback;
  }
}

export function readUsers(dataDir = DEFAULT_DATA_DIR) {
  const resolved = resolveDataDir(dataDir);
  const filePath = path.join(resolved, 'users.json');
  if (!fs.existsSync(filePath)) {
    writeJsonFileAtomic(filePath, []);
  }
  return readJsonFile(filePath);
}

export function readRevokedSessions(dataDir = DEFAULT_DATA_DIR) {
  const resolved = resolveDataDir(dataDir);
  const filePath = path.join(resolved, 'revoked-sessions.json');
  if (!fs.existsSync(filePath)) {
    writeJsonFileAtomic(filePath, []);
  }
  return readJsonFile(filePath);
}

export function writeEvents(events, dataDir = DEFAULT_DATA_DIR) {
  const resolved = resolveDataDir(dataDir);
  writeJsonFileAtomic(path.join(resolved, 'events.json'), events);
  return events;
}

export function writeUsers(users, dataDir = DEFAULT_DATA_DIR) {
  const resolved = resolveDataDir(dataDir);
  writeJsonFileAtomic(path.join(resolved, 'users.json'), users);
  return users;
}

export function writeRevokedSessions(sessions, dataDir = DEFAULT_DATA_DIR) {
  const resolved = resolveDataDir(dataDir);
  writeJsonFileAtomic(path.join(resolved, 'revoked-sessions.json'), sessions);
  return sessions;
}

export function writeRegistrations(registrations, dataDir = DEFAULT_DATA_DIR) {
  const resolved = resolveDataDir(dataDir);
  writeJsonFileAtomic(path.join(resolved, 'registrations.json'), registrations);
  return registrations;
}

export function resetDemoData(dataDir = DEFAULT_DATA_DIR) {
  const resolved = resolveDataDir(dataDir);
  const seedDir = path.join(resolved, 'seed');
  ensureDir(seedDir);

  const eventSeedPath = path.join(seedDir, 'events.json');
  const registrationSeedPath = path.join(seedDir, 'registrations.json');

  if (!fs.existsSync(eventSeedPath)) {
    throw new Error('Seed file missing for events.');
  }
  if (!fs.existsSync(registrationSeedPath)) {
    throw new Error('Seed file missing for registrations.');
  }

  const events = readJsonFile(eventSeedPath);
  const registrations = readJsonFile(registrationSeedPath);
  writeJsonFileAtomic(path.join(resolved, 'events.json'), events);
  writeJsonFileAtomic(path.join(resolved, 'registrations.json'), registrations);
  return { events, registrations };
}

let writeQueue = Promise.resolve();
export function withWriteLock(task) {
  const next = writeQueue.then(task, task);
  writeQueue = next.catch(() => undefined);
  return next;
}

export function createId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function uniqueNormalizedEmails(registrations) {
  const seen = new Set();
  registrations.forEach((registration) => {
    const key = `${registration.eventId}:${normalizeEmail(registration.email)}`;
    if (seen.has(key)) {
      throw new Error('Duplicate normalized email/event pair detected in seed data.');
    }
    seen.add(key);
  });
  return seen;
}
