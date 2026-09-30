/**
 * Session form, shown as a modal.
 *
 * Used from two places and identical in both, so a session logged from the
 * appointments screen and one logged from the patient profile record the same
 * fields:
 *
 *   - Appointments → Complete  (passes appointmentId; completes it on save)
 *   - Patient profile → Log session
 *
 * Pre-fills itself from GET /patients/{id}/session-context, which resolves the
 * suggested package, the next session number and the selectable therapists in
 * one call.
 */

import { useEffect, useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
} from '../ui';
import {
  BillingSection,
  billingPayload,
  billingTotals,
  blankBilling,
} from '../billing/BillingSection';
import { billingService, sessionService } from '../../services';
import { formatDate, formatMoney } from '../../utils/format';

const NO_PACKAGE = '__none__';

/**
 * The two shapes money takes at the desk.
 *
 * `CHARGES_ONLY` is the default deliberately. It is the simpler record, it is
 * what a walk-in taking a consultation and one treatment actually needs, and a
 * mis-click can never register a course of sessions the patient did not buy.
 * Registering a package is the more consequential write, so it is opt-in.
 */
const CHARGES_ONLY = 'charges';
const PACKAGE = 'package';

const MONEY_MODES = [
  [CHARGES_ONLY, 'One-off charges', 'Consultation, a single treatment, a product'],
  [PACKAGE, 'Session package', 'A block of purchased sessions, plus any extras'],
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function SessionForm({
  open,
  patientId,
  appointment,
  onClose,
  onSaved,
  onCompleteWithoutSession,
  title,
}) {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(false);
  // Completing without notes is a deliberate two-step action. Closing the
  // dialog must never complete anything -- a stray click on "Complete" in the
  // list, followed by dismissing this dialog, previously marked the visit done.
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [form, setForm] = useState({
    session_date: todayISO(),
    package_id: '',
    therapist_user_id: '',
    treatment_provided: '',
    notes: '',
    remarks: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Taking money without leaving this dialog, in either of the two shapes a
  // visit actually comes in: a course of sessions, or one-off charges.
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [moneyMode, setMoneyMode] = useState(CHARGES_ONLY);
  const [packageDraft, setPackageDraft] = useState({
    sessions: '10',
    price: '',
    // When the course actually begins. Paying today and starting later is
    // normal, so this is a field rather than an assumption.
    start_date: todayISO(),
  });
  const [packageBilling, setPackageBilling] = useState(blankBilling);
  const [moneySaving, setMoneySaving] = useState(false);
  const [moneyError, setMoneyError] = useState(null);
  //: What the last save produced: { package, bill }. Drives the confirmation.
  const [moneySaved, setMoneySaved] = useState(null);

  useEffect(() => {
    if (!open || !patientId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setConfirmingSkip(false);
    setMoneyOpen(false);
    setMoneyMode(CHARGES_ONLY);
    setMoneyError(null);
    setMoneySaved(null);
    setPackageDraft({ sessions: '10', price: '', start_date: todayISO() });
    setPackageBilling(blankBilling());
    sessionService
      .context(patientId)
      .then((data) => {
        if (cancelled) return;
        setContext(data);
        setForm({
          // An appointment's date is the session's date; it is when treatment
          // actually happened.
          session_date: appointment?.appointment_date ?? todayISO(),
          package_id: data.suggested_package_id ? String(data.suggested_package_id) : NO_PACKAGE,
          therapist_user_id: '',
          treatment_provided: '',
          notes: '',
          remarks: '',
        });
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, patientId, appointment]);

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const packageMode = moneyMode === PACKAGE;
  const inlineSessions = Number(packageDraft.sessions) || 0;
  /**
   * A course that begins later cannot have a session delivered against it
   * today. The start date therefore decides whether this session consumes the
   * package — rather than assuming every package starts the day it is paid for,
   * which silently burned session 1 of a course the patient had not begun.
   */
  const startsLater = packageDraft.start_date > todayISO();
  // In charges-only mode there is no package line, so the bill's base is zero
  // and the total is whatever the charges add up to.
  const inlinePackageAmount = packageMode
    ? Math.round(inlineSessions * (Number(packageDraft.price) || 0) * 100) / 100
    : 0;
  const inlineTotals = billingTotals(packageBilling, inlinePackageAmount);
  const inlineCharges = packageBilling.charges ?? [];

  /**
   * Take the money, in whichever shape this visit is.
   *
   * Two genuinely different records come out of this panel, which is why the
   * mode is an explicit choice rather than inferred:
   *
   * - **One-off charges** — a bill and nothing else. A patient having a
   *   consultation and a single laser treatment has bought no sessions, so
   *   forcing a package on them would invent a course that does not exist.
   * - **Session package** — a package *and* its bill, written atomically by the
   *   API, with any extras (needling, a consultation fee) as further lines.
   *
   * Either way it is saved on its own: the patient has paid, so that record is
   * real whether or not the session is then logged.
   */
  async function saveMoney() {
    if (packageMode && inlineSessions < 1) {
      setMoneyError('Enter how many sessions the patient has purchased');
      return;
    }
    if (!packageMode && inlineCharges.length === 0) {
      setMoneyError('Add at least one charge, or switch to Session package');
      return;
    }
    if (inlineCharges.some((line) => !line.description.trim())) {
      setMoneyError('Every charge needs a description');
      return;
    }

    setMoneySaving(true);
    setMoneyError(null);
    try {
      if (packageMode) {
        const created = await sessionService.createPackage(patientId, {
          sessions_registered: inlineSessions,
          price_per_session: packageDraft.price || '0',
          start_date: packageDraft.start_date || null,
          clinic_id: context?.clinic_id ?? null,
          ...billingPayload(packageBilling, inlinePackageAmount),
        });
        // Reloading the context is what makes the new package appear in the
        // dropdown with correct counts.
        setContext(await sessionService.context(patientId));
        // Selected only if the course has actually started. Paying today for a
        // course beginning tomorrow means nothing is delivered today.
        setForm((prev) => ({
          ...prev,
          package_id: startsLater ? NO_PACKAGE : String(created.id),
        }));
        setMoneySaved({ package: created, bill: created.bill, startsLater });
      } else {
        const { additional_charges, discount_amount, payment } = billingPayload(
          packageBilling,
          0,
        );
        const bill = await billingService.charge(patientId, {
          items: additional_charges,
          discount_amount,
          payment,
          clinic_id: context?.clinic_id ?? null,
        });
        // Nothing was purchased in sessions, so this session must not consume
        // one -- make that explicit rather than leaving a stale selection.
        setForm((prev) => ({ ...prev, package_id: NO_PACKAGE }));
        setMoneySaved({ package: null, bill });
      }
      setMoneyOpen(false);
    } catch (err) {
      setMoneyError(err.message);
    } finally {
      setMoneySaving(false);
    }
  }

  const chosenPackage =
    form.package_id && form.package_id !== NO_PACKAGE
      ? context?.packages?.find((p) => String(p.id) === form.package_id)
      : null;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const result = await sessionService.log(patientId, {
        session_date: form.session_date,
        // Blank means "log without consuming a package" — the API distinguishes
        // that from "choose one for me" via no_package.
        package_id: form.package_id === NO_PACKAGE ? null : Number(form.package_id),
        no_package: form.package_id === NO_PACKAGE,
        appointment_id: appointment?.id ?? null,
        therapist_user_id: form.therapist_user_id ? Number(form.therapist_user_id) : null,
        treatment_provided: form.treatment_provided.trim() || null,
        notes: form.notes.trim() || null,
        remarks: form.remarks.trim() || null,
      });
      onSaved?.(result);
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
      // Notes typed here are easy to lose and completing is consequential, so a
      // mis-click on the backdrop must not dismiss the dialog.
      dismissOnBackdrop={false}
      title={title ?? 'Record session'}
      footer={
        confirmingSkip ? (
          <>
            <span className="mr-auto self-center text-xs text-ink-600">
              Mark the visit complete with <strong>no session recorded</strong>? No package
              session is used.
            </span>
            <Button variant="secondary" onClick={() => setConfirmingSkip(false)}>
              Go back
            </Button>
            <Button
              variant="danger"
              loading={skipping}
              onClick={async () => {
                setSkipping(true);
                try {
                  await onCompleteWithoutSession?.();
                } finally {
                  setSkipping(false);
                  setConfirmingSkip(false);
                }
              }}
            >
              Yes, no session delivered
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {appointment && onCompleteWithoutSession && (
              <Button
                variant="secondary"
                onClick={() => setConfirmingSkip(true)}
                title="Completes the appointment without recording a session, so no package session is used"
              >
                No session delivered
              </Button>
            )}
            <Button loading={saving} disabled={loading} onClick={save}>
              {appointment ? 'Save and complete' : 'Save session'}
            </Button>
          </>
        )
      }
    >
      {loading ? (
        <div className="grid place-items-center py-10 text-brand-600">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          {context && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
              <Badge tone="brand">{context.patient_code}</Badge>
              <span className="font-medium text-ink-900">{context.patient_name}</span>
              {context.clinic_name && <span>· {context.clinic_name}</span>}
              <span className="text-ink-400">
                · {context.total_sessions_taken} of {context.total_sessions_registered}{' '}
                sessions used
              </span>
            </div>
          )}

          {appointment && (
            <Alert tone="info">
              Saving records this session <strong>and</strong> marks{' '}
              {appointment.appointment_code} completed. Closing this dialog changes
              nothing — the appointment stays as it is.
            </Alert>
          )}

          {context?.warnings?.map((warning) => (
            <Alert key={warning} tone="warning">
              {warning}
            </Alert>
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Session date" htmlFor="session_date" required>
              <Input
                id="session_date"
                type="date"
                max={todayISO()}
                value={form.session_date}
                onChange={update('session_date')}
                required
              />
            </Field>

            <Field
              label="Package"
              htmlFor="package_id"
              hint={
                chosenPackage
                  ? `${chosenPackage.sessions_remaining} of ${chosenPackage.sessions_registered} remaining`
                  : 'Logged without consuming a purchased session'
              }
            >
              <div className="flex items-center gap-2">
                <Select
                  id="package_id"
                  value={form.package_id}
                  onChange={update('package_id')}
                  className="flex-1"
                >
                  <option value={NO_PACKAGE}>No package (assessment / one-off)</option>
                  {(context?.packages ?? [])
                    .filter((p) => p.status === 'ACTIVE' && p.sessions_remaining > 0)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.package_name} — {p.sessions_remaining} left
                      </option>
                    ))}
                </Select>
                {/*
                  A patient often settles up at exactly this moment -- checked
                  in, session about to be logged. Sending reception to another
                  screen and back, while the patient waits, is the wrong answer.
                */}
                {!moneyOpen && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => setMoneyOpen(true)}
                  >
                    + Charge / package
                  </Button>
                )}
              </div>
            </Field>

            {moneyOpen && (
              <div className="rounded-lg bg-brand-50 px-4 py-3 ring-1 ring-inset ring-brand-200 sm:col-span-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
                  Take payment now
                </p>

                {/*
                  What the patient bought decides the record, so it is asked
                  first. Charges-only creates a bill and no package; a patient
                  having a consultation and one laser treatment has not bought a
                  course, and inventing one would corrupt their session counts.
                */}
                <div
                  role="tablist"
                  aria-label="What is the patient paying for?"
                  className="mb-3 inline-flex rounded-lg bg-white p-1 ring-1 ring-inset ring-brand-200"
                >
                  {MONEY_MODES.map(([value, label, hint]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={moneyMode === value}
                      title={hint}
                      onClick={() => {
                        setMoneyMode(value);
                        setMoneyError(null);
                      }}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        moneyMode === value
                          ? 'bg-brand-600 text-white'
                          : 'text-ink-700 hover:bg-brand-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {moneyError && (
                  <div className="mb-2">
                    <Alert tone="error">{moneyError}</Alert>
                  </div>
                )}

                {packageMode ? (
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Field label="Sessions" htmlFor="inline_sessions" required>
                      <Input
                        id="inline_sessions"
                        type="number"
                        min={1}
                        max={500}
                        value={packageDraft.sessions}
                        onChange={(event) =>
                          setPackageDraft((prev) => ({ ...prev, sessions: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Price per session" htmlFor="inline_price">
                      <Input
                        id="inline_price"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="500.00"
                        value={packageDraft.price}
                        onChange={(event) =>
                          setPackageDraft((prev) => ({ ...prev, price: event.target.value }))
                        }
                      />
                    </Field>
                    <Field
                      label="Starts on"
                      htmlFor="inline_start"
                      hint={startsLater ? 'Future course' : 'Starting today'}
                    >
                      <Input
                        id="inline_start"
                        type="date"
                        value={packageDraft.start_date}
                        onChange={(event) =>
                          setPackageDraft((prev) => ({
                            ...prev,
                            start_date: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <div className="flex items-end">
                      <p className="pb-2 text-xs text-brand-900/70">
                        {inlineSessions} × {formatMoney(Number(packageDraft.price) || 0)} ={' '}
                        <strong className="numeric">{formatMoney(inlinePackageAmount)}</strong>
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-brand-900/70">
                    No sessions are purchased. Add what the patient is paying for below —
                    this session will be logged without consuming a package.
                  </p>
                )}

                {/*
                  Extras sit alongside either mode: "one session plus a
                  consultation fee", or "a consultation plus one laser
                  treatment". Each is its own line, so the bill shows what each
                  part was for.
                */}
                <div className="mt-3">
                  <BillingSection
                    value={packageBilling}
                    onChange={setPackageBilling}
                    clinicId={context?.clinic_id ?? null}
                    baseAmount={inlinePackageAmount}
                    requireCharge={!packageMode}
                    baseLabel={
                      packageMode && inlineSessions > 0
                        ? `${inlineSessions}-session package (${inlineSessions} × ${formatMoney(
                            Number(packageDraft.price) || 0,
                          )})`
                        : null
                    }
                  />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button loading={moneySaving} onClick={saveMoney}>
                    {packageMode ? 'Register and take' : 'Save charge —'}{' '}
                    {formatMoney(inlineTotals.total)}
                  </Button>
                  <Button variant="ghost" onClick={() => setMoneyOpen(false)}>
                    Cancel
                  </Button>
                </div>
                <p className="mt-2 text-xs text-brand-900/70">
                  {!packageMode
                    ? 'Saved straight away as its own bill. It does not use up a package session.'
                    : startsLater
                      ? 'Saved and paid for now, but the course starts later — so no session is ' +
                        'used today and the patient keeps all ' +
                        `${inlineSessions}. Pick the package when they come in.`
                      : 'Saved straight away and selected for this session. This session will be its first.'}
                </p>
              </div>
            )}

            {moneySaved && !moneyOpen && (
              <div className="sm:col-span-2">
                <Alert tone="success">
                  {moneySaved.package ? (
                    moneySaved.startsLater ? (
                      <>
                        Registered {moneySaved.package.sessions_registered} sessions starting{' '}
                        <strong>{formatDate(moneySaved.package.start_date)}</strong>. Nothing is
                        used today — all {moneySaved.package.sessions_registered} remain.{' '}
                      </>
                    ) : (
                      <>
                        Registered {moneySaved.package.sessions_registered} sessions
                        {Number(moneySaved.package.price_per_session) > 0
                          ? ` at ${formatMoney(moneySaved.package.price_per_session)} each`
                          : ''}
                        . It is selected below and this session will be session 1.{' '}
                      </>
                    )
                  ) : (
                    <>Charge saved. This session will be logged without a package. </>
                  )}
                  {moneySaved.bill && (
                    <>
                      Bill <strong>{moneySaved.bill.bill_number}</strong> raised for{' '}
                      <span className="numeric">
                        {formatMoney(moneySaved.bill.total_amount)}
                      </span>
                      {Number(moneySaved.bill.balance_amount) > 0 ? (
                        <>
                          {' '}
                          — <span className="numeric">
                            {formatMoney(moneySaved.bill.balance_amount)}
                          </span>{' '}
                          still outstanding.
                        </>
                      ) : (
                        ', paid in full.'
                      )}
                    </>
                  )}
                </Alert>
              </div>
            )}

            <Field label="Therapist" htmlFor="therapist_user_id" hint="Optional — leave blank if unknown">
              <Select
                id="therapist_user_id"
                value={form.therapist_user_id}
                onChange={update('therapist_user_id')}
              >
                <option value="">— Select therapist —</option>
                {(context?.therapists ?? []).map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Session number" htmlFor="session_number_display">
              <Input
                id="session_number_display"
                value={
                  chosenPackage
                    ? `${chosenPackage.sessions_taken + 1} of ${chosenPackage.sessions_registered}`
                    : 'Next in sequence'
                }
                disabled
              />
            </Field>

            <div className="sm:col-span-2">
              <Field
                label="Treatment provided"
                htmlFor="treatment_provided"
                hint="e.g. Manual therapy + supervised exercises"
              >
                <Input
                  id="treatment_provided"
                  value={form.treatment_provided}
                  onChange={update('treatment_provided')}
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Notes" htmlFor="notes" hint="How the patient responded">
                <Input id="notes" value={form.notes} onChange={update('notes')} />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Remarks" htmlFor="remarks" hint="Optional">
                <Input id="remarks" value={form.remarks} onChange={update('remarks')} />
              </Field>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
