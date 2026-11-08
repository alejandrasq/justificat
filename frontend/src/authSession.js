const SESSION_TOKEN_KEY = 'justificat_session_token';

export function getSessionToken() {
  return window.sessionStorage.getItem(SESSION_TOKEN_KEY);
}

export function saveSessionToken(token) {
  if (typeof token !== 'string' || !token) {
    throw new Error('El servidor no devolvió un token de sesión válido.');
  }
  window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken() {
  window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
}
