import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import paineasyLogo from '../assets/paineasy-logo.jpg';
import { Alert, Button, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { homeRouteFor } from '../config/navigation';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(form.username.trim(), form.password);
      // Return the user to whatever they were trying to reach.
      const target = location.state?.from?.pathname ?? homeRouteFor(user.role);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message ?? 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden flex-col items-center justify-center gap-10 bg-brand-800 p-12 text-brand-50 lg:flex">
        <img
          src={paineasyLogo}
          alt="PainEasy"
          className="w-64 rounded-2xl shadow-xl"
        />
        <div className="text-center">
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            Manage every session.
            <br />
            Run every clinic.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-brand-100 leading-relaxed">
            Think Physiotherapy ! Think us !
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="grid size-9 place-items-center rounded-lg bg-brand-600 font-bold text-white">
              C
            </span>
          </div>

          <h2 className="text-xl font-semibold text-ink-900">Sign in</h2>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {error && <Alert tone="error">{error}</Alert>}

            <Field label="Username" htmlFor="username" required>
              <Input
                id="username"
                name="username"
                value={form.username}
                onChange={update('username')}
                autoComplete="username"
                autoFocus
                required
              />
            </Field>

            <Field label="Password" htmlFor="password" required>
              <Input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={update('password')}
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </Field>

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}
