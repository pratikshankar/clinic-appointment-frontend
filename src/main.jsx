import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import './index.css';

// When the app is served from a sub-path (e.g. https://host/absproxy/5173/),
// the router must know about that prefix or no route matches. Vite sets
// BASE_URL from the `base` config option.
const rawBase = import.meta.env.BASE_URL ?? '/';
const basename = rawBase.replace(/\/$/, '') || '/';

/**
 * If the page was loaded from a path outside `basename`, React Router matches
 * nothing at all -- not even the catch-all 404 -- and renders an empty tree.
 * The result is a blank page whose only clue is a console warning, which is a
 * miserable thing to debug. The usual cause is a browser cache holding a bundle
 * built with a different `base`. Detect it and say so.
 */
function basenameMismatch() {
  if (basename === '/') return null;
  const path = window.location.pathname;
  if (path === basename || path.startsWith(`${basename}/`)) return null;
  return { expected: basename, actual: path };
}

function StartupProblem({ expected, actual }) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '44rem' }}>
      <h1 style={{ fontSize: '1.125rem', margin: '0 0 .5rem' }}>
        This page was served from the wrong path
      </h1>
      <p style={{ color: '#4a545f', lineHeight: 1.5 }}>
        The app is built to run under <code>{expected}/</code> but the browser is at{' '}
        <code>{actual}</code>, so no route can match. This almost always means the
        browser cached an older build. A hard reload fixes it.
      </p>
      <ul style={{ color: '#4a545f', lineHeight: 1.7 }}>
        <li>
          Hard reload: <strong>Ctrl+Shift+R</strong> (Windows/Linux) or{' '}
          <strong>Cmd+Shift+R</strong> (macOS)
        </li>
        <li>
          Or open <a href={`${expected}/`}>{expected}/</a> directly
        </li>
      </ul>
    </div>
  );
}

const mismatch = basenameMismatch();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {mismatch ? (
        <StartupProblem {...mismatch} />
      ) : (
        <BrowserRouter basename={basename}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      )}
    </ErrorBoundary>
  </React.StrictMode>
);
