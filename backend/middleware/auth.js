const crypto = require('crypto');
const mongoose = require('mongoose');
const Alumno = require('../models/Alumno');
const PersonalOrientacion = require('../models/PersonalOrientacion');
const { publicUser } = require('../utils/serializers');

const COOKIE_NAME = 'jutificat_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const secureCookie = process.env.NODE_ENV === 'production';

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function createSessionToken(userId, role, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    sub: String(userId),
    role,
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS
  })).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token, now = Date.now()) {
  if (typeof token !== 'string') return null;

  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.sub !== 'string' || !mongoose.isValidObjectId(data.sub)) return null;
    if (!['student', 'staff'].includes(data.role)) return null;
    if (!Number.isInteger(data.exp) || data.exp <= Math.floor(now / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  const cookies = (req.headers.cookie || '').split(';');
  const cookie = cookies.find((part) => part.trim().startsWith(`${name}=`));
  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.trim().slice(name.length + 1));
  } catch {
    return null;
  }
}

function setSessionCookie(res, userId, role) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(createSessionToken(userId, role))}`,
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (secureCookie) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const parts = [`${COOKIE_NAME}=`, 'Max-Age=0', 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secureCookie) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin && origin !== FRONTEND_ORIGIN) {
    return res.status(403).json({ error: 'Origen de solicitud no permitido.' });
  }
  next();
}

async function requireAuth(req, res, next) {
  const token = getCookie(req, COOKIE_NAME);
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  }

  try {
    const role = session.role;
    const user = role === 'staff'
      ? await PersonalOrientacion.findById(session.sub).select('-contraseña')
      : await Alumno.findById(session.sub).select('-contraseña');
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'La sesión ya no es válida. Inicia sesión nuevamente.' });
    }
    req.user = publicUser(user, role);
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
    }
    next();
  };
}

module.exports = {
  COOKIE_NAME,
  FRONTEND_ORIGIN,
  clearSessionCookie,
  createSessionToken,
  requireAuth,
  requireRole,
  requireSameOrigin,
  setSessionCookie,
  verifySessionToken
};
