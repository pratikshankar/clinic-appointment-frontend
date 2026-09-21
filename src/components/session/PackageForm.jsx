/**
 * Register a block of purchased sessions, and bill for it (Sections 12, 17-19).
 *
 * Registration is the moment the patient pays, so the charges and the payment
 * are captured here rather than on a second screen. The package and its bill
 * are written by one API call in one transaction, which is what stops a
 * registered course from existing with no record of what was collected for it.
 *
 * `sessions_taken` is offered only as "already delivered before this was entered
 * into the system" — it exists so a clinic migrating mid-course does not need
 * database access. After creation the counter moves only by logging or voiding
 * sessions, which is why there is no field for it on the edit path.
 */

import { useState } from 'react';

import { Alert, Button, Field, Input, Modal, Select } from '../ui';
import {
  BillingSection,
  billingPayload,
  billingTotals,
  blankBilling,
} from '../billing/BillingSection';
import { sessionService } from '../../services';
import { formatMoney } from '../../utils/format';

const BLANK = {
  sessions_registered: '',
  price_per_session: '',
  package_name: '',
  clinic_id: '',
  start_date: new Date().toISOString().slice(0, 10),
  sessions_taken: '0',
  notes: '',
};

export function PackageForm({ open, patientId, clinics, defaultClinicId, onClose, onSaved }) {
  const [form, setForm] = useState(BLANK);
  const [billing, setBilling] = useState(blankBilling);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const registered = Number(form.sessions_registered) || 0;
  const price = Number(form.price_per_session) || 0;
  const packageAmount = Math.round(registered * price * 100) / 100;
  const totals = billingTotals(billing, packageAmount);
  const clinicId = form.clinic_id ? Number(form.clinic_id) : defaultClinicId ?? null;

  async function save() {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const created = await sessionService.createPackage(patientId, {
        sessions_registered: registered,
        price_per_session: form.price_per_session || '0',
        package_name: form.package_name.trim() || null,
        clinic_id: clinicId,
        start_date: form.start_date || null,
        sessions_taken: Number(form.sessions_taken) || 0,
        notes: form.notes.trim() || null,
        ...billingPayload(billing, packageAmount),
      });
      setForm(BLANK);
      setBilling(blankBilling());
      onSaved?.(created);
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors ?? {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      // Prices and a transaction reference are tedious to retype, so a stray
      // click on the backdrop must not discard them.
      dismissOnBackdrop={false}
      title="Register treatment package"
      footer={
        <>
          <span className="mr-auto self-center text-sm text-ink-600">
            Total <strong className="numeric text-ink-900">{formatMoney(totals.total)}</strong>
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={registered < 1} onClick={save}>
            Register package
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        {/*
          This dialog always creates a package, so it needs a session count.
          A patient buying only a consultation or a single treatment has bought
          no course -- point them at the path that does not invent one, rather
          than letting them hit the sessions field and get stuck.
        */}
        <Alert tone="info">
          Buying a course of sessions. For a consultation or a single treatment with{' '}
          <strong>no package</strong>, close this and use <strong>Add a charge</strong> on
          the Billing card instead.
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Sessions"
            htmlFor="sessions_registered"
            required
            error={fieldErrors.sessions_registered}
          >
            <Input
              id="sessions_registered"
              type="number"
              min={1}
              max={500}
              value={form.sessions_registered}
              onChange={update('sessions_registered')}
              onWheel={(e) => e.target.blur()}
              required
            />
          </Field>

          <Field
            label="Price per session"
            htmlFor="price_per_session"
            hint={
              registered > 0 && price > 0
                ? `${registered} × ${formatMoney(price)} = ${formatMoney(packageAmount)}`
                : '₹, excluding tax'
            }
            error={fieldErrors.price_per_session}
          >
            <Input
              id="price_per_session"
              type="number"
              min={0}
              step="0.01"
              value={form.price_per_session}
              onChange={update('price_per_session')}
              onWheel={(e) => e.target.blur()}
              placeholder="500.00"
            />
          </Field>

          <Field label="Package name" htmlFor="package_name" hint="Optional">
            <Input
              id="package_name"
              value={form.package_name}
              onChange={update('package_name')}
              placeholder="e.g. 10-session physiotherapy package"
            />
          </Field>

          <Field label="Start date" htmlFor="start_date">
            <Input
              id="start_date"
              type="date"
              value={form.start_date}
              onChange={update('start_date')}
            />
          </Field>

          {clinics?.length > 1 && (
            <Field label="Clinic" htmlFor="package_clinic">
              <Select id="package_clinic" value={form.clinic_id} onChange={update('clinic_id')}>
                <option value="">
                  {clinics.find((c) => c.id === defaultClinicId)?.name ?? 'Select…'}
                </option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field
            label="Already delivered"
            htmlFor="sessions_taken"
            hint="Only for a course started before using this system"
            error={fieldErrors.sessions_taken}
          >
            <Input
              id="sessions_taken"
              type="number"
              min={0}
              max={registered || undefined}
              value={form.sessions_taken}
              onChange={update('sessions_taken')}
              onWheel={(e) => e.target.blur()}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Notes" htmlFor="package_notes">
              <Input id="package_notes" value={form.notes} onChange={update('notes')} />
            </Field>
          </div>
        </div>

        <BillingSection
          value={billing}
          onChange={setBilling}
          clinicId={clinicId}
          baseAmount={packageAmount}
          baseLabel={
            registered > 0
              ? `${form.package_name.trim() || `${registered}-session physiotherapy package`} (${registered} × ${formatMoney(price)})`
              : null
          }
        />
      </div>
    </Modal>
  );
}
