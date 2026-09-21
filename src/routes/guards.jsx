/**
 * Route guards.
 *
 * These improve the experience -- they are not the security boundary. Every
 * endpoint enforces the same rules server-side (Section 23), so bypassing a
 * guard in devtools yields a 403 from the API, not data.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { homeRouteFor } from '../config/navigation';

function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center text-brand-600">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-3 text-sm text-ink-500">Restoring your session…</p>
      </div>
    </div>
  );
}

/** Requires a signed-in user; remembers where they were headed. */
export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Requires one of `roles`; anything else is redirected to its own home. */
export function RequireRole({ roles }) {
  const { role, isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!roles.includes(role)) return <Navigate to={homeRouteFor(role)} replace />;
  return <Outlet />;
}

/** Keeps signed-in users off the login page. */
export function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) return <FullPageSpinner />;
  if (isAuthenticated) return <Navigate to={homeRouteFor(role)} replace />;
  return children;
}
