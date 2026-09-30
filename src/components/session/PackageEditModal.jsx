/**
 * Correct a data-entry mistake on a treatment package.
 * Editable: package_name, sessions_registered, price_per_session, end_date, notes.
 *
 * sessions_registered cannot be reduced below sessions_taken (backend enforces this
 * with a clear error; the input min attribute surfaces it early in the UI).
 */

import { useEffect, useState } from 'react';

import { Alert, Button, Field, Input, Modal } from '../ui';
import { sessionService } from '../../services';

export function PackageEditModal({ open, pkg, onClose, onSaved }) {
  const [form, setForm] = useState({
    package_name: '',
    sessions_registered: '',
    price_per_session: '',
    end_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !pkg) return;
    setError(null);
    setForm({
      package_name: pkg.package_name ?? '',
      sessions_registered: pkg.sessions_registered != null ? String(pkg.sessions_registered) : '',
      price_per_session: pkg.price_per_session != null ? String(pkg.price_per_session) : '',
      end_date: pkg.end_date ?? '',
      notes: pkg.notes ?? '',
    });
  }, [open, pkg]);

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function save() {
    const sessions = parseInt(form.sessions_registered, 10);
    const price = parseFloat(form.price_per_session);

    if (!sessions || sessions < 1) {
      setError('Sessions registered must be at least 1.');
      return;
    }
    if (isNaN(price) || price < 0) {
      setError('Price per session must be 0 or more.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await sessionService.updatePackage(pkg.id, {
        package_name: form.package_name.trim() || null,
        sessions_registered: sessions,
        price_per_session: price,
        end_date: form.end_date || null,
        notes: form.notes.trim() || null,
      });
      onSaved?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!pkg) return null;

  const sessionsTaken = pkg.sessions_taken ?? 0;
  const newTotal = parseInt(form.sessions_registered, 10) || 0;
  const newPrice = parseFloat(form.price_per_session) || 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissOnBackdrop={false}
      title="Edit package"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        {/* Read-only progress context */}
        <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-700">
          <span className="font-medium">{sessionsTaken} session{sessionsTaken !== 1 ? 's' : ''} already taken</span>
          {' — '}sessions registered cannot be set below this.
        </div>

        <Field label="Package name" htmlFor="pke_name" hint="Optional">
          <Input
            id="pke_name"
            value={form.package_name}
            onChange={update('package_name')}
            placeholder="e.g. 10-session physio package"
            maxLength={120}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sessions registered" htmlFor="pke_sessions" required>
            <Input
              id="pke_sessions"
              type="number"
              min={sessionsTaken || 1}
              max={500}
              step={1}
              value={form.sessions_registered}
              onChange={update('sessions_registered')}
              className="numeric"
            />
          </Field>

          <Field label="Price per session (₹)" htmlFor="pke_price" required>
            <Input
              id="pke_price"
              type="number"
              min={0}
              step={0.01}
              value={form.price_per_session}
              onChange={update('price_per_session')}
              className="numeric"
            />
          </Field>
        </div>

        {/* Live total preview */}
        {newTotal > 0 && (
          <p className="text-sm text-ink-500">
            New package total:{' '}
            <span className="numeric font-semibold text-ink-900">
              ₹{(newTotal * newPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            {' '}({newTotal} × ₹{newPrice.toLocaleString('en-IN')})
          </p>
        )}

        <Field label="End date" htmlFor="pke_end" hint="Optional">
          <Input id="pke_end" type="date" value={form.end_date} onChange={update('end_date')} />
        </Field>

        <Field label="Notes" htmlFor="pke_notes" hint="Optional">
          <Input id="pke_notes" value={form.notes} onChange={update('notes')} />
        </Field>
      </div>
    </Modal>
  );
}
