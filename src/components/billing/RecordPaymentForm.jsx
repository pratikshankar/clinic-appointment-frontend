/**
 * Record money received against an existing bill (Section 18).
 *
 * Payments accumulate rather than overwrite: a patient paying half now and half
 * next week produces two rows, and the bill's status moves UNPAID → PARTIAL →
 * PAID on its own. Nothing here sets that status directly.
 */

import { useEffect, useState } from 'react';

import { Alert, Button, Field, Input, Modal, Select } from '../ui';
import { PAYMENT_METHODS } from './BillingSection';
import { billingService } from '../../services';
import { formatMoney } from '../../utils/format';

const todayISO = () => new Date().toISOString().slice(0, 10);

export function RecordPaymentForm({ open, bill, onClose, onSaved }) {
  const [form, setForm] = useState({
    amount: '',
    method: 'CASH',
    reference: '',
    date: todayISO(),
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const outstanding = Number(bill?.balance_amount ?? 0);

  useEffect(() => {
    if (!open) return;
    setError(null);
    // Pre-filling the outstanding amount is right far more often than not, and
    // it is still editable for a part payment.
    setForm({
      amount: outstanding > 0 ? outstanding.toFixed(2) : '',
      method: 'CASH',
      reference: '',
      date: todayISO(),
      notes: '',
    });
  }, [open, outstanding]);

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const amount = Number.parseFloat(form.amount);
  const invalid = !Number.isFinite(amount) || amount <= 0 || amount > outstanding + 0.001;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await billingService.addPayment(bill.id, {
        amount: String(amount),
        payment_method: form.method,
        reference_number: form.reference.trim() || null,
        payment_date: form.date || null,
        notes: form.notes.trim() || null,
      });
      onSaved?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!bill) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissOnBackdrop={false}
      title={`Record payment — ${bill.bill_number}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={invalid} onClick={save}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm">
          <div className="flex justify-between text-ink-700">
            <span>Bill total</span>
            <span className="numeric">{formatMoney(bill.total_amount)}</span>
          </div>
          <div className="flex justify-between text-ink-700">
            <span>Already paid</span>
            <span className="numeric">{formatMoney(bill.amount_paid)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-ink-200 pt-1 font-semibold text-ink-900">
            <span>Outstanding</span>
            <span className="numeric">{formatMoney(outstanding)}</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Amount"
            htmlFor="payment_amount_field"
            required
            error={
              Number.isFinite(amount) && amount > outstanding
                ? `That is more than the ${formatMoney(outstanding)} outstanding`
                : undefined
            }
          >
            <Input
              id="payment_amount_field"
              type="number"
              min={0}
              step="0.01"
              value={form.amount}
              onChange={update('amount')}
            />
          </Field>

          <Field label="Method" htmlFor="payment_method_field" required>
            <Select id="payment_method_field" value={form.method} onChange={update('method')}>
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Transaction / reference no."
            htmlFor="payment_reference_field"
            hint="Optional"
          >
            <Input
              id="payment_reference_field"
              value={form.reference}
              onChange={update('reference')}
            />
          </Field>

          <Field label="Date" htmlFor="payment_date_field">
            <Input
              id="payment_date_field"
              type="date"
              value={form.date}
              onChange={update('date')}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Notes" htmlFor="payment_notes_field" hint="Optional">
              <Input id="payment_notes_field" value={form.notes} onChange={update('notes')} />
            </Field>
          </div>
        </div>
      </div>
    </Modal>
  );
}
