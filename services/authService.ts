import {
  clearOfflineSession,
  hasOfflineSession,
  isPasswordSetOffline,
  markSetupComplete,
  refreshOfflineSessionFromLogin,
  verifyOfflinePassword,
} from './offlineAuth';

const withTimeout = async <T>(promiseFactory: (signal: AbortSignal) => Promise<T>, ms = 4500): Promise<T> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), ms);
  try {
    return await promiseFactory(controller.signal);
  } finally {
    window.clearTimeout(timeout);
  }
};

export const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('nir_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const isPasswordSet = async (): Promise<boolean> => {
  try {
    const response = await withTimeout(signal => fetch('/api/auth/status', {
      credentials: 'include',
      headers: getAuthHeaders(),
      signal,
    }));
    if (!response.ok) return isPasswordSetOffline();
    const setup = Boolean((await response.json()).setup);
    if (setup) await markSetupComplete();
    return setup;
  } catch {
    return isPasswordSetOffline();
  }
};

export const setPassword = async (password: string): Promise<void> => {
  const response = await withTimeout(signal => fetch('/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    credentials: 'include',
    signal,
    body: JSON.stringify({ password })
  }));
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Setup failed');
  if (payload.token) window.localStorage.setItem('nir_token', payload.token);
  await refreshOfflineSessionFromLogin(password, payload.user);
};

export const verifyPassword = async (password: string): Promise<boolean> => {
  try {
    const response = await withTimeout(signal => fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal,
      body: JSON.stringify({ password })
    }));
    if (!response.ok) return false;
    const payload = await response.json().catch(() => ({}));
    if (payload.token) window.localStorage.setItem('nir_token', payload.token);
    await refreshOfflineSessionFromLogin(password, payload.user);
    return true;
  } catch {
    return verifyOfflinePassword(password);
  }
};

export const login = (): void => {};

export const logout = async (): Promise<void> => {
  try {
    await withTimeout(signal => fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      signal,
    }), 2500);
  } catch {
    // Local logout must still succeed when the server is unavailable.
  } finally {
    window.localStorage.removeItem('nir_token');
    await clearOfflineSession();
  }
};

export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const response = await withTimeout(signal => fetch('/api/auth/me', {
      credentials: 'include',
      headers: getAuthHeaders(),
      signal,
    }));
    if (response.ok) return true;
    if (response.status === 401 || response.status === 403) {
      window.localStorage.removeItem('nir_token');
      await clearOfflineSession();
    }
    return false;
  } catch {
    return hasOfflineSession();
  }
};
