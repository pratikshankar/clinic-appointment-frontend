/**
 * The money half of any form that charges a patient (Sections 17-19).
 *
 * Shared by package registration and the standalone "Add a charge" dialog so
 * both produce the same bill shape. The rule it encodes is that **every rupee
 * is a line**: a consultation fee is not folded into the session price, and an
 * add-on therapy is its own line rather than a silent adjustment. That is what
 * makes the total explainable to the patient standing at the desk, and what
 * lets Phase 8 report revenue per service.
 *
 * The totals shown here are a preview. The API recomputes them from the same
 * inputs and its answer is the one that is stored -- a number a browser
 * calculated is never what gets written to a bill.
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
];

/** Methods where a transaction reference is worth capturing. */
const REFERENCED_METHODS = new Set(['UPI', 'CARD', 'BANK_TRANSFER']);

const todayISO = () => new Date().toISOString().slice(0, 10);

export function blankBilling() {
  return {
    charges: [],
    discount: '',
    collectNow: true,
    payment: { method: 'CASH', reference: '', amount: '', date: todayISO() },
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
  const paid = billing.collectNow
    ? billing.payment.amount === '' || billing.payment.amount === null
      ? total
      : toAmount(billing.payment.amount)
    : 0;

  return {
    additional_charges: (billing.charges ?? []).map((line) => ({
      description: line.description.trim(),
      unit_price: String(toAmount(line.unit_price)),
      quantity: Number(line.quantity) || 1,
      item_type: line.item_type || 'OTHER',
      service_item_id: line.service_item_id ?? null,
    })),
    discount_amount: String(toAmount(billing.discount)),
    payment:
      billing.collectNow && paid > 0
        ? {
            amount: String(paid),
            payment_method: billing.payment.method,
            reference_number: billing.payment.reference.trim() || null,
            payment_date: billing.payment.date || null,
            notes: null,
          }
        : null,
  };
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
      // A missing catalogue must not block taking money: the custom-charge row
      // below still works, so this is a note, not an error state.
      .catch((err) => !cancelled && setCatalogueError(err.message));
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  const totals = useMemo(() => billingTotals(value, baseAmount), [value, baseAmount]);

  const set = (patch) => onChange({ ...value, ...patch });
  const setPayment = (patch) => set({ payment: { ...value.payment, ...patch } });

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
              // Editing a catalogue line's price or wording makes it a one-off:
              // the link is dropped so per-service reporting is not polluted by
              // rows that no longer reflect that service.
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

  const dueNow = value.collectNow
    ? value.payment.amount === ''
      ? totals.total
      : toAmount(value.payment.amount)
    : 0;
  const outstanding = round2(totals.total - dueNow);

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
              <span className="numeric font-medium text-ink-900">
                {formatMoney(baseAmount)}
              </span>
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
                  onChange={(event) =>
                    updateCharge(index, { description: event.target.value })
                  }
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
                  onChange={(event) =>
                    updateCharge(index, { unit_price: event.target.value })
                  }
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
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Remove charge"
                  onClick={() => removeCharge(index)}
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {catalogueError && (
        <Alert tone="warning">
          The service list could not be loaded ({catalogueError}). You can still add
          charges by hand.
        </Alert>
      )}

      {/* ---------------- Totals ---------------- */}
      <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm">
        <div className="flex items-center justify-between text-ink-700">
          <span>Subtotal</span>
          <span className="numeric">{formatMoney(totals.gross)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <label htmlFor="billing_discount" className="text-ink-700">
            Discount
          </label>
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
      <div className="rounded-lg ring-1 ring-inset ring-ink-200 px-4 py-3">
        <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-300 text-brand-600"
            checked={value.collectNow}
            onChange={(event) => set({ collectNow: event.target.checked })}
          />
          Payment received now
        </label>

        {value.collectNow ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Payment method" htmlFor="payment_method" required>
              <Select
                id="payment_method"
                value={value.payment.method}
                onChange={(event) => setPayment({ method: event.target.value })}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Amount received"
              htmlFor="payment_amount"
              hint="Leave blank to record the full total"
            >
              <Input
                id="payment_amount"
                type="number"
                min={0}
                step="0.01"
                placeholder={String(totals.total.toFixed(2))}
                value={value.payment.amount}
                onChange={(event) => setPayment({ amount: event.target.value })}
              />
            </Field>

            <Field
              label="Transaction / reference no."
              htmlFor="payment_reference"
              hint={
                REFERENCED_METHODS.has(value.payment.method)
                  ? 'UPI reference, card approval code, UTR'
                  : 'Optional'
              }
            >
              <Input
                id="payment_reference"
                value={value.payment.reference}
                onChange={(event) => setPayment({ reference: event.target.value })}
                placeholder="Optional"
              />
            </Field>

            <Field label="Payment date" htmlFor="payment_date">
              <Input
                id="payment_date"
                type="date"
                value={value.payment.date}
                onChange={(event) => setPayment({ date: event.target.value })}
              />
            </Field>

            {outstanding > 0 && (
              <div className="sm:col-span-2">
                <Alert tone="warning">
                  <span className="numeric">{formatMoney(outstanding)}</span> will remain
                  outstanding on this bill.
                </Alert>
              </div>
            )}
            {outstanding < 0 && (
              <div className="sm:col-span-2">
                <Alert tone="error">
                  The amount received is more than the total. Reduce it, or add the extra
                  as a charge.
                </Alert>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-500">
            The bill is still created and shows as unpaid, so the outstanding amount is
            visible on the patient&apos;s profile.{' '}
            <Badge tone="warning">Unpaid</Badge>
          </p>
        )}
      </div>
    </div>
  );
}
