/**
 * Patient profile: the complete timeline from Section 21.
 *
 * Layout follows the spec's order — basic information, treatment package,
 * appointment history, session history, billing. Sections that are empty say so
 * rather than being hidden, because "no sessions recorded" is information.
 */

import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Icon } from '../../components/Icon';
import { BillEditModal } from '../../components/billing/BillEditModal';
import { ChargeForm } from '../../components/billing/ChargeForm';
import { DocumentActions } from '../../components/billing/DocumentActions';
import { PaymentEditModal } from '../../components/billing/PaymentEditModal';
import { RecordPaymentForm } from '../../components/billing/RecordPaymentForm';
import { PackageEditModal } from '../../components/session/PackageEditModal';
import { PackageForm } from '../../components/session/PackageForm';
import { SessionEditModal } from '../../components/session/SessionEditModal';
import { SessionForm } from '../../components/session/SessionForm';
import { PrescriptionForm } from '../../components/prescriptions/PrescriptionForm';
import { PrescriptionList } from '../../components/prescriptions/PrescriptionList';
import { prescriptionService } from '../../services/prescriptionService.js';
import { physioPointsService } from '../../services/physioPointsService.js';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
  Table,
  Td,
  Th,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { billingService, clinicService, patientService, sessionService } from '../../services';
import {
  formatCurrency,
  formatDate,
  formatMoney,
  formatNumber,
  formatTime,
} from '../../utils/format';

const APPOINTMENT_TONES = {
  BOOKED: 'info',
  CONFIRMED: 'brand',
  CHECKED_IN: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  RESCHEDULED: 'neutral',
  NO_SHOW: 'danger',
};

const PAYMENT_TONES = { PAID: 'success', PARTIAL: 'warning', UNPAID: 'danger' };

const TXN_LABELS = {
  EARNED: { label: 'Earned', color: 'text-emerald-700', sign: '+' },
  REDEEMED: { label: 'Redeemed', color: 'text-brand-700', sign: '−' },
  REFUND_REVOKE: { label: 'Refund revoke', color: 'text-red-600', sign: '−' },
  REFUND_RESTORE: { label: 'Refund restore', color: 'text-emerald-700', sign: '+' },
  MANUAL_CREDIT: { label: 'Manual credit', color: 'text-emerald-700', sign: '+' },
  MANUAL_DEBIT: { label: 'Manual debit', color: 'text-red-600', sign: '−' },
};

function PhysioPointsBanner({ balance, ledger, redeemValue = 0.5, earnPer100 = 10, expiryDays = 365, role, patientId, showLedger, onToggleLedger, adjusting, onAdjust, onAdjustClose }) {
  const [adjustPts, setAdjustPts] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjBusy, setAdjBusy] = useState(false);
  const [adjError, setAdjError] = useState(null);

  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';

  async function submitAdjust(e) {
    e.preventDefault();
    const pts = parseInt(adjustPts, 10);
    if (!pts || !adjustReason.trim()) return;
    setAdjBusy(true);
    setAdjError(null);
    try {
      await physioPointsService.adjust(patientId, pts, adjustReason);
      setAdjustPts('');
      setAdjustReason('');
      onAdjustClose();
    } catch (err) {
      setAdjError(err.message);
    } finally {
      setAdjBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon name="star" className="size-5 shrink-0 text-amber-500" />
          <div>
            <span className="text-sm font-semibold text-ink-900">
              {balance} Physio Points
            </span>
            <span className="ml-2 text-xs text-ink-500">
              = ₹{(balance * redeemValue).toFixed(redeemValue % 1 === 0 ? 0 : 2)} discount
              {' '}· earn {earnPer100} pts / ₹100 · expires in {Math.round(expiryDays / 30)} months
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button size="sm" variant="secondary" onClick={onAdjust}>Adjust</Button>
          )}
          <Button size="sm" variant="secondary" onClick={onToggleLedger}>
            {showLedger ? 'Hide history' : 'History'}
          </Button>
        </div>
      </div>

      {adjusting && isAdmin && (
        <form onSubmit={submitAdjust} className="mt-3 border-t border-amber-200 pt-3 space-y-2">
          <p className="text-xs font-medium text-ink-700">Manual points adjustment</p>
          <div className="flex gap-2 items-end">
            <div>
              <label className="text-xs text-ink-500">Points (+ credit, − debit)</label>
              <input
                type="number"
                className="mt-0.5 block w-28 rounded-md border border-ink-300 px-3 py-1.5 text-sm"
                placeholder="e.g. 50 or -20"
                value={adjustPts}
                onChange={(e) => setAdjustPts(e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-ink-500">Reason (required)</label>
              <input
                type="text"
                className="mt-0.5 block w-full rounded-md border border-ink-300 px-3 py-1.5 text-sm"
                placeholder="e.g. Goodwill gesture for delay"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                minLength={5}
                required
              />
            </div>
            <Button size="sm" type="submit" loading={adjBusy}>Save</Button>
            <Button size="sm" variant="secondary" type="button" onClick={onAdjustClose}>Cancel</Button>
          </div>
          {adjError && <p className="text-xs text-red-600">{adjError}</p>}
        </form>
      )}

      {showLedger && (
        <div className="mt-3 border-t border-amber-200 pt-3">
          {ledger.length === 0 ? (
            <p className="text-xs text-ink-500">No points activity yet.</p>
          ) : (
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {ledger.map((e) => {
                const meta = TXN_LABELS[e.transaction_type] ?? { label: e.transaction_type, color: 'text-ink-700', sign: '' };
                return (
                  <div key={e.id} className="flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                      <span className="ml-2 text-ink-500 truncate">{e.description}</span>
                    </div>
                    <span className={`shrink-0 font-mono font-semibold ${meta.color}`}>
                      {meta.sign}{Math.abs(e.points)} pts
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReferralCodeBanner({ code }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
      <Icon name="users" className="size-5 shrink-0 text-brand-600" />
      <div className="flex-1 min-w-0">
        <span className="text-ink-600">Referral code </span>
        <span className="font-mono font-semibold text-ink-900">{code}</span>
        <span className="ml-2 text-xs text-ink-400">Share with friends — they earn 2 free sessions when they register a 5+ session package</span>
      </div>
      <Button size="sm" variant="secondary" onClick={copy}>
        {copied ? 'Copied!' : 'Copy'}
      </Button>
    </div>
  );
}

export default function PatientProfile() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const basePath = role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const [loggingSession, setLoggingSession] = useState(false);
  const [addingPackage, setAddingPackage] = useState(false);
  const [addingCharge, setAddingCharge] = useState(false);
  const [payingBill, setPayingBill] = useState(null);
  const [openBillId, setOpenBillId] = useState(null);
  const [redeemingPackageId, setRedeemingPackageId] = useState(null);
  const [redeemingReferredPackageId, setRedeemingReferredPackageId] = useState(null);
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null);
  const [addingPrescription, setAddingPrescription] = useState(false);
  const [showPointsLedger, setShowPointsLedger] = useState(false);
  const [adjustingPoints, setAdjustingPoints] = useState(false);
  const { data: clinics } = useApi(() => clinicService.list({ status: 'ACTIVE' }), []);
  const {
    data: pointsData,
    reload: reloadPoints,
  } = useApi(() => physioPointsService.get(patientId), [patientId]);
  const {
    data: prescriptions,
    loading: prescriptionsLoading,
    reload: reloadPrescriptions,
  } = useApi(() => prescriptionService.list(patientId), [patientId]);
  const { data: sessionCtx } = useApi(() => sessionService.context(patientId), [patientId]);

  const { data, loading, error, reload } = useApi(
    () => patientService.profile(patientId),
    [patientId]
  );

  // Fetched separately from the profile because the full bill -- its lines and
  // its payments -- is what makes a total explainable at the desk, and the
  // profile endpoint returns only the summary row.
  const {
    data: bills,
    loading: billsLoading,
    reload: reloadBills,
  } = useApi(() => billingService.forPatient(patientId), [patientId]);

  async function reloadAll() {
    await Promise.all([reload(), reloadBills()]);
  }

  async function handleRedeemCredit(packageId) {
    setRedeemBusy(true);
    try {
      await sessionService.redeemReferralCredit(packageId, 2);
      setRedeemingPackageId(null);
      await reload();
      setBanner({ tone: 'success', message: '2 referrer credit sessions redeemed onto the package.' });
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setRedeemBusy(false);
    }
  }

  async function handleRedeemReferredCredit(packageId) {
    setRedeemBusy(true);
    try {
      await sessionService.redeemReferredCredit(packageId, 2);
      setRedeemingReferredPackageId(null);
      await reload();
      setBanner({ tone: 'success', message: '2 referred-patient credit sessions redeemed onto the package.' });
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setRedeemBusy(false);
    }
  }

  async function toggleArchive() {
    setBusy(true);
    setBanner(null);
    try {
      const action = data.patient.is_active ? patientService.archive : patientService.restore;
      await action(patientId);
      await reload();
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card className="grid place-items-center py-20 text-brand-600">
        <Spinner size="lg" />
      </Card>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader
          title="Patient"
          breadcrumb={[{ label: 'Patients', to: `${basePath}/patients` }]}
        />
        <Alert tone="error" title="Could not load this patient">
          {error.message}
        </Alert>
      </>
    );
  }

  const { patient } = data;
  const cancelled = data.cancelled_package_count ?? 0;
  const cancelledNote =
    cancelled > 0
      ? `Excludes ${cancelled} cancelled package${cancelled === 1 ? '' : 's'}`
      : undefined;

  return (
    <>
      <PageHeader
        title={patient.full_name}
        backTo={`${basePath}/patients`}
        backLabel="All patients"
        breadcrumb={[
          { label: 'Patients', to: `${basePath}/patients` },
          { label: patient.patient_code },
        ]}
        description={[
          patient.age ? `${patient.age} years` : null,
          patient.gender ? patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase() : null,
          patient.primary_clinic_name,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <div className="flex flex-wrap gap-2">
            {patient.is_active && (
              <>
                <Link
                  to={`${basePath}/appointments/new?patient_id=${patient.id}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  <Icon name="calendar" className="size-4" />
                  Book next appointment
                </Link>
                <Button variant="secondary" onClick={() => setLoggingSession(true)}>
                  <Icon name="activity" className="size-4" />
                  Log session
                </Button>
              </>
            )}
            <Link
              to={`${basePath}/referrals/new?referred_patient_id=${patient.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-ink-800 ring-1 ring-inset ring-ink-300 hover:bg-ink-50"
            >
              <Icon name="users" className="size-4" />
              Link referral
            </Link>
            <Link
              to={`${basePath}/patients/${patient.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-ink-800 ring-1 ring-inset ring-ink-300 hover:bg-ink-50"
            >
              <Icon name="sliders" className="size-4" />
              Edit
            </Link>
            <Button
              variant={patient.is_active ? 'danger' : 'primary'}
              loading={busy}
              onClick={toggleArchive}
            >
              {patient.is_active ? 'Archive' : 'Restore'}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="brand">{patient.patient_code}</Badge>
        {!patient.is_active && <Badge tone="danger">Archived</Badge>}
        {!patient.is_profile_complete && (
          <Badge tone="warning">Profile incomplete</Badge>
        )}
        {data.packages.filter((p) => p.status === 'ACTIVE' && p.sessions_remaining > 0)
          .length === 0 && <Badge tone="neutral">No active package</Badge>}
        {patient.source_name && <Badge tone="neutral">via {patient.source_name}</Badge>}
      </div>

      {banner && (
        <div className="mb-4">
          <Alert tone={banner.tone} onDismiss={() => setBanner(null)}>
            {banner.message}
          </Alert>
        </div>
      )}

      {!patient.is_profile_complete && (
        <div className="mb-4">
          <Alert tone="warning" title="This profile is incomplete">
            It was created from a booking with only the essentials. Add gender, address and
            source to complete it.{' '}
            <Link
              to={`${basePath}/patients/${patient.id}/edit`}
              className="font-medium underline"
            >
              Complete now
            </Link>
          </Alert>
        </div>
      )}

      {data.scoped_to_your_clinics && (
        <div className="mb-4">
          <Alert tone="info">
            Showing this patient's history at your clinic. Treatment given at other branches is
            not listed.
          </Alert>
        </div>
      )}

      {/* Roll-ups */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/*
          These count live packages only. Saying so on the card is what stops
          the difference between "10" in the table and "0" here from reading as
          a bug to whoever is looking at it next.
        */}
        <StatCard
          label="Sessions registered"
          value={formatNumber(data.total_sessions_registered)}
          hint={cancelledNote}
        />
        <StatCard label="Sessions taken" value={formatNumber(data.total_sessions_taken)} tone="brand" />
        <StatCard
          label="Sessions remaining"
          value={formatNumber(data.total_sessions_remaining)}
          tone="positive"
          hint={cancelledNote}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(data.total_outstanding)}
          tone={Number(data.total_outstanding) > 0 ? 'warning' : 'default'}
          hint={`${formatCurrency(data.total_paid)} paid of ${formatCurrency(data.total_billed)}`}
        />
      </div>

      {/* Physio Points balance */}
      {(pointsData?.balance ?? 0) >= 0 && (
        <PhysioPointsBanner
          balance={pointsData?.balance ?? 0}
          ledger={pointsData?.ledger ?? []}
          redeemValue={pointsData?.redeem_value ?? 0.5}
          earnPer100={pointsData?.earn_per_100 ?? 10}
          expiryDays={pointsData?.expiry_days ?? 365}
          role={role}
          patientId={patientId}
          showLedger={showPointsLedger}
          onToggleLedger={() => setShowPointsLedger((v) => !v)}
          adjusting={adjustingPoints}
          onAdjust={() => setAdjustingPoints(true)}
          onAdjustClose={() => { setAdjustingPoints(false); reloadPoints(); }}
        />
      )}

      {/* Referral code — shareable with the patient so they can refer friends */}
      {patient.referral_code && (
        <ReferralCodeBanner code={patient.referral_code} />
      )}

      {/* Referral credit balances */}
      {(data.referral_session_credits ?? 0) >= 2 && (
        <div className="mb-2 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <Icon name="gift" className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div className="text-sm text-emerald-800">
            <span className="font-semibold">
              {data.referral_session_credits} referrer credit session
              {data.referral_session_credits > 1 ? 's' : ''} available
            </span>{' '}
            (earned by referring someone). Use <strong>Redeem 2</strong> on any active package below.
          </div>
        </div>
      )}
      {(data.referred_session_credits ?? 0) >= 2 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <Icon name="gift" className="mt-0.5 size-5 shrink-0 text-blue-600" />
          <div className="text-sm text-blue-800">
            <span className="font-semibold">
              {data.referred_session_credits} referred-patient credit session
              {data.referred_session_credits > 1 ? 's' : ''} available
            </span>{' '}
            (earned as a referred patient). Redeemable on packages with <strong>minimum 5 sessions</strong>.
            These are forfeited if the qualifying package is cancelled.
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Basic information */}
        <Card>
          <CardHeader title="Basic information" />
          <dl className="grid gap-x-6 divide-y divide-ink-100 text-sm sm:grid-cols-2 sm:divide-y-0">
            {[
              ['Patient ID', patient.patient_code],
              ['Mobile', patient.mobile],
              [
                'WhatsApp',
                patient.whatsapp_number
                  ? patient.whatsapp_number
                  : patient.mobile
                    ? `${patient.mobile} (same as mobile)`
                    : null,
              ],
              ['Email', patient.email],
              [
                'Age',
                patient.age
                  ? `${patient.age}${
                      patient.age_as_of === 'date_of_birth' ? ' (from date of birth)' : ' (at registration)'
                    }`
                  : null,
              ],
              ['Date of birth', patient.date_of_birth ? formatDate(patient.date_of_birth) : null],
              ['Gender', patient.gender],
              ['Address', patient.address],
              ['Chief complaint', patient.chief_complaint],
              ['Diagnosis', patient.diagnosis],
              ['Source', patient.source_name],
              ['Source detail', patient.source_detail],
              ['Registered', formatDate(patient.registration_date)],
              ['Home clinic', patient.primary_clinic_name],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-4 px-5 py-2.5">
                <dt className="w-36 shrink-0 text-ink-500">{label}</dt>
                <dd className="min-w-0 break-words text-ink-900">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Treatment packages */}
        <Card>
          <CardHeader
            title="Treatment packages"
            description="Purchased session blocks. Sessions consume the oldest active package first."
            action={
              patient.is_active && (
                <Button size="sm" onClick={() => setAddingPackage(true)}>
                  Register package
                </Button>
              )
            }
          />
          {data.packages.length === 0 ? (
            <EmptyState
              title="No treatment package"
              description="No session package has been registered for this patient."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Package</Th>
                  <Th>Clinic</Th>
                  <Th align="right">Registered</Th>
                  <Th align="right">Taken</Th>
                  <Th align="right">Remaining</Th>
                  <Th align="right">Value</Th>
                  <Th>Status</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {data.packages.map((pkg) => {
                  // A cancelled package is kept as history, but nothing about it
                  // is still available -- so it is greyed out and its remaining
                  // count reads "—", not the number it was registered for.
                  const isCancelled = pkg.status === 'CANCELLED';
                  return (
                  <tr
                    key={pkg.id}
                    className={isCancelled ? 'text-ink-400' : 'hover:bg-ink-50/60'}
                  >
                    <Td className={isCancelled ? 'line-through' : 'font-medium text-ink-900'}>
                      {pkg.package_name ?? `${pkg.sessions_registered}-session package`}
                      {pkg.start_date && (
                        <div className="text-xs text-ink-500">
                          from {formatDate(pkg.start_date)}
                        </div>
                      )}
                    </Td>
                    <Td>{pkg.clinic_name ?? '—'}</Td>
                    <Td align="right">{pkg.sessions_registered}</Td>
                    <Td align="right">{pkg.sessions_taken}</Td>
                    <Td align="right">
                      {isCancelled ? (
                        <span title="Cancelled — no sessions available">—</span>
                      ) : (
                        <span className="font-medium text-emerald-700">
                          {pkg.sessions_remaining}
                        </span>
                      )}
                    </Td>
                    <Td align="right">{formatCurrency(pkg.total_amount)}</Td>
                    <Td>
                      <Badge
                        tone={
                          pkg.status === 'ACTIVE'
                            ? 'success'
                            : isCancelled
                              ? 'danger'
                              : 'neutral'
                        }
                      >
                        {pkg.status}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                      {/*
                        The insurance document: every session date with the amounts
                        billed against them. Available mid-course too, stamped
                        PROVISIONAL so it cannot pass as a final claim.
                      */}
                      <DocumentActions
                        label="Statement"
                        patientName={patient.full_name}
                        fetchPdf={() => billingService.statementPdf(pkg.id)}
                        send={(payload) => billingService.sendStatement(pkg.id, payload)}
                      />
                      {pkg.status === 'ACTIVE' && (
                        <>
                          {/* Referrer credits — any package */}
                          {(data.referral_session_credits ?? 0) >= 2 && redeemingPackageId !== pkg.id && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setRedeemingReferredPackageId(null);
                                setRedeemingPackageId(pkg.id);
                              }}
                            >
                              <Icon name="gift" className="size-3" />
                              Referrer +2
                            </Button>
                          )}
                          {redeemingPackageId === pkg.id && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                loading={redeemBusy}
                                onClick={() => handleRedeemCredit(pkg.id)}
                              >
                                Confirm +2
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setRedeemingPackageId(null)}
                              >
                                ✕
                              </Button>
                            </div>
                          )}
                          {/* Referred-patient credits — only packages with ≥5 sessions */}
                          {(data.referred_session_credits ?? 0) >= 2 && pkg.sessions_registered >= 5 && redeemingReferredPackageId !== pkg.id && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setRedeemingPackageId(null);
                                setRedeemingReferredPackageId(pkg.id);
                              }}
                            >
                              <Icon name="gift" className="size-3" />
                              Referred +2
                            </Button>
                          )}
                          {redeemingReferredPackageId === pkg.id && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                loading={redeemBusy}
                                onClick={() => handleRedeemReferredCredit(pkg.id)}
                              >
                                Confirm +2
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setRedeemingReferredPackageId(null)}
                              >
                                ✕
                              </Button>
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingPackage(pkg)}
                          >
                            Edit
                          </Button>
                          <Link
                            to={`${basePath}/refunds/new?package_id=${pkg.id}`}
                            className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors bg-white text-ink-800 ring-1 ring-inset ring-ink-300 hover:bg-ink-50 px-2.5 py-1.5 text-xs min-h-[44px] sm:min-h-0"
                          >
                            Refund
                          </Link>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await sessionService.cancelPackage(pkg.id, 'Cancelled from profile');
                                await reloadAll();
                                setBanner({
                                  tone: 'success',
                                  message:
                                    "Package cancelled. Its sessions no longer count towards this patient's totals; the row is kept as history.",
                                });
                              } catch (err) {
                                setBanner({ tone: 'error', message: err.message });
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                      </div>
                    </Td>
                  </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Appointment history */}
        <Card>
          <CardHeader
            title="Appointment history"
            description="Every booking, reschedule and cancellation for this patient."
          />
          {data.appointments.length === 0 ? (
            <EmptyState
              title="No appointments"
              description="This patient has no appointment history yet."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Time</Th>
                  <Th>Clinic</Th>
                  <Th>Reference</Th>
                  <Th>Complaint</Th>
                  <Th align="right">Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {data.appointments.map((appointment) => (
                  <tr key={appointment.id} className="hover:bg-ink-50/60">
                    <Td className="font-medium text-ink-900">
                      {formatDate(appointment.appointment_date)}
                    </Td>
                    <Td className="numeric">{formatTime(appointment.start_time)}</Td>
                    <Td>{appointment.clinic_name ?? '—'}</Td>
                    <Td>
                      <span className="numeric text-xs text-ink-500">
                        {appointment.appointment_code}
                      </span>
                    </Td>
                    <Td>{appointment.chief_complaint ?? '—'}</Td>
                    <Td align="right">
                      <Badge tone={APPOINTMENT_TONES[appointment.status] ?? 'neutral'}>
                        {appointment.status}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Session history */}
        <Card>
          <CardHeader
            title="Session history"
            description="Physiotherapy sessions delivered. A wrong entry is voided, never deleted."
            action={
              patient.is_active && (
                <Button size="sm" variant="secondary" onClick={() => setLoggingSession(true)}>
                  Log session
                </Button>
              )
            }
          />
          {data.sessions.length === 0 ? (
            <EmptyState
              title="No sessions recorded"
              description="Log a session here, or complete one of this patient's appointments."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th align="right">#</Th>
                  <Th>Date</Th>
                  <Th>Therapist</Th>
                  <Th>Treatment</Th>
                  <Th>Notes</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {data.sessions.map((session) => (
                  <tr key={session.id} className={session.is_voided ? 'text-ink-400' : 'hover:bg-ink-50/60'}>
                    <Td align="right" className="font-medium text-ink-900">
                      {session.session_number}
                    </Td>
                    <Td>{formatDate(session.session_date)}</Td>
                    <Td>{session.therapist_name ?? '—'}</Td>
                    <Td>{session.treatment_provided ?? '—'}</Td>
                    <Td className="text-ink-600">{session.notes ?? '—'}</Td>
                    <Td align="right">
                      {!session.is_voided && patient.is_active && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingSession(session)}
                        >
                          Edit
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Billing */}
        <Card>
          <CardHeader
            title="Billing"
            description="Bills and payments. Anything charged here is separate from the package — it does not use up a session."
            action={
              patient.is_active && (
                <Button size="sm" variant="secondary" onClick={() => setAddingCharge(true)}>
                  Add a charge
                </Button>
              )
            }
          />
          {billsLoading ? (
            <div className="grid place-items-center py-10 text-brand-600">
              <Spinner />
            </div>
          ) : (bills ?? []).length === 0 ? (
            <EmptyState
              title="No bills"
              description="Nothing has been billed to this patient. Registering a package or adding a charge creates one."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Bill</Th>
                  <Th>Date</Th>
                  <Th>Clinic</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Paid</Th>
                  <Th align="right">Balance</Th>
                  <Th align="right">Status</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {(bills ?? []).map((bill) => (
                  <Fragment key={bill.id}>
                    <tr className="hover:bg-ink-50/60">
                      <Td className="numeric font-medium text-ink-900">
                        <button
                          type="button"
                          className="underline decoration-dotted underline-offset-2"
                          onClick={() =>
                            setOpenBillId((current) => (current === bill.id ? null : bill.id))
                          }
                          aria-expanded={openBillId === bill.id}
                        >
                          {bill.bill_number}
                        </button>
                      </Td>
                      <Td>{formatDate(bill.bill_date)}</Td>
                      <Td>{bill.clinic_name ?? '—'}</Td>
                      <Td align="right" className="numeric">
                        {formatMoney(bill.total_amount)}
                      </Td>
                      <Td align="right" className="numeric">
                        {formatMoney(bill.amount_paid)}
                      </Td>
                      <Td align="right" className="numeric">
                        {Number(bill.balance_amount) > 0 ? (
                          <span className="font-medium text-amber-700">
                            {formatMoney(bill.balance_amount)}
                          </span>
                        ) : (
                          formatMoney(0)
                        )}
                      </Td>
                      <Td align="right">
                        <Badge tone={PAYMENT_TONES[bill.payment_status] ?? 'neutral'}>
                          {bill.payment_status}
                        </Badge>
                      </Td>
                      <Td align="right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <DocumentActions
                            label="Invoice"
                            patientName={patient.full_name}
                            fetchPdf={() => billingService.invoicePdf(bill.id)}
                            send={(payload) => billingService.sendInvoice(bill.id, payload)}
                          />
                          {patient.is_active && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setEditingBill(bill)}
                            >
                              Edit
                            </Button>
                          )}
                          {Number(bill.balance_amount) > 0 && patient.is_active && (
                            <Button size="sm" onClick={() => setPayingBill(bill)}>
                              Record payment
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>

                    {openBillId === bill.id && (
                      <tr>
                        <Td className="bg-ink-50/60" colSpan={8}>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-600">
                                Charges
                              </p>
                              <ul className="space-y-1 text-sm">
                                {bill.items.map((item) => (
                                  <li key={item.id} className="flex justify-between gap-4">
                                    <span className="text-ink-700">
                                      {item.description}
                                      {item.quantity > 1 && (
                                        <span className="text-ink-500">
                                          {' '}
                                          × {item.quantity} @ {formatMoney(item.unit_price)}
                                        </span>
                                      )}
                                    </span>
                                    <span className="numeric shrink-0">
                                      {formatMoney(item.amount)}
                                    </span>
                                  </li>
                                ))}
                                {Number(bill.discount_amount) > 0 && (
                                  <li className="flex justify-between gap-4 text-emerald-700">
                                    <span>Discount</span>
                                    <span className="numeric">
                                      −{formatMoney(bill.discount_amount)}
                                    </span>
                                  </li>
                                )}
                              </ul>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-600">
                                Payments
                              </p>
                              {bill.payments.length === 0 ? (
                                <p className="text-sm text-ink-500">Nothing received yet.</p>
                              ) : (
                                <ul className="space-y-1 text-sm">
                                  {bill.payments.map((payment) => (
                                    <li
                                      key={payment.id}
                                      className="flex flex-wrap items-center justify-between gap-2"
                                    >
                                      <span className="text-ink-700">
                                        {formatDate(payment.payment_date)} ·{' '}
                                        {payment.payment_method.replace('_', ' ').toLowerCase()}
                                        {payment.reference_number && (
                                          <span className="numeric text-ink-500">
                                            {' '}
                                            · {payment.reference_number}
                                          </span>
                                        )}
                                      </span>
                                      <span className="flex items-center gap-2">
                                        <span className="numeric shrink-0 font-medium">
                                          {formatMoney(payment.amount)}
                                        </span>
                                        <DocumentActions
                                          label="Receipt"
                                          patientName={patient.full_name}
                                          fetchPdf={() => billingService.receiptPdf(payment.id)}
                                          send={(payload) =>
                                            billingService.sendReceipt(payment.id, payload)
                                          }
                                        />
                                        {patient.is_active && (
                                          <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => setEditingPayment(payment)}
                                          >
                                            Edit
                                          </Button>
                                        )}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {bill.notes && (
                                <p className="mt-2 text-xs text-ink-500">{bill.notes}</p>
                              )}
                            </div>
                          </div>
                        </Td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Prescriptions */}
        <Card>
          <CardHeader
            title="Prescriptions"
            description="Clinical prescriptions — downloadable as PDF or emailed to the patient."
          />
          <PrescriptionList
            prescriptions={prescriptions ?? []}
            loading={prescriptionsLoading}
            onNew={() => setAddingPrescription(true)}
          />
        </Card>
      </div>

      <SessionForm
        open={loggingSession}
        patientId={patient.id}
        title={`Record session — ${patient.full_name}`}
        onClose={() => setLoggingSession(false)}
        onSaved={async (result) => {
          setLoggingSession(false);
          setBanner({
            tone: 'success',
            message: [
              `Session ${result.session.session_number} recorded.`,
              result.package
                ? `${result.package.sessions_remaining} of ${result.package.sessions_registered} remaining.`
                : 'Logged without consuming a package.',
              ...(result.warnings ?? []),
            ].join(' '),
          });
          await reloadAll();
        }}
      />

      <PackageForm
        open={addingPackage}
        patientId={patient.id}
        clinics={clinics}
        defaultClinicId={patient.primary_clinic_id}
        onClose={() => setAddingPackage(false)}
        onSaved={async (created) => {
          setAddingPackage(false);
          setBanner({
            tone: 'success',
            message: [
              `Registered ${created.sessions_registered} sessions at ${formatMoney(
                created.price_per_session,
              )} each.`,
              created.bill
                ? `Bill ${created.bill.bill_number} for ${formatMoney(
                    created.bill.total_amount,
                  )}${
                    Number(created.bill.balance_amount) > 0
                      ? ` — ${formatMoney(created.bill.balance_amount)} outstanding.`
                      : ', paid in full.'
                  }`
                : null,
            ]
              .filter(Boolean)
              .join(' '),
          });
          await reloadAll();
        }}
      />

      <ChargeForm
        open={addingCharge}
        patientId={patient.id}
        patientName={patient.full_name}
        clinics={clinics}
        defaultClinicId={patient.primary_clinic_id}
        onClose={() => setAddingCharge(false)}
        onSaved={async (bill) => {
          setAddingCharge(false);
          setBanner({
            tone: 'success',
            message: `Bill ${bill.bill_number} raised for ${formatMoney(bill.total_amount)}${
              Number(bill.balance_amount) > 0
                ? ` — ${formatMoney(bill.balance_amount)} outstanding.`
                : ', paid in full.'
            } No package session was used.`,
          });
          await Promise.all([reloadAll(), reloadPoints()]);
        }}
      />

      <RecordPaymentForm
        open={Boolean(payingBill)}
        bill={payingBill}
        patientPoints={pointsData?.balance ?? 0}
        pointsRedeemValue={pointsData?.redeem_value ?? 0.5}
        onClose={() => setPayingBill(null)}
        onSaved={async (bill) => {
          setPayingBill(null);
          setBanner({
            tone: 'success',
            message: `Payment recorded on ${bill.bill_number}. ${
              Number(bill.balance_amount) > 0
                ? `${formatMoney(bill.balance_amount)} still outstanding.`
                : 'Paid in full.'
            }`,
          });
          await Promise.all([reloadAll(), reloadPoints()]);
        }}
      />

      <PrescriptionForm
        open={addingPrescription}
        patient={patient}
        clinicId={patient.primary_clinic_id ?? clinics?.[0]?.id ?? null}
        onClose={() => setAddingPrescription(false)}
        onCreated={() => reloadPrescriptions()}
        onPatientUpdated={() => reload()}
      />

      <SessionEditModal
        open={Boolean(editingSession)}
        session={editingSession}
        therapists={sessionCtx?.therapists ?? []}
        onClose={() => setEditingSession(null)}
        onSaved={async () => {
          setEditingSession(null);
          setBanner({ tone: 'success', message: 'Session updated.' });
          await reload();
        }}
      />

      <BillEditModal
        open={Boolean(editingBill)}
        bill={editingBill}
        onClose={() => setEditingBill(null)}
        onSaved={async () => {
          setEditingBill(null);
          setBanner({ tone: 'success', message: 'Bill updated.' });
          await reloadBills();
        }}
      />

      <PaymentEditModal
        open={Boolean(editingPayment)}
        payment={editingPayment}
        onClose={() => setEditingPayment(null)}
        onSaved={async () => {
          setEditingPayment(null);
          setBanner({ tone: 'success', message: 'Payment updated.' });
          await reloadBills();
        }}
      />

      <PackageEditModal
        open={Boolean(editingPackage)}
        pkg={editingPackage}
        onClose={() => setEditingPackage(null)}
        onSaved={async () => {
          setEditingPackage(null);
          setBanner({ tone: 'success', message: 'Package updated.' });
          await reloadAll();
        }}
      />

      <div className="mt-6 flex justify-center">
        <Link
          to={`${basePath}/patients`}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-ink-700 ring-1 ring-inset ring-ink-300 hover:bg-ink-50"
        >
          <Icon name="users" className="size-4" />
          Back to all patients
        </Link>
      </div>
    </>
  );
}
