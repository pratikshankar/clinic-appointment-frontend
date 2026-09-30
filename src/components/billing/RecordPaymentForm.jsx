/**
 * Record money received against an existing bill (Section 18).
 *
 * Supports split payments: e.g. ₹3000 Card + ₹1500 Cash for a ₹4500 bill.
 * Each split row becomes its own Payment row in the database.
 */

import { useEffect, useState } from 'react';

import { Alert, Button, Field, Input, Modal, Select } from '../ui';
import { PAYMENT_METHODS } from './BillingSection';
import { billingService } from '../../services';
import { formatMoney } from '../../utils/format';

const todayISO = () => new Date().toISOString().slice(0, 10);
// POINTS is handled separately — exclude from the regular split method dropdown
const CASH_METHODS = PAYMENT_METHODS.filter((m) => m.value !== 'POINTS');
const emptySplit = () => ({ method: 'CASH', amount: '', reference: '' });

export function RecordPaymentForm({ open, bill, patientPoints = 0, pointsRedeemValue = 1, onClose, onSaved }) {
  const [splits, setSplits] = useState([emptySplit()]);
  const [pointsToUse, setPointsToUse] = useState('');
  const [sharedDate, setSharedDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const outstanding = Number(bill?.balance_amount ?? 0);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNotes('');
    setPointsToUse('');
    setSharedDate(todayISO());
    setSplits([{ method: 'CASH', amount: outstanding > 0 ? outstanding.toFixed(2) : '', reference: '' }]);
  }, [open, outstanding]);

  function updateSplit(index, field, value) {
    setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function addSplit() {
    setSplits((prev) => [...prev, emptySplit()]);
  }

  function removeSplit(index) {
    setSplits((prev) => prev.filter((_, i) => i !== index));
  }

  // rupeeValue: how much ₹ one point is worth when redeeming
  const rupeesPerPt = Number(pointsRedeemValue) || 1;
  const ptsNum = Math.min(
    Math.floor(Number.parseFloat(pointsToUse) || 0),
    patientPoints,
    Math.floor(outstanding / rupeesPerPt),
  );
  const ptsValid = ptsNum > 0;

  const splitAmounts = splits.map((s) => {
    const v = Number.parseFloat(s.amount);
    return Number.isFinite(v) && v > 0 ? v : 0;
  });
  const cashTotal = Math.round(splitAmounts.reduce((a, b) => a + b, 0) * 100) / 100;
  const grandTotal = Math.round((cashTotal + (ptsValid ? ptsNum : 0)) * 100) / 100;
  const hasEmptyRow = splits.some((s) => Number.parseFloat(s.amount) <= 0 || s.amount === '');
  const overOutstanding = grandTotal > outstanding + 0.001;
  const invalid = hasEmptyRow || overOutstanding || grandTotal <= 0;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const allSplits = splits.map((s) => ({
        payment_method: s.method,
        amount: String(Math.round(Number.parseFloat(s.amount) * 100) / 100),
        reference_number: s.reference.trim() || null,
      }));
      if (ptsValid) {
        allSplits.push({ payment_method: 'POINTS', amount: String(ptsNum), reference_number: null });
      }
      const updated = await billingService.addPayment(bill.id, {
        splits: allSplits,
        payment_date: sharedDate || null,
        notes: notes.trim() || null,
      });
      onSaved?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!bill) return null;

  const canAddMore = splits.length < CASH_METHODS.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissOnBackdrop={false}
      title={`Record payment — ${bill.bill_number}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={invalid} onClick={save}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        {/* Bill summary */}
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

        {/* ── Payment splits ────────────────────────────────────────────────── */}
        <div className="rounded-lg border border-ink-200">
          {/* Section header with "Add split" button */}
          <div className="flex items-center justify-between border-b border-ink-200 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-600">
              Payment method{splits.length > 1 ? 's' : ''}
            </span>
            {canAddMore && (
              <button
                type="button"
                onClick={addSplit}
                className="inline-flex items-center gap-1 rounded-md border border-brand-300 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
              >
                + Split payment
              </button>
            )}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-3 gap-x-2 px-3 pb-0 pt-2 text-xs font-medium text-ink-500">
            <span>Method</span>
            <span>Amount (₹)</span>
            <span>Reference / Txn ID</span>
          </div>

          {/* Split rows */}
          <div className="divide-y divide-ink-100">
            {splits.map((split, index) => (
              <div key={index} className="flex items-center gap-2 px-3 py-2">
                <div className="flex-1">
                  <Select
                    aria-label="Payment method"
                    value={split.method}
                    onChange={(e) => updateSplit(index, 'method', e.target.value)}
                  >
                    {CASH_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </Select>
                </div>

                <div className="flex-1">
                  <Input
                    aria-label="Amount"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={split.amount}
                    onChange={(e) => updateSplit(index, 'amount', e.target.value)}
                  />
                </div>

                <div className="flex-1">
                  <Input
                    aria-label="Reference"
                    placeholder="Optional"
                    value={split.reference}
                    onChange={(e) => updateSplit(index, 'reference', e.target.value)}
                  />
                </div>

                {splits.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => removeSplit(index)}
                    className="shrink-0 rounded px-1 py-1 text-lg text-ink-400 hover:bg-red-50 hover:text-red-600"
                  >
                    ×
                  </button>
                ) : (
                  <span className="w-6 shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Running total — shown when more than one split */}
          {splits.length > 1 && (
            <div className={`flex justify-end border-t border-ink-200 px-3 py-2 text-sm font-semibold ${overOutstanding ? 'text-red-600' : 'text-ink-900'}`}>
              <span>Total:&nbsp;</span>
              <span className="numeric">{formatMoney(grandTotal)}</span>
              {overOutstanding && (
                <span className="ml-2 font-normal text-red-500">
                  (exceeds {formatMoney(outstanding)} outstanding)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Physio Points redemption */}
        {patientPoints > 0 && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-brand-800">
                  Physio Points
                </p>
                <p className="text-xs text-brand-600">
                  Balance: <span className="font-mono font-bold">{patientPoints} pts</span>
                  {' '}= ₹{(patientPoints * rupeesPerPt).toFixed(rupeesPerPt % 1 === 0 ? 0 : 2)} discount
                </p>
              </div>
              {ptsValid && (
                <span className="text-xs font-semibold text-brand-700 bg-brand-100 rounded px-2 py-0.5">
                  −₹{(ptsNum * rupeesPerPt).toFixed(rupeesPerPt % 1 === 0 ? 0 : 2)} applied
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={Math.min(patientPoints, outstanding)}
                step={1}
                placeholder="0"
                value={pointsToUse}
                onChange={(e) => setPointsToUse(e.target.value)}
                className="w-28"
              />
              <span className="text-sm text-brand-700">pts to redeem</span>
              {outstanding > 0 && (
                <button
                  type="button"
                  className="text-xs text-brand-600 underline ml-2"
                  onClick={() => setPointsToUse(String(Math.min(patientPoints, Math.floor(outstanding / rupeesPerPt))))}
                >
                  Use max ({Math.min(patientPoints, Math.floor(outstanding / rupeesPerPt))} pts)
                </button>
              )}
              {ptsValid && (
                <button
                  type="button"
                  className="text-xs text-ink-500 underline ml-1"
                  onClick={() => setPointsToUse('')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Shared date + notes */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment date" htmlFor="payment_shared_date">
            <Input
              id="payment_shared_date"
              type="date"
              value={sharedDate}
              onChange={(e) => setSharedDate(e.target.value)}
            />
          </Field>
          <Field label="Notes" htmlFor="payment_notes" hint="Optional">
            <Input
              id="payment_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
