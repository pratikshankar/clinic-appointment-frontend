/**
 * Top-level error boundary.
 *
 * Without one, any exception thrown during render unmounts the whole tree and
 * leaves an empty <div id="root">, i.e. a blank white page with the reason
 * visible only in the browser console. This turns that into a readable screen.
 */

import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Keep the console trace too -- it has the component stack.
    console.error('Unhandled render error:', error, info);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-6 py-12">
        <div className="w-full max-w-2xl rounded-xl bg-white p-6 ring-1 ring-ink-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
            Something broke
          </p>
          <h1 className="mt-1 text-lg font-semibold text-ink-900">
            The page failed to render
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            This is an application bug, not a problem with your data. Nothing has been
            changed or lost.
          </p>

          <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-ink-950 px-4 py-3 text-xs leading-relaxed text-ink-100">
            {String(error?.message ?? error)}
            {info?.componentStack ? `\n${info.componentStack}` : ''}
          </pre>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Reload the page
            </button>
            <button
              type="button"
              onClick={() => {
                // A stale or corrupt token is a common cause; clearing it and
                // returning to the login page is the usual way out.
                try {
                  localStorage.clear();
                } catch {
                  /* private browsing can block this */
                }
                window.location.href = import.meta.env.BASE_URL ?? '/';
              }}
              className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-ink-800 ring-1 ring-inset ring-ink-300 hover:bg-ink-50"
            >
              Sign out and start over
            </button>
          </div>
        </div>
      </div>
    );
  }
}
