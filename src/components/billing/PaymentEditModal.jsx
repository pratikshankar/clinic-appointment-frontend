/**
 * Correct a data-entry mistake on an already-recorded payment.
 * Editable: amount, payment_date, payment_method, reference_number, notes.
 * Amount changes recalculate the bill's payment status on the backend.
 */

import { useEffect, useState } from 'react';

import { Alert, Button, Field, Input, Modal, Select } from '../ui';
import { PAYMENT_METHODS } from './BillingSection';
import { billingService } from '../../services';
import { formatDate } from '../../utils/format';

export function PaymentEditModal({ open, payment, onClose, onSaved }) {
  const [form, setForm] = useState({
    amount: '',
    payment_date: '',
    payment_method: '',
    reference_number: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !payment) return;
    setError(null);
    setForm({
      amount: payment.amount != null ? String(payment.amount) : '',
      payment_date: payment.payment_date ?? '',
      payment_method: payment.payment_method ?? 'CASH',
      reference_number: payment.reference_number ?? '',
      notes: payment.notes ?? '',
    });
  }, [open, payment]);

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function save() {
    const amountNum = parseFloat(form.amount);
    if (!form.amount || isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        payment_date: form.payment_date || null,
        payment_method: form.payment_method || null,
        reference_number: form.reference_number.trim() || null,
        notes: form.notes.trim() || null,
      };
      // Only include amount if it actually changed to avoid unnecessary recalculation.
      if (String(amountNum) !== String(parseFloat(payment.amount))) {
        payload.amount = amountNum;
      }
      const updated = await billingService.updatePayment(payment.id, payload);
      onSaved?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!payment) return null;

  const amountChanged =
    form.amount !== '' && parseFloat(form.amount) !== parseFloat(payment.amount);

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissOnBackdrop={false}
      title="Edit payment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        {amountChanged && (
          <Alert tone="warning">
            Changing the amount updates the bill's outstanding balance and payment status.
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₹)" htmlFor="pe_amount" required>
            <Input
              id="pe_amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={update('amount')}
              className="numeric"
            />
          </Field>

          <Field label="Payment date" htmlFor="pe_date">
            <Input id="pe_date" type="date" value={form.payment_date} onChange={update('payment_date')} />
          </Field>

          <Field label="Method" htmlFor="pe_method" required>
            <Select id="pe_method" value={form.payment_method} onChange={update('payment_method')}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </Field>

          <Field label="Reference / Txn ID" htmlFor="pe_ref" hint="Optional">
            <Input
              id="pe_ref"
              value={form.reference_number}
              onChange={update('reference_number')}
              placeholder="UPI ref, card approval code…"
            />
          </Field>

          <Field label="Notes" htmlFor="pe_notes" hint="Optional" className="sm:col-span-2">
            <Input id="pe_notes" value={form.notes} onChange={update('notes')} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
