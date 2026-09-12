import { getDB } from './dbStore';

const KEY = 'nirOfflineAuth';
const ITERATIONS = 210000;

type OfflineAuthRecord = {
  enabled: boolean;
  setupComplete: boolean;
  username: string;
  role: string;
  userId: string;
  salt: string;
  verifier: string;
};

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));

const deriveVerifier = async (password: string, salt: Uint8Array) => {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
};

const getRecord = async (): Promise<OfflineAuthRecord | undefined> => {
  const db = await getDB();
  return (await db.get('store', KEY)) as OfflineAuthRecord | undefined;
};

export const rememberSuccessfulLogin = async (
  password: string,
  user: { id?: string; username?: string; role?: string } = {},
) => {
  if (!password || password.length < 4) return;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const verifier = await deriveVerifier(password, salt);
  const record: OfflineAuthRecord = {
    enabled: true,
    setupComplete: true,
    username: user.username || 'admin',
    role: user.role || 'admin',
    userId: user.id || 'local-admin',
    salt: bytesToBase64(salt),
    verifier: bytesToBase64(verifier),
  };
  const db = await getDB();
  await db.put('store', record, KEY);
};

export const markSetupComplete = async () => {
  const record = await getRecord();
  const next: OfflineAuthRecord = record || {
    enabled: false,
    setupComplete: true,
    username: 'admin',
    role: 'admin',
    userId: 'local-admin',
    salt: '',
    verifier: '',
  };
  next.setupComplete = true;
  await (await getDB()).put('store', next, KEY);
};

export const isPasswordSetOffline = async () => Boolean((await getRecord())?.setupComplete);

export const hasOfflineSession = async () => Boolean((await getRecord())?.enabled);

export const verifyOfflinePassword = async (password: string) => {
  const record = await getRecord();
  if (!record?.enabled || !record.salt || !record.verifier) return false;
  const actual = await deriveVerifier(password, base64ToBytes(record.salt));
  const expected = base64ToBytes(record.verifier);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
};

export const clearOfflineSession = async () => {
  const record = await getRecord();
  if (!record) return;
  record.enabled = false;
  await (await getDB()).put('store', record, KEY);
};

export const refreshOfflineSessionFromLogin = rememberSuccessfulLogin;
