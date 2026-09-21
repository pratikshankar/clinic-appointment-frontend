/**
 * Single HTTP client for the whole app.
 *
 * Responsibilities kept in one place: base URL, bearer token, the server's
 * error envelope, and transparent access-token refresh. Components never call
 * fetch() directly, so auth handling can change without touching pages.
 */

/**
 * API base URL.
 *
 * Defaults to `<app base>/api` -- a same-origin path that goes through the Vite
 * dev proxy. Deriving it from `import.meta.env.BASE_URL` means it is correct
 * whether the app is served from "/" or from a proxy sub-path such as
 * "/proxy/5173/", with no extra configuration. Set VITE_API_BASE_URL to an
 * absolute URL to talk to the backend directly instead (which then requires the
 * browser's origin to be listed in CLINIC_CORS_ORIGINS).
 */
const APP_BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || `${APP_BASE}/api`).replace(/\/$/, '');

const ACCESS_TOKEN_KEY = 'clinic.access_token';
const REFRESH_TOKEN_KEY = 'clinic.refresh_token';

/** Thrown for every non-2xx response, carrying the server's error envelope. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Field-level messages keyed by field name, for form highlighting. */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return this.details.reduce((acc, item) => {
      if (item?.field) acc[item.field] = item.message;
      return acc;
    }, {});
  }
}

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  set({ access_token, refresh_token }) {
    if (access_token) localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

/** Called when refreshing fails, so the app can drop to the login screen. */
let onAuthFailure = () => {};
export function setAuthFailureHandler(handler) {
  onAuthFailure = handler;
}

// Concurrent 401s share one refresh call instead of racing each other.
let refreshPromise = null;

async function refreshAccessToken() {
  const refresh_token = tokenStore.refresh;
  if (!refresh_token) return false;

  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    })
      .then(async (response) => {
        if (!response.ok) return false;
        tokenStore.set(await response.json());
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function parseError(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON error body (proxy error page, empty 502, ...).
  }
  const envelope = payload?.error ?? {};
  return new ApiError(
    response.status,
    envelope.code ?? 'http_error',
    envelope.message ?? `Request failed (${response.status})`,
    envelope.details
  );
}

async function request(path, { method = 'GET', body, params, auth = true, retry = true } = {}) {
  // The second argument lets BASE_URL be relative (e.g. "/api" when going
  // through the Vite dev proxy) as well as absolute.
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
  }

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Cannot reach the server. Is the backend running?');
  }

  // One transparent refresh-and-retry on an expired access token.
  if (response.status === 401 && auth && retry && tokenStore.refresh) {
    if (await refreshAccessToken()) {
      return request(path, { method, body, params, auth, retry: false });
    }
    tokenStore.clear();
    onAuthFailure();
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return null;
  return response.json();
}

/**
 * Fetch a binary response (a PDF) with the same auth and refresh handling.
 *
 * A plain `<a href>` cannot be used for these: the endpoints need an
 * Authorization header, and putting the token in a query string would leak it
 * into browser history and server logs.
 */
async function requestBlob(path, { retry = true } = {}) {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  const headers = {};
  if (tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;

  let response;
  try {
    response = await fetch(url, { headers });
  } catch {
    throw new ApiError(0, 'network_error', 'Cannot reach the server. Is the backend running?');
  }

  if (response.status === 401 && retry && tokenStore.refresh) {
    if (await refreshAccessToken()) return requestBlob(path, { retry: false });
    tokenStore.clear();
    onAuthFailure();
  }

  if (!response.ok) throw await parseError(response);

  // The server names the file; falling back keeps a download working even if a
  // proxy strips the header.
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return { blob: await response.blob(), filename: match?.[1] ?? 'document.pdf' };
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body, options) => request(path, { method: 'POST', body, ...options }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  blob: requestBlob,
  baseUrl: BASE_URL,
};

/** Save a fetched blob to disk under the filename the server chose. */
export function saveBlob({ blob, filename }) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: revoking immediately can cancel the download in
  // some browsers before it has started reading the object URL.
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Open a fetched blob in a new tab, for a look before printing or sending. */
export function openBlob({ blob }) {
  const href = URL.createObjectURL(blob);
  const opened = window.open(href, '_blank');
  if (!opened) {
    // Pop-up blocked. Downloading is a worse experience than a preview but a
    // much better one than nothing happening at all.
    const link = document.createElement('a');
    link.href = href;
    link.download = 'document.pdf';
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(href), 60000);
}
