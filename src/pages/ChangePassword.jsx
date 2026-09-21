import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Alert, Button, Card, CardHeader, Field, Input, PageHeader } from '../components/ui';
import { authService } from '../services';

export default function ChangePassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [state, setState] = useState({ error: null, success: false, submitting: false });

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (form.next !== form.confirm) {
      setState({ error: 'The two new passwords do not match', success: false, submitting: false });
      return;
    }
    setState({ error: null, success: false, submitting: true });
    try {
      await authService.changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      setState({ error: null, success: true, submitting: false });
    } catch (err) {
      setState({ error: err.message, success: false, submitting: false });
    }
  }

  return (
    <>
      <PageHeader title="Change password" description="Update the password for your own account." />

      <form onSubmit={submit} className="max-w-md">
        <Card>
          <CardHeader title="Your password" />
          <div className="space-y-4 px-5 py-4">
            {state.error && <Alert tone="error">{state.error}</Alert>}
            {state.success && (
              <Alert tone="success">
                Password updated. Your next sign-in will use the new password.
              </Alert>
            )}

            <Field label="Current password" htmlFor="current" required>
              <Input
                id="current"
                type="password"
                value={form.current}
                onChange={update('current')}
                required
                autoComplete="current-password"
              />
            </Field>
            <Field
              label="New password"
              htmlFor="next"
              required
              hint="At least 8 characters, different from the current one"
            >
              <Input
                id="next"
                type="password"
                value={form.next}
                onChange={update('next')}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm" required>
              <Input
                id="confirm"
                type="password"
                value={form.confirm}
                onChange={update('confirm')}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3.5">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Back
            </Button>
            <Button type="submit" loading={state.submitting}>
              Update password
            </Button>
          </div>
        </Card>
      </form>
    </>
  );
}
