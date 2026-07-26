/**
 * NAMO IMS — API Client
 * Wraps fetch with auth headers, token refresh, and base URL handling.
 */

const API_HOST = import.meta.env.VITE_API_URL || '';
const BASE = `${API_HOST}/api`;

let _accessToken = null;
let _refreshing  = null; // promise guard for concurrent refresh

export function setToken(token) { _accessToken = token; }
export function getToken()      { return _accessToken;  }
export function clearToken()    { _accessToken = null;  }

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function request(path, options = {}, retry = true) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Auto-refresh on 401
  if (res.status === 401 && retry) {
    try {
      if (!_refreshing) {
        _refreshing = refreshTokens().finally(() => { _refreshing = null; });
      }
      await _refreshing;
      return request(path, options, false);
    } catch {
      _accessToken = null;
      window.dispatchEvent(new Event('namo:logout'));
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body.error || body.message || msg;
    } catch {}
    throw new Error(msg);
  }

  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

async function refreshTokens() {
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Refresh failed');
  const data = await res.json();
  _accessToken = data.accessToken;
  return data;
}

// ─── HTTP methods ─────────────────────────────────────────────────────────────
export const api = {
  get:    (path, opts)  => request(path, { method: 'GET',    ...opts }),
  post:   (path, body, opts) => request(path, { method: 'POST',   body: JSON.stringify(body), ...opts }),
  put:    (path, body, opts) => request(path, { method: 'PUT',    body: JSON.stringify(body), ...opts }),
  patch:  (path, body, opts) => request(path, { method: 'PATCH',  body: JSON.stringify(body), ...opts }),
  delete: (path, opts)  => request(path, { method: 'DELETE', ...opts }),

  // Multipart form upload (no Content-Type — browser sets boundary)
  upload: (path, formData) => {
    const headers = {};
    if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;
    return fetch(`${BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    }).then(async res => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed');
      }
      return res.json();
    });
  },
};

export default api;
