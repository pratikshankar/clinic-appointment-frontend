/**
 * 404 page.
 *
 * Previously lived in `Placeholders.jsx` alongside stubs for unbuilt phases.
 * Every phase now has a real screen, so the stubs are gone and this is all that
 * was left of that file.
 */

import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <p className="text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-2 text-xl font-semibold text-ink-900">Page not found</h1>
        <p className="mt-1 text-sm text-ink-500">
          That address does not exist in the application.
        </p>
        <Link
          to="/"
          className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Go to my dashboard
        </Link>
      </div>
    </div>
  );
}
