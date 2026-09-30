import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Icon } from '../../components/Icon';
import {
  Alert,
  Button,
  Card,
  Input,
  PageHeader,
  Select,
  Spinner,
  StepIndicator,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { refundService } from '../../services';
import { formatMoney } from '../../utils/format';

const STEPS = ['Details', 'Calculation', 'Payment'];

function CalculationRow({ label, value, highlight }) {
  return (
    <div className={`flex justify-between py-1 text-sm ${highlight ? 'font-semibold' : ''}`}>
      <span className="text-ink-600">{label}</span>
      <span className={highlight ? 'text-brand-700' : 'text-ink-900'}>{value}</span>
    </div>
  );
}

export default function RefundRequest() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const packageId = searchParams.get('package_id');

  const basePath =
    role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';

  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: prefill, loading: prefillLoading, error: prefillError } = useApi(
    () => (packageId ? refundService.prefill(packageId) : null),
    [packageId],
  );

  const [form, setForm] = useState({
    reason: '',
    single_session_rate: '',
    package_session_rate: '',
    consultation_fee: '',
    calculation_notes: '',
    payment_method: 'BANK_TRANSFER',
    bank_account_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    upi_id: '',
  });

  useEffect(() => {
    if (prefill) {
      setForm((prev) => ({
        ...prev,
        single_session_rate: String(prefill.suggested_single_session_rate),
        package_session_rate: String(prefill.package_session_rate),
        consultation_fee: String(prefill.consultation_fee),
        calculation_notes: prefill.calculation_notes,
      }));
    }
  }, [prefill]);

  const numericField = (f) => parseFloat(form[f]) || 0;

  const liveDeduction = (() => {
    const consumed = prefill?.sessions_consumed ?? 0;
    const single = numericField('single_session_rate');
    const pkg = numericField('package_session_rate');
    const consult = numericField('consultation_fee');
    const sessionCharge = consumed < 5 ? consumed * single : consumed * pkg;
    return sessionCharge + consult;
  })();

  const liveRefund = Math.max(0, (prefill?.total_paid ?? 0) - liveDeduction);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const canNext0 = form.reason.trim().length >= 10;
  const canNext1 = numericField('single_session_rate') >= 0;
  const canSubmit =
    form.payment_method === 'BANK_TRANSFER'
      ? form.bank_account_name.trim() && form.bank_account_number.trim() && form.bank_ifsc.trim()
      : form.upi_id.trim().length > 0;

  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    try {
      await refundService.initiate({
        package_id: Number(packageId),
        reason: form.reason,
        single_session_rate: numericField('single_session_rate'),
        package_session_rate: numericField('package_session_rate'),
        consultation_fee: numericField('consultation_fee'),
        calculation_notes: form.calculation_notes || undefined,
        payment_method: form.payment_method,
        bank_account_name: form.payment_method === 'BANK_TRANSFER' ? form.bank_account_name : undefined,
        bank_account_number: form.payment_method === 'BANK_TRANSFER' ? form.bank_account_number : undefined,
        bank_ifsc: form.payment_method === 'BANK_TRANSFER' ? form.bank_ifsc : undefined,
        upi_id: form.payment_method === 'UPI' ? form.upi_id : undefined,
      });
      navigate(`${basePath}/refunds`, { replace: true, state: { success: true } });
    } catch (err) {
      setError(err.message ?? 'Failed to submit refund request');
    } finally {
      setSubmitting(false);
    }
  }

  if (!packageId) {
    return (
      <div className="p-6 text-center text-ink-500">
        No package selected. Go to a patient&apos;s profile and click &quot;Request Refund&quot;.
      </div>
    );
  }

  if (prefillLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (prefillError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {prefillError.message}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Request Refund"
        description={prefill ? `Package: ${prefill.sessions_registered} sessions` : ''}
      />

      <StepIndicator steps={STEPS} current={step} />

      <div className="mt-6 max-w-2xl space-y-4">
        {error && (
          <Alert tone="danger" onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Step 0: Cancellation reason */}
        {step === 0 && (
          <Card>
            <div className="px-5 py-4 space-y-4">
              <h3 className="font-semibold text-ink-800">Cancellation reason</h3>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Explain the reason for cancellation (min 10 characters)"
                  value={form.reason}
                  onChange={set('reason')}
                />
                <p className="mt-1 text-xs text-ink-500">{form.reason.length} / 2000 characters</p>
              </div>

              <div>
                <p className="text-sm text-ink-500 mb-2">
                  You can upload supporting documents (cancellation letter, etc.) after submitting.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep(1)} disabled={!canNext0}>
                  Next: Calculation
                  <Icon name="chevron-right" className="ml-1 size-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 1: Calculation */}
        {step === 1 && prefill && (
          <Card>
            <div className="px-5 py-4 space-y-4">
              <h3 className="font-semibold text-ink-800">Refund calculation</h3>

              {/* Summary row */}
              <div className="grid grid-cols-3 gap-3 rounded-lg bg-ink-50 px-4 py-3 text-center text-sm">
                <div>
                  <div className="text-xs text-ink-500">Sessions consumed</div>
                  <div className="font-semibold text-ink-900">{prefill.sessions_consumed}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-500">Sessions registered</div>
                  <div className="font-semibold text-ink-900">{prefill.sessions_registered}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-500">Total paid</div>
                  <div className="font-semibold text-ink-900">{formatMoney(prefill.total_paid)}</div>
                </div>
              </div>

              {prefill.sessions_consumed < 5 && (
                <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  Fewer than 5 sessions consumed — single-session (walk-in) rate applies for deduction.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Single session rate (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.single_session_rate}
                  onChange={set('single_session_rate')}
                  helperText="Walk-in rate per session"
                />
                <Input
                  label="Package session rate (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.package_session_rate}
                  onChange={set('package_session_rate')}
                />
                <Input
                  label="Consultation fee (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.consultation_fee}
                  onChange={set('consultation_fee')}
                  helperText="Always non-refundable"
                />
              </div>

              {/* Live calculation preview */}
              <div className="rounded-lg border border-ink-200 px-4 py-3 space-y-1">
                <CalculationRow label="Total paid" value={formatMoney(prefill.total_paid)} />
                <CalculationRow
                  label={
                    prefill.sessions_consumed < 5
                      ? `Session deduction (${prefill.sessions_consumed} × ₹${form.single_session_rate || 0} single rate)`
                      : `Session deduction (${prefill.sessions_consumed} × ₹${form.package_session_rate || 0} package rate)`
                  }
                  value={`−${formatMoney(liveDeduction - numericField('consultation_fee'))}`}
                />
                {numericField('consultation_fee') > 0 && (
                  <CalculationRow
                    label="Consultation fee (non-refundable)"
                    value={`−${formatMoney(numericField('consultation_fee'))}`}
                  />
                )}
                <div className="border-t border-ink-200 pt-1">
                  <CalculationRow
                    label="Refund amount"
                    value={formatMoney(liveRefund)}
                    highlight
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700">
                  Calculation notes (optional)
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={form.calculation_notes}
                  onChange={set('calculation_notes')}
                />
              </div>

              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep(0)}>
                  <Icon name="chevron-left" className="mr-1 size-4" />
                  Back
                </Button>
                <Button onClick={() => setStep(2)} disabled={!canNext1}>
                  Next: Payment
                  <Icon name="chevron-right" className="ml-1 size-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 2: Payment details */}
        {step === 2 && (
          <Card>
            <div className="px-5 py-4 space-y-4">
              <h3 className="font-semibold text-ink-800">Patient payment details</h3>

              <Select
                label="Payment method"
                value={form.payment_method}
                onChange={set('payment_method')}
              >
                <option value="BANK_TRANSFER">Bank transfer (preferred)</option>
                <option value="UPI">UPI</option>
              </Select>

              {form.payment_method === 'BANK_TRANSFER' && (
                <div className="space-y-3">
                  <Input
                    label="Account holder name"
                    value={form.bank_account_name}
                    onChange={set('bank_account_name')}
                    placeholder="Full name as on bank account"
                    required
                  />
                  <Input
                    label="Account number"
                    value={form.bank_account_number}
                    onChange={set('bank_account_number')}
                    placeholder="e.g. 0123456789"
                    required
                  />
                  <Input
                    label="IFSC code"
                    value={form.bank_ifsc}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, bank_ifsc: e.target.value.toUpperCase() }))
                    }
                    placeholder="e.g. HDFC0001234"
                    required
                  />
                </div>
              )}

              {form.payment_method === 'UPI' && (
                <Input
                  label="UPI ID"
                  value={form.upi_id}
                  onChange={set('upi_id')}
                  placeholder="e.g. name@upi"
                  required
                />
              )}

              {/* Final summary */}
              <div className="rounded-lg bg-brand-50 border border-brand-200 px-4 py-3">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-700">Refund amount</span>
                  <span className="font-bold text-brand-700">{formatMoney(liveRefund)}</span>
                </div>
                <div className="mt-1 text-xs text-ink-500">
                  Will be transferred after admin approval.
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  <Icon name="chevron-left" className="mr-1 size-4" />
                  Back
                </Button>
                <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
                  Submit Request
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
