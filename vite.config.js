import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite configuration.
 *
 * Several settings exist to support remote development (code-server,
 * Codespaces, a dev box behind a tunnel), where the browser is not on the same
 * machine as the dev server and often reaches it through a sub-path:
 *
 * - `base` — when the app is served under a sub-path, asset URLs must carry that
 *   prefix, because Vite's dev server always emits root-absolute module URLs.
 *   Set VITE_BASE_PATH to the prefix, with both slashes.
 *
 *   Important: the proxy must *preserve* the prefix when forwarding. code-server
 *   offers both, and only one works here:
 *     /absproxy/5173/  keeps the path   -> use this, with VITE_BASE_PATH=/absproxy/5173/
 *     /proxy/5173/     strips the path  -> unusable for a Vite dev server; the
 *                                         browser requests /src/main.jsx at the
 *                                         domain root and gets a blank page,
 *                                         and a matching `base` causes a 302 loop.
 *
 * - `allowedHosts` — Vite rejects unrecognised Host headers as protection
 *   against DNS rebinding, so a tunnelled hostname must be declared. Set
 *   VITE_ALLOWED_HOSTS (comma-separated); a leading dot covers all subdomains.
 *   Use "true" to disable the check entirely (not recommended).
 *
 * - `server.hmr` — the hot-reload websocket needs the browser-visible host and
 *   port, which behind an HTTPS proxy is wss on 443, not ws on 5173.
 *
 * - `server.proxy` — /api is forwarded to the backend so the browser makes
 *   same-origin calls. This works through any tunnel and avoids CORS entirely.
 */
export default defineConfig(({ mode }) => {
  // Third argument '' loads all variables, not just the VITE_-prefixed ones.
  const env = loadEnv(mode, process.cwd(), '');

  const base = env.VITE_BASE_PATH || '/';

  const rawHosts = (env.VITE_ALLOWED_HOSTS ?? '').trim();
  const allowedHosts =
    rawHosts === 'true'
      ? true
      : rawHosts
        ? rawHosts.split(',').map((host) => host.trim()).filter(Boolean)
        : ['localhost', '127.0.0.1'];

  // Only override HMR when the browser reaches the dev server somewhere other
  // than localhost:5173; otherwise leave Vite's own defaults alone.
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000';

  const hmr = env.VITE_HMR_HOST
    ? {
        protocol: env.VITE_HMR_PROTOCOL || 'wss',
        host: env.VITE_HMR_HOST,
        clientPort: Number(env.VITE_HMR_CLIENT_PORT || 443),
      }
    : undefined;

  return {
    base,
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      host: true,
      allowedHosts,
      // Dev modules must never be cached. Behind a reverse proxy (code-server,
      // Codespaces) an intermediary or the browser can hold a module compiled
      // against an older pre-bundled dependency. Mixing those with fresh ones
      // loads React twice, and the second copy has a null hook dispatcher --
      // which surfaces as "Cannot read properties of null (reading 'useState')"
      // in whichever components happen to sit behind the stale module.
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
      ...(hmr ? { hmr } : {}),
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        // When served under a prefix, the browser calls "<base>api/...". Match
        // that too and strip the prefix before forwarding to the backend.
        ...(base !== '/'
          ? {
              [`${base}api`]: {
                target: proxyTarget,
                changeOrigin: true,
                rewrite: (path) => path.replace(base, '/'),
              },
            }
          : {}),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
