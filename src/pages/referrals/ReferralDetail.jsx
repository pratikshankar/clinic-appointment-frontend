import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Icon } from '../../components/Icon';
import {
  Alert,
  Badge,
  Button,
  Card,
  PageHeader,
  Spinner,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { referralService } from '../../services';
import { formatDate } from '../../utils/format';

const STATUS_TONES = {
  PENDING: 'warning',
  CREDITED: 'success',
  VOIDED: 'danger',
};

const STATUS_LABELS = {
  PENDING: 'Pending — credit not yet applied',
  CREDITED: 'Credited to patient balance',
  VOIDED: 'Voided — package was cancelled or refunded',
};

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between border-b border-ink-100 py-2 text-sm last:border-0">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-800 max-w-[60%]">{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <Card className="mb-4">
      <div className="border-b border-ink-100 px-5 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-600">{title}</h3>
      </div>
      <div className="px-5 py-3">{children}</div>
    </Card>
  );
}

export default function ReferralDetail() {
  const { role } = useAuth();
  const { referralId } = useParams();

  const basePath =
    role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';

  const { data: referral, loading, error, reload } = useApi(
    () => referralService.get(referralId),
    [referralId],
  );

  const [applying, setApplying] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  async function handleApplyCredit() {
    setActionError('');
    setApplying(true);
    try {
      await referralService.applyCredit(referralId, {});
      setActionSuccess(
        `${referral.credit_sessions} session credit(s) added to referrer's balance. ` +
        'Staff can redeem them from the patient profile when registering a future package.'
      );
      reload();
    } catch (err) {
      setActionError(err.message ?? 'Failed to apply credit');
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error.message}
      </div>
    );
  }
  if (!referral) return null;

  const isPending = referral.status === 'PENDING';

  return (
    <>
      <PageHeader
        title={`Referral #${referral.id}`}
        description={
          referral.referrer_patient_name
            ? `${referral.referrer_patient_name} referred ${referral.referred_patient_name ?? '—'}`
            : ''
        }
        action={
          <div className="flex gap-2">
            <Link
              to={`${basePath}/referrals`}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-ink-800 ring-1 ring-inset ring-ink-300 hover:bg-ink-50"
            >
              <Icon name="chevron-left" className="size-4" />
              All referrals
            </Link>
            <Button variant="secondary" onClick={reload}>
              <Icon name="refresh" className="size-4" />
            </Button>
          </div>
        }
      />

      {actionSuccess && (
        <Alert tone="success" onDismiss={() => setActionSuccess('')} className="mb-4">
          {actionSuccess}
        </Alert>
      )}
      {actionError && (
        <Alert tone="danger" onDismiss={() => setActionError('')} className="mb-4">
          {actionError}
        </Alert>
      )}

      <div className="max-w-2xl">
        <Section title="Status">
          <div className="flex items-center gap-3 py-1">
            <Badge tone={STATUS_TONES[referral.status]}>
              {STATUS_LABELS[referral.status]}
            </Badge>
          </div>
          {referral.status === 'VOIDED' && referral.voided_reason && (
            <p className="mt-2 text-sm text-red-600">{referral.voided_reason}</p>
          )}
        </Section>

        <Section title="Patients">
          <InfoRow
            label="Referrer (earns credit)"
            value={
              <Link
                to={`${basePath}/patients/${referral.referrer_patient_id}`}
                className="text-brand-600 hover:underline"
              >
                {referral.referrer_patient_name}
                {referral.referrer_patient_code && (
                  <span className="ml-1 text-xs text-ink-500">
                    ({referral.referrer_patient_code})
                  </span>
                )}
              </Link>
            }
          />
          <InfoRow
            label="Referred patient"
            value={
              <Link
                to={`${basePath}/patients/${referral.referred_patient_id}`}
                className="text-brand-600 hover:underline"
              >
                {referral.referred_patient_name}
                {referral.referred_patient_code && (
                  <span className="ml-1 text-xs text-ink-500">
                    ({referral.referred_patient_code})
                  </span>
                )}
              </Link>
            }
          />
          <InfoRow label="Clinic" value={referral.clinic_name} />
        </Section>

        <Section title="Credit details">
          <InfoRow
            label="Sessions to credit"
            value={`${referral.credit_sessions} session${referral.credit_sessions > 1 ? 's' : ''}`}
          />
          {referral.status === 'CREDITED' && (
            <>
              <InfoRow label="Credited by" value={referral.credited_by_name} />
              <InfoRow label="Credited on" value={formatDate(referral.credited_at)} />
              <div className="mt-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                Sessions added to referrer&apos;s credit balance — redeemable from their
                patient profile when registering a future package.
              </div>
            </>
          )}
          {referral.notes && (
            <div className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
              {referral.notes}
            </div>
          )}
        </Section>

        <Section title="Registration">
          <InfoRow label="Registered by" value={referral.initiated_by_name} />
          <InfoRow label="Registered on" value={formatDate(referral.created_at)} />
          <InfoRow
            label="Qualifying package"
            value={`Package #${referral.referred_package_id}`}
          />
        </Section>

        {/* ── Confirm credit panel (only when PENDING) ────────────────────── */}
        {isPending && (
          <Card className="mb-4 border-brand-200 bg-brand-50">
            <div className="px-5 py-4 space-y-3">
              <h3 className="font-semibold text-brand-800">Confirm referral credit</h3>
              <p className="text-sm text-ink-700">
                Clicking below adds{' '}
                <strong>
                  {referral.credit_sessions} session
                  {referral.credit_sessions > 1 ? 's' : ''}
                </strong>{' '}
                to <strong>{referral.referrer_patient_name}</strong>&apos;s credit balance.
                Staff can redeem the balance from the patient&apos;s profile when
                they register a future package — no active package is needed now.
              </p>
              <Button
                className="w-full"
                loading={applying}
                onClick={handleApplyCredit}
              >
                <Icon name="check" className="mr-1 size-4" />
                Confirm — add {referral.credit_sessions} session
                {referral.credit_sessions > 1 ? 's' : ''} to referrer&apos;s balance
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
