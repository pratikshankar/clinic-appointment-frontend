/**
 * The money half of any form that charges a patient (Sections 17-19).
 *
 * Shared by package registration and the standalone "Add a charge" dialog so
 * both produce the same bill shape. The rule it encodes is that **every rupee
 * is a line**: a consultation fee is not folded into the session price, and an
 * add-on therapy is its own line rather than a silent adjustment.
 *
 * Split payments are supported: e.g. ₹3000 Card + ₹1500 Cash for a ₹4500 bill.
 * payment.splits is a list; each split becomes its own Payment row on the server.
 */

import { useEffect, useMemo, useState } from 'react';

import { Alert, Badge, Button, Field, Input, Select } from '../ui';
import { billingService } from '../../services';
import { formatMoney } from '../../utils/format';

export const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'OTHER', label: 'Other' },
  { value: 'POINTS', label: 'Physio Points' },
];

/** Methods where a transaction reference is worth capturing. */
const REFERENCED_METHODS = new Set(['UPI', 'CARD', 'BANK_TRANSFER']);

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptySplit = () => ({ method: 'CASH', amount: '', reference: '' });

export function blankBilling() {
  return {
    charges: [],
    discount: '',
    collectNow: true,
    payment: {
      splits: [emptySplit()],
      date: todayISO(),
    },
  };
}

const toAmount = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/** Round to paise so a preview never shows 1249.9999999. */
const round2 = (value) => Math.round(value * 100) / 100;

export function chargeLineTotal(line) {
  return round2(toAmount(line.unit_price) * (Number(line.quantity) || 1));
}

export function billingTotals(billing, baseAmount = 0) {
  const charges = (billing.charges ?? []).reduce(
    (sum, line) => sum + chargeLineTotal(line),
    0,
  );
  const gross = round2(baseAmount + charges);
  const discount = Math.min(toAmount(billing.discount), gross);
  return { charges: round2(charges), gross, discount, total: round2(gross - discount) };
}

/**
 * Translate the form state into the request body fields the API expects.
 * Returns `{ additional_charges, discount_amount, payment }`.
 */
export function billingPayload(billing, baseAmount = 0) {
  const { total } = billingTotals(billing, baseAmount);

  if (!billing.collectNow) {
    return {
      additional_charges: _chargeLines(billing),
      discount_amount: String(toAmount(billing.discount)),
      payment: null,
    };
  }

  const splits = billing.payment.splits;
  // Single split with blank amount → shorthand for "full total, one method"
  const isSingleBlank = splits.length === 1 && splits[0].amount === '';
  const apiSplits = isSingleBlank
    ? [{ payment_method: splits[0].method, amount: String(total), reference_number: splits[0].reference.trim() || null }]
    : splits
        .filter((s) => toAmount(s.amount) > 0)
        .map((s) => ({
          payment_method: s.method,
          amount: String(round2(toAmount(s.amount))),
          reference_number: s.reference.trim() || null,
        }));

  const paid = isSingleBlank ? total : round2(splits.reduce((sum, s) => sum + toAmount(s.amount), 0));

  return {
    additional_charges: _chargeLines(billing),
    discount_amount: String(toAmount(billing.discount)),
    payment:
      paid > 0 && apiSplits.length > 0
        ? {
            splits: apiSplits,
            payment_date: billing.payment.date || null,
            notes: null,
          }
        : null,
  };
}

function _chargeLines(billing) {
  return (billing.charges ?? []).map((line) => ({
    description: line.description.trim(),
    unit_price: String(toAmount(line.unit_price)),
    quantity: Number(line.quantity) || 1,
    item_type: line.item_type || 'OTHER',
    service_item_id: line.service_item_id ?? null,
  }));
}

export function BillingSection({
  value,
  onChange,
  clinicId,
  baseAmount = 0,
  baseLabel = null,
  requireCharge = false,
}) {
  const [catalogue, setCatalogue] = useState([]);
  const [catalogueError, setCatalogueError] = useState(null);
  const [picker, setPicker] = useState('');

  useEffect(() => {
    let cancelled = false;
    billingService
      .serviceItems({ ...(clinicId ? { clinic_id: clinicId } : {}), include_inactive: false })
      .then((items) => !cancelled && setCatalogue(items))
      .catch((err) => !cancelled && setCatalogueError(err.message));
    return () => { cancelled = true; };
  }, [clinicId]);

  const totals = useMemo(() => billingTotals(value, baseAmount), [value, baseAmount]);

  const set = (patch) => onChange({ ...value, ...patch });
  const setPayment = (patch) => set({ payment: { ...value.payment, ...patch } });

  // Split helpers
  const splits = value.payment?.splits ?? [emptySplit()];

  function updateSplit(index, field, val) {
    const next = splits.map((s, i) => (i === index ? { ...s, [field]: val } : s));
    setPayment({ splits: next });
  }

  function addSplit() {
    setPayment({ splits: [...splits, emptySplit()] });
  }

  function removeSplit(index) {
    setPayment({ splits: splits.filter((_, i) => i !== index) });
  }

  function addCharge(line) {
    set({ charges: [...(value.charges ?? []), line] });
  }

  function addFromCatalogue(serviceItemId) {
    const item = catalogue.find((entry) => String(entry.id) === String(serviceItemId));
    if (!item) return;
    addCharge({
      key: `${item.id}-${Date.now()}`,
      description: item.name,
      unit_price: String(item.default_price ?? '0'),
      quantity: 1,
      item_type: item.item_type,
      service_item_id: item.id,
    });
    setPicker('');
  }

  function addCustom() {
    addCharge({
      key: `custom-${Date.now()}`,
      description: '',
      unit_price: '',
      quantity: 1,
      item_type: 'OTHER',
      service_item_id: null,
    });
  }

  function updateCharge(index, patch) {
    set({
      charges: value.charges.map((line, i) =>
        i === index
          ? {
              ...line,
              ...patch,
              service_item_id:
                patch.description !== undefined || patch.unit_price !== undefined
                  ? null
                  : line.service_item_id,
            }
          : line,
      ),
    });
  }

  function removeCharge(index) {
    set({ charges: value.charges.filter((_, i) => i !== index) });
  }

  // dueNow: sum of splits (or total if single split with blank amount)
  const isSingleBlank = splits.length === 1 && splits[0].amount === '';
  const dueNow = value.collectNow
    ? isSingleBlank
      ? totals.total
      : round2(splits.reduce((sum, s) => sum + toAmount(s.amount), 0))
    : 0;
  const outstanding = round2(totals.total - dueNow);
  const splitTotal = round2(splits.reduce((sum, s) => sum + toAmount(s.amount), 0));
  const overTotal = value.collectNow && !isSingleBlank && splitTotal > totals.total + 0.001;
  const canAddMore = splits.length < PAYMENT_METHODS.length;

  return (
    <div className="space-y-4">
      {/* ---------------- Charges ---------------- */}
      <div className="rounded-lg ring-1 ring-inset ring-ink-200">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-4 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">
            {requireCharge ? 'Charges' : 'One-time charges'}
          </p>
          <div className="flex items-center gap-2">
            <Select
              aria-label="Add a service"
              value={picker}
              onChange={(event) => addFromCatalogue(event.target.value)}
              className="h-8 py-0 text-xs"
            >
              <option value="">Add a service…</option>
              {catalogue.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {formatMoney(item.default_price)}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="secondary" onClick={addCustom}>
              + Custom
            </Button>
          </div>
        </div>

        <div className="divide-y divide-ink-100">
          {baseLabel && (
            <div className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="text-ink-700">{baseLabel}</span>
              <span className="numeric font-medium text-ink-900">{formatMoney(baseAmount)}</span>
            </div>
          )}

          {(value.charges ?? []).length === 0 && !baseLabel && (
            <p className="px-4 py-3 text-sm text-ink-500">
              {requireCharge
                ? 'Add a service or a custom charge to continue.'
                : 'No extra charges. Add a consultation fee or a product if the patient paid for one.'}
            </p>
          )}

          {(value.charges ?? []).map((line, index) => (
            <div key={line.key} className="grid gap-2 px-4 py-3 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <Input
                  aria-label="Charge description"
                  placeholder="e.g. Consultation fee"
                  value={line.description}
                  onChange={(event) => updateCharge(index, { description: event.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  aria-label="Unit price"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={line.unit_price}
                  onChange={(event) => updateCharge(index, { unit_price: event.target.value })}
                />
              </div>
              <div className="sm:col-span-1">
                <Input
                  aria-label="Quantity"
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(event) => updateCharge(index, { quantity: event.target.value })}
                />
              </div>
              <div className="flex items-center justify-end gap-2 sm:col-span-3">
                <span className="numeric text-sm font-medium text-ink-900">
                  {formatMoney(chargeLineTotal(line))}
                </span>
                <Button size="sm" variant="ghost" aria-label="Remove charge" onClick={() => removeCharge(index)}>
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {catalogueError && (
        <Alert tone="warning">
          The service list could not be loaded ({catalogueError}). You can still add charges by hand.
        </Alert>
      )}

      {/* ---------------- Totals ---------------- */}
      <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm">
        <div className="flex items-center justify-between text-ink-700">
          <span>Subtotal</span>
          <span className="numeric">{formatMoney(totals.gross)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <label htmlFor="billing_discount" className="text-ink-700">Discount</label>
          <Input
            id="billing_discount"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            className="h-8 w-32 text-right"
            value={value.discount}
            onChange={(event) => set({ discount: event.target.value })}
          />
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-ink-200 pt-2 text-base font-semibold text-ink-900">
          <span>Total</span>
          <span className="numeric">{formatMoney(totals.total)}</span>
        </div>
      </div>

      {/* ---------------- Payment ---------------- */}
      <div className="rounded-lg ring-1 ring-inset ring-ink-200">
        {/* Collect-now toggle */}
        <div className="px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ink-300 text-brand-600"
              checked={value.collectNow}
              onChange={(event) => set({ collectNow: event.target.checked })}
            />
            Payment received now
          </label>

          {!value.collectNow && (
            <p className="mt-2 text-xs text-ink-500">
              The bill is still created and shows as unpaid, so the outstanding amount is
              visible on the patient&apos;s profile.{' '}
              <Badge tone="warning">Unpaid</Badge>
            </p>
          )}
        </div>

        {value.collectNow && (
          <>
            {/* Split rows header */}
            <div className="flex items-center justify-between border-t border-ink-200 px-4 py-2">
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

            {/* Column labels */}
            <div className="grid grid-cols-3 gap-x-2 px-4 pb-0 pt-1 text-xs font-medium text-ink-500">
              <span>Method</span>
              <span>Amount (₹)</span>
              <span>Reference / Txn ID</span>
            </div>

            {/* One row per split */}
            <div className="divide-y divide-ink-100">
              {splits.map((split, index) => (
                <div key={index} className="flex items-center gap-2 px-4 py-2">
                  <div className="flex-1">
                    <Select
                      aria-label="Payment method"
                      value={split.method}
                      onChange={(e) => updateSplit(index, 'method', e.target.value)}
                    >
                      {PAYMENT_METHODS.map((m) => (
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
                      placeholder={
                        index === 0 && splits.length === 1
                          ? String(totals.total.toFixed(2))
                          : '0.00'
                      }
                      value={split.amount}
                      onChange={(e) => updateSplit(index, 'amount', e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      aria-label="Reference"
                      placeholder={REFERENCED_METHODS.has(split.method) ? 'UPI ref / UTR / approval code' : 'Optional'}
                      value={split.reference}
                      onChange={(e) => updateSplit(index, 'reference', e.target.value)}
                    />
                  </div>
                  {splits.length > 1 ? (
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => removeSplit(index)}
                      className="shrink-0 rounded px-1 py-1 text-lg leading-none text-ink-400 hover:bg-red-50 hover:text-red-600"
                    >
                      ×
                    </button>
                  ) : (
                    <span className="w-6 shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {/* Running total for multi-split */}
            {splits.length > 1 && (
              <div className={`flex justify-end border-t border-ink-200 px-4 py-2 text-sm font-semibold ${overTotal ? 'text-red-600' : 'text-ink-900'}`}>
                <span>Total:&nbsp;</span>
                <span className="numeric">{formatMoney(splitTotal)}</span>
              </div>
            )}

            {/* Payment date */}
            <div className="border-t border-ink-200 px-4 py-3">
              <Field label="Payment date" htmlFor="payment_date">
                <Input
                  id="payment_date"
                  type="date"
                  value={value.payment.date}
                  onChange={(event) => setPayment({ date: event.target.value })}
                />
              </Field>
            </div>

            {/* Alerts */}
            {outstanding > 0 && (
              <div className="border-t border-ink-200 px-4 pb-3">
                <Alert tone="warning">
                  <span className="numeric">{formatMoney(outstanding)}</span> will remain outstanding on this bill.
                </Alert>
              </div>
            )}
            {overTotal && (
              <div className="border-t border-ink-200 px-4 pb-3">
                <Alert tone="error">
                  The total across all splits exceeds the bill total. Reduce an amount or remove a split.
                </Alert>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
