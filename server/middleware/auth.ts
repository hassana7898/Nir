import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createDBSession, findDBSession, deleteDBSession } from '../repositories/sessionRepository';

export interface AuthUser { id: string; username: string; role: string; }

declare global { namespace Express { interface Request { user?: AuthUser; sessionToken?: string; } } }

const SESSION_COOKIE = 'nir_session';
const getJwtSecret = (): string => process.env.JWT_SECRET || 'nir-app-session-secret-key-fallback-2026';
const crossSiteCookie = process.env.CROSS_SITE_COOKIE !== undefined
  ? String(process.env.CROSS_SITE_COOKIE).toLowerCase() === 'true'
  : true;

export const getSessionToken = (req: Request): string | null => {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.split(';').map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`));
  if (match) return decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));

  // Also support Authorization: Bearer <token> header for API calls
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = getSessionToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  try {
    const dbUser = await findDBSession(token);
    if (dbUser) {
      req.user = dbUser;
      req.sessionToken = token;
      return next();
    }

    const secret = getJwtSecret();
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'nir-app' }) as AuthUser;
    req.user = { id: payload.id, username: payload.username, role: payload.role };
    req.sessionToken = token;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired or invalid.' });
  }
};

export const setSessionCookie = async (req: Request, res: Response, user: AuthUser): Promise<string> => {
  let token: string;
  try {
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    token = await createDBSession(user, ip, userAgent);
  } catch (err) {
    console.warn('Failed to create DB session, falling back to JWT:', err);
    const secret = getJwtSecret();
    token = jwt.sign(user, secret, { algorithm: 'HS256', expiresIn: '30d', issuer: 'nir-app', subject: user.id });
  }

  const secure = process.env.NODE_ENV === 'production' && req.protocol === 'https';
  const sameSite = crossSiteCookie ? 'None' : 'Lax';
  const securePart = secure || crossSiteCookie ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=2592000${securePart}`);
  return token;
};

export const clearSessionCookie = async (req: Request, res: Response): Promise<void> => {
  const token = getSessionToken(req);
  if (token) await deleteDBSession(token).catch(() => {});
  const sameSite = crossSiteCookie ? 'None' : 'Lax';
  const securePart = crossSiteCookie ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=0${securePart}`);
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'احراز هویت انجام نشده است.' });
    const userRole = (req.user.role || '').toUpperCase();
    if (userRole === 'ADMIN') return next();
    if (allowedRoles.map(r => r.toUpperCase()).includes(userRole)) return next();
    return res.status(403).json({ error: 'عدم دسترسی: شما مجوز لازم برای این عملیات را ندارید.' });
  };
};
