/**
 * Register a new referral.
 *
 * Opened from two places:
 *   1. A referred patient's profile → ?referred_patient_id=X  (referred patient pre-filled)
 *   2. The Referrals list → "New referral" button (both patients blank)
 *
 * Flow:
 *   - Staff selects (or confirms) the referred patient
 *   - Staff picks which of that patient's packages is the qualifying purchase
 *   - Staff finds the referrer patient by name / mobile number
 *   - Staff sets credit sessions (default 1) and optional notes
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Icon } from '../../components/Icon';
import { PatientPicker } from '../../components/patient/PatientPicker';
import {
  Alert,
  Button,
  Card,
  PageHeader,
  Spinner,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { patientService, referralService, sessionService } from '../../services';
import { formatMoney } from '../../utils/format';

export default function ReferralForm() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledReferredId = searchParams.get('referred_patient_id');

  const basePath =
    role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';

  // ── State ─────────────────────────────────────────────────────────────────
  const [referredPatient, setReferredPatient] = useState(null);
  const [referrerPatient, setReferrerPatient] = useState(null);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const creditSessions = 2;
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingPrefill, setLoadingPrefill] = useState(false);

  // Packages belonging to the referred patient
  const { data: packagesData, loading: loadingPkgs } = useApi(
    () =>
      referredPatient
        ? sessionService.packages(referredPatient.id, { status: 'ACTIVE' })
        : null,
    [referredPatient?.id],
  );

  const packages = Array.isArray(packagesData) ? packagesData : (packagesData?.items ?? []);
  const activePackages = packages.filter((p) => p.status === 'ACTIVE');

  // Pre-fill the referred patient when arriving from a profile link
  useEffect(() => {
    if (!prefilledReferredId || referredPatient) return;
    setLoadingPrefill(true);
    patientService
      .get(prefilledReferredId)
      .then(setReferredPatient)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingPrefill(false));
  }, [prefilledReferredId]);

  // Auto-select the only active package when there's exactly one
  useEffect(() => {
    if (activePackages.length === 1) {
      setSelectedPackageId(String(activePackages[0].id));
    }
  }, [activePackages.length]);

  const canSubmit =
    referredPatient &&
    referrerPatient &&
    selectedPackageId &&
    referredPatient.id !== referrerPatient.id;

  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    try {
      const result = await referralService.create({
        referred_patient_id: referredPatient.id,
        referrer_patient_id: referrerPatient.id,
        referred_package_id: Number(selectedPackageId),
        credit_sessions: creditSessions,
        notes: notes.trim() || undefined,
      });
      navigate(`${basePath}/referrals/${result.id}`);
    } catch (err) {
      setError(err.message ?? 'Failed to register referral');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingPrefill) {
    return (
      <div className="flex justify-center py-16"><Spinner /></div>
    );
  }

  return (
    <>
      <PageHeader
        title="Register referral"
        description="Link the referring patient to the new patient's qualifying package."
      />

      <div className="max-w-2xl space-y-4">
        {error && (
          <Alert tone="danger" onDismiss={() => setError('')}>{error}</Alert>
        )}

        {/* ── Step 1: Referred patient (the new/incoming patient) ──────────── */}
        <Card>
          <div className="border-b border-ink-100 px-5 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-600">
              1. Referred patient
              <span className="ml-2 text-xs normal-case font-normal text-ink-400">
                — the patient who came in through the referral
              </span>
            </h3>
          </div>
          <div className="px-5 py-4">
            {referredPatient ? (
              <div className="flex items-center justify-between rounded-lg bg-ink-50 px-4 py-3">
                <div>
                  <div className="font-medium text-ink-900">{referredPatient.full_name}</div>
                  <div className="text-xs text-ink-500">
                    {referredPatient.patient_code}
                    {referredPatient.mobile && ` · ${referredPatient.mobile}`}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setReferredPatient(null);
                    setSelectedPackageId('');
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <PatientPicker onSelect={setReferredPatient} />
            )}
          </div>
        </Card>

        {/* ── Step 2: Qualifying package ────────────────────────────────────── */}
        {referredPatient && (
          <Card>
            <div className="border-b border-ink-100 px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-600">
                2. Qualifying package
                <span className="ml-2 text-xs normal-case font-normal text-ink-400">
                  — the package that triggered the referral credit
                </span>
              </h3>
            </div>
            <div className="px-5 py-4">
              {loadingPkgs ? (
                <div className="flex justify-center py-4"><Spinner /></div>
              ) : activePackages.length === 0 ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  This patient has no active packages. A package must be active (not cancelled or
                  refunded) for a referral credit to be registered.
                </div>
              ) : (
                <div className="space-y-2">
                  {activePackages.map((pkg) => {
                    const label =
                      pkg.package_name ?? `${pkg.sessions_registered}-session package`;
                    const sub = [
                      `${pkg.sessions_remaining} sessions remaining`,
                      pkg.price_per_session ? formatMoney(pkg.price_per_session) + '/session' : null,
                      pkg.clinic_name,
                    ]
                      .filter(Boolean)
                      .join(' · ');

                    return (
                      <label
                        key={pkg.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                          selectedPackageId === String(pkg.id)
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-ink-200 hover:bg-ink-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="package"
                          value={pkg.id}
                          checked={selectedPackageId === String(pkg.id)}
                          onChange={() => setSelectedPackageId(String(pkg.id))}
                          className="mt-0.5 accent-brand-600"
                        />
                        <div>
                          <div className="text-sm font-medium text-ink-900">{label}</div>
                          <div className="text-xs text-ink-500">{sub}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── Step 3: Referrer patient (who made the referral) ─────────────── */}
        {referredPatient && selectedPackageId && (
          <Card>
            <div className="border-b border-ink-100 px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-600">
                3. Referrer patient
                <span className="ml-2 text-xs normal-case font-normal text-ink-400">
                  — search by name, mobile number, or Patient ID
                </span>
              </h3>
            </div>
            <div className="px-5 py-4">
              {referrerPatient ? (
                <>
                  <div className="flex items-center justify-between rounded-lg bg-ink-50 px-4 py-3">
                    <div>
                      <div className="font-medium text-ink-900">{referrerPatient.full_name}</div>
                      <div className="text-xs text-ink-500">
                        {referrerPatient.patient_code}
                        {referrerPatient.mobile && ` · ${referrerPatient.mobile}`}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setReferrerPatient(null)}
                    >
                      Change
                    </Button>
                  </div>
                  {referrerPatient.id === referredPatient.id && (
                    <p className="mt-2 text-xs text-red-600">
                      A patient cannot refer themselves. Choose a different patient.
                    </p>
                  )}
                </>
              ) : (
                <PatientPicker onSelect={setReferrerPatient} />
              )}
            </div>
          </Card>
        )}

        {/* ── Step 4: Confirm ──────────────────────────────────────────────── */}
        {referredPatient && selectedPackageId && referrerPatient && (
          <Card>
            <div className="border-b border-ink-100 px-5 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-600">
                4. Confirm referral
              </h3>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Summary */}
              <div className="rounded-lg bg-brand-50 border border-brand-200 px-4 py-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-ink-600">Referred by</span>
                  <span className="font-medium">{referrerPatient.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-600">New patient</span>
                  <span className="font-medium">{referredPatient.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-600">Sessions credit</span>
                  <span className="font-semibold text-brand-700">2 sessions each</span>
                </div>
                <p className="text-xs text-ink-500 pt-1 border-t border-brand-100 mt-2">
                  Both patients receive 2 session credits once confirmed from the referral
                  detail page. The referred patient&apos;s credits require a package of at
                  least 5 sessions to redeem.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700">
                  Notes (optional)
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Any additional context for this referral…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
                  <Icon name="check" className="mr-1 size-4" />
                  Register referral
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
