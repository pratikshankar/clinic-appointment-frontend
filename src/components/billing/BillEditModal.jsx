import { useEffect, useMemo, useState } from 'react';

import { Alert, Button, Field, Input, Modal, Select } from '../ui';
import { PAYMENT_METHODS } from './BillingSection';
import { billingService } from '../../services';
import { formatMoney } from '../../utils/format';

// Payment methods excluding POINTS (points can't be corrected after the fact)
const CASH_METHODS = PAYMENT_METHODS.filter((m) => m.value !== 'POINTS');

function emptyItem(src) {
  return {
    id: src.id,
    description: src.description ?? '',
    quantity: String(src.quantity ?? 1),
    unit_price: String(src.unit_price ?? '0'),
  };
}

function PaymentRow({ payment, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  function startEdit() {
    setForm({
      amount: String(payment.amount ?? ''),
      payment_date: payment.payment_date ?? '',
      payment_method: payment.payment_method ?? 'CASH',
      reference_number: payment.reference_number ?? '',
    });
    setErr(null);
    setEditing(true);
  }

  async function save() {
    const amountNum = parseFloat(form.amount);
    if (!form.amount || isNaN(amountNum) || amountNum <= 0) {
      setErr('Amount must be a positive number.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        payment_date: form.payment_date || null,
        payment_method: form.payment_method || null,
        reference_number: form.reference_number.trim() || null,
      };
      if (String(amountNum) !== String(parseFloat(payment.amount))) {
        payload.amount = amountNum;
      }
      const updated = await billingService.updatePayment(payment.id, payload);
      setEditing(false);
      onSaved?.(updated);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const up = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
        <span className="text-ink-700">
          {payment.payment_date ?? '—'} · {(payment.payment_method ?? '').replace('_', ' ')}
          {payment.reference_number && (
            <span className="text-ink-400"> · {payment.reference_number}</span>
          )}
        </span>
        <span className="flex items-center gap-3">
          <span className="numeric font-medium">{formatMoney(payment.amount)}</span>
          {payment.payment_method !== 'POINTS' && (
            <button
              type="button"
              className="text-xs text-brand-600 underline hover:text-brand-800"
              onClick={startEdit}
            >
              Edit
            </button>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 space-y-2">
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Amount (₹)" htmlFor={`pay-amt-${payment.id}`} required>
          <Input
            id={`pay-amt-${payment.id}`}
            type="number" min="0.01" step="0.01"
            value={form.amount}
            onChange={up('amount')}
          />
        </Field>
        <Field label="Payment date" htmlFor={`pay-dt-${payment.id}`}>
          <Input
            id={`pay-dt-${payment.id}`}
            type="date"
            value={form.payment_date}
            onChange={up('payment_date')}
          />
        </Field>
        <Field label="Method" htmlFor={`pay-mth-${payment.id}`}>
          <Select id={`pay-mth-${payment.id}`} value={form.payment_method} onChange={up('payment_method')}>
            {CASH_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Reference / Txn ID" htmlFor={`pay-ref-${payment.id}`} hint="Optional">
          <Input
            id={`pay-ref-${payment.id}`}
            value={form.reference_number}
            onChange={up('reference_number')}
            placeholder="UPI ref, card approval code…"
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
        <Button size="sm" loading={saving} onClick={save}>Save payment</Button>
      </div>
    </div>
  );
}

export function BillEditModal({ open, bill, onClose, onSaved }) {
  const [billDate, setBillDate] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('');
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Track updated bill from payment saves so payments section stays fresh
  const [liveBill, setLiveBill] = useState(null);

  useEffect(() => {
    if (!open || !bill) return;
    setError(null);
    setLiveBill(bill);
    setBillDate(bill.bill_date ?? '');
    setNotes(bill.notes ?? '');
    setDiscount(String(bill.discount_amount ?? '0'));
    setItems((bill.items ?? []).map(emptyItem));
  }, [open, bill]);

  const displayBill = liveBill ?? bill;

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  const lineTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  }, [items]);

  const discountNum = Number(discount) || 0;
  const grandTotal = Math.max(0, lineTotal - discountNum);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        bill_date: billDate || null,
        notes: notes.trim() || null,
        discount_amount: discountNum,
        items: items.map((item) => ({
          id: item.id,
          description: item.description.trim(),
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
        })),
      };
      const updated = await billingService.updateBill(bill.id, payload);
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
      title={`Edit bill ${bill.bill_number}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        {/* Date + Notes */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bill date" htmlFor="be_date" required>
            <Input id="be_date" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="be_notes" hint="Optional">
            <Input id="be_notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes…" />
          </Field>
        </div>

        {/* Line items */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-600">Charges</p>
          <div className="overflow-x-auto rounded-lg ring-1 ring-ink-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="px-3 py-2">Description</th>
                  <th className="w-16 px-3 py-2 text-right">Qty</th>
                  <th className="w-28 px-3 py-2 text-right">Unit price (₹)</th>
                  <th className="w-24 px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {items.map((item, idx) => {
                  const rowAmt = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                  return (
                    <tr key={item.id}>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          className="w-full rounded border border-ink-200 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={item.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="1"
                          className="w-full rounded border border-ink-200 px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full rounded border border-ink-200 px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={item.unit_price}
                          onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right numeric text-ink-700">
                        {formatMoney(rowAmt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Discount + totals */}
        <div className="flex flex-col items-end gap-1.5 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-ink-600">Subtotal</span>
            <span className="numeric w-24 text-right text-ink-900">{formatMoney(lineTotal)}</span>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="be_discount" className="text-ink-600">Discount (₹)</label>
            <input
              id="be_discount"
              type="number"
              min="0"
              step="0.01"
              className="w-24 rounded border border-ink-200 px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 border-t border-ink-200 pt-1.5">
            <span className="font-semibold text-ink-900">Total</span>
            <span className="numeric w-24 text-right font-semibold text-ink-900">{formatMoney(grandTotal)}</span>
          </div>
          {bill.amount_paid > 0 && (
            <p className="text-xs text-ink-500">
              Already paid: {formatMoney(bill.amount_paid)} — total cannot go below this.
            </p>
          )}
        </div>

        {/* Payments — inline editing for date/amount corrections */}
        {(displayBill?.payments ?? []).length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-600">
              Payments recorded
            </p>
            <div className="divide-y divide-ink-100 rounded-lg ring-1 ring-ink-200 px-3">
              {(displayBill.payments ?? []).map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  onSaved={(updated) => {
                    setLiveBill(updated);
                    onSaved?.(updated);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
