/**
 * Charge a patient for something outside their package (Sections 17-19).
 *
 * This is the answer to the mid-course add-on: a patient part-way through a
 * 10-session course takes one laser therapy session that costs extra. It is
 * billed here as its own line on its own bill, and it deliberately **does not
 * consume a session** from the package — the patient still has the sessions
 * they paid for. Same dialog handles a walk-in consultation fee.
 */

import { useState } from 'react';

import { Alert, Button, Field, Input, Modal, Select } from '../ui';
import {
  BillingSection,
  billingPayload,
  billingTotals,
  blankBilling,
} from './BillingSection';
import { billingService } from '../../services';
import { formatMoney } from '../../utils/format';

export function ChargeForm({
  open,
  patientId,
  patientName,
  clinics,
  defaultClinicId,
  packageId = null,
  onClose,
  onSaved,
}) {
  const [billing, setBilling] = useState(blankBilling);
  const [clinicId, setClinicId] = useState(defaultClinicId ?? '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const totals = billingTotals(billing, 0);
  const lines = billing.charges ?? [];
  const incomplete = lines.some((line) => !line.description.trim());

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { additional_charges, discount_amount, payment } = billingPayload(billing, 0);
      const bill = await billingService.charge(patientId, {
        items: additional_charges,
        discount_amount,
        payment,
        clinic_id: clinicId ? Number(clinicId) : null,
        package_id: packageId,
        notes: notes.trim() || null,
      });
      setBilling(blankBilling());
      setNotes('');
      onSaved?.(bill);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      dismissOnBackdrop={false}
      title={patientName ? `Add a charge — ${patientName}` : 'Add a charge'}
      footer={
        <>
          <span className="mr-auto self-center text-sm text-ink-600">
            Total <strong className="numeric text-ink-900">{formatMoney(totals.total)}</strong>
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={lines.length === 0 || incomplete}
            onClick={save}
          >
            Save charge
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        <Alert tone="info">
          Anything charged here is billed separately and does <strong>not</strong> use up a
          session from the patient&apos;s package.
        </Alert>

        {clinics?.length > 1 && (
          <Field label="Clinic" htmlFor="charge_clinic">
            <Select
              id="charge_clinic"
              value={clinicId}
              onChange={(event) => setClinicId(event.target.value)}
            >
              <option value="">Select…</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <BillingSection
          value={billing}
          onChange={setBilling}
          clinicId={clinicId ? Number(clinicId) : defaultClinicId}
          baseAmount={0}
          requireCharge
        />

        <Field label="Notes" htmlFor="charge_notes" hint="Shown on the bill. Optional">
          <Input
            id="charge_notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="e.g. Laser therapy taken during ongoing course"
          />
        </Field>
      </div>
    </Modal>
  );
}
