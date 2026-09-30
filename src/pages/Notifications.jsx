/**
 * Clinic notifications (Section 15).
 *
 * The card layout follows the spec's example literally — headline, patient,
 * time, clinic, Acknowledge — because that is what the person at the desk has
 * to read in one glance between phone calls.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '../components/Icon';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useNotifications } from '../hooks/useNotifications';
import { notificationService } from '../services';
import { formatDateTime } from '../utils/format';

const TONES = {
  NEW_APPOINTMENT: 'success',
  RESCHEDULED_APPOINTMENT: 'warning',
  CANCELLED_APPOINTMENT: 'danger',
  APPOINTMENT_REMINDER: 'info',
  BILL_GENERATED: 'brand',
  SYSTEM: 'neutral',
};

function NotificationCard({ notification, basePath, onAcknowledge, busy }) {
  const payload = notification.payload ?? {};
  const unread = !notification.is_acknowledged;

  return (
    <Card
      className={[
        'overflow-hidden transition-all',
        unread
          ? 'border-l-4 border-l-brand-500 shadow-sm'
          : 'border-l-4 border-l-emerald-400 opacity-80 hover:opacity-100',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          {/* Status row */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={TONES[notification.notification_type] ?? 'neutral'}>
              {notification.title}
            </Badge>

            {unread ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                <span className="size-1.5 rounded-full bg-brand-500 animate-pulse" />
                Unread
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <Icon name="check" className="size-3 stroke-[3]" />
                Acknowledged
                {notification.acknowledged_by?.length > 0 &&
                  ` by ${notification.acknowledged_by.join(', ')}`}
              </span>
            )}

            <span className="text-xs text-ink-400">
              {formatDateTime(notification.created_at)}
            </span>
          </div>

          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {payload.patient_name && (
              <div className="flex gap-2">
                <dt className="text-ink-500">Patient</dt>
                <dd className="font-medium text-ink-900">{payload.patient_name}</dd>
              </div>
            )}
            {payload.time && (
              <div className="flex gap-2">
                <dt className="text-ink-500">Time</dt>
                <dd className="numeric font-medium text-ink-900">
                  {payload.date} · {payload.time}
                </dd>
              </div>
            )}
            {payload.clinic_name && (
              <div className="flex gap-2">
                <dt className="text-ink-500">Clinic</dt>
                <dd className="text-ink-800">{payload.clinic_name}</dd>
              </div>
            )}
            {payload.booked_by && (
              <div className="flex gap-2">
                <dt className="text-ink-500">By</dt>
                <dd className="text-ink-800">{payload.booked_by}</dd>
              </div>
            )}
            {payload.reason && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-ink-500">Reason</dt>
                <dd className="text-ink-800">{payload.reason}</dd>
              </div>
            )}
          </dl>

          {payload.appointment_code && (
            <Link
              to={`${basePath}/appointments`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
            >
              <Icon name="calendar" className="size-3.5" />
              {payload.appointment_code}
            </Link>
          )}
        </div>

        {/* Acknowledge action — shown only for unread */}
        {unread && (
          <Button size="sm" loading={busy} onClick={() => onAcknowledge(notification)}>
            <Icon name="check" className="size-3.5 stroke-[3]" />
            Acknowledge
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function Notifications() {
  const { role } = useAuth();
  const basePath =
    role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [banner, setBanner] = useState(null);

  const {
    soundEnabled,
    soundBlocked,
    alarmActive,
    setSound,
    unlockSound,
    silence,
    alertsEnabled,
    refresh,
    pushSupported,
    pushEnabled,
    pushLoading,
    enablePush,
    disablePush,
    checkPushStatus,
  } = useNotifications({ enabled: role === 'CLINIC_USER' });

  const [pushError, setPushError] = useState(null);

  useEffect(() => {
    checkPushStatus();
  }, [checkPushStatus]);

  const { data, loading, error, reload } = useApi(
    () => notificationService.list({ unacknowledged_only: unreadOnly, page_size: 50 }),
    [unreadOnly],
  );

  const items = data?.items ?? [];
  const unread = items.filter((item) => !item.is_acknowledged).length;

  async function acknowledge(notification) {
    setBusyId(notification.id);
    setBanner(null);
    try {
      await notificationService.acknowledge(notification.id);
      await Promise.all([reload(), refresh()]);
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setBusyId(null);
    }
  }

  async function acknowledgeAll() {
    setBusyId('all');
    setBanner(null);
    try {
      const result = await notificationService.acknowledgeAll();
      await Promise.all([reload(), refresh()]);
      setBanner({ tone: 'success', message: result.message });
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description={
          role === 'CLINIC_USER'
            ? 'Appointments booked, moved or cancelled for your clinic by someone else.'
            : 'Chain-wide feed of appointment changes, for oversight.'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setUnreadOnly((value) => !value)}
            >
              {unreadOnly ? 'Show all' : 'Unread only'}
            </Button>
            {unread > 0 && (
              <Button size="sm" loading={busyId === 'all'} onClick={acknowledgeAll}>
                Acknowledge all
              </Button>
            )}
          </div>
        }
      />

      {banner && (
        <div className="mb-4">
          <Alert tone={banner.tone} onDismiss={() => setBanner(null)}>
            {banner.message}
          </Alert>
        </div>
      )}

      {/*
        The browser will not let a page play sound until someone has interacted
        with it, so a reception screen opened and left alone stays silent. Rather
        than let staff wonder why, say so and offer the one click that fixes it.
      */}
      {alertsEnabled && soundBlocked && (
        <div className="mb-4">
          <Alert tone="warning" title="Sound alerts are blocked by this browser">
            New appointments will still appear here, but they will not chime until you
            allow audio on this tab.{' '}
            <button
              type="button"
              onClick={unlockSound}
              className="font-medium underline underline-offset-2"
            >
              Enable sound
            </button>
          </Alert>
        </div>
      )}

      {alertsEnabled && !soundBlocked && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <Icon name="bell" className="size-4" />
          <span>
            Sound alert is {soundEnabled ? 'on' : 'off'} for this browser
            {soundEnabled && ' — it repeats until something is acknowledged'}.
          </span>
          <button
            type="button"
            onClick={() => (soundEnabled ? setSound(false) : unlockSound())}
            className="font-medium text-brand-700 underline underline-offset-2"
          >
            Turn {soundEnabled ? 'off' : 'on'}
          </button>
          {/* Hearing it should not require booking a real appointment. */}
          <button
            type="button"
            onClick={unlockSound}
            className="font-medium text-brand-700 underline underline-offset-2"
          >
            Test sound
          </button>
          {alarmActive && (
            <button
              type="button"
              onClick={silence}
              className="rounded-md bg-red-600 px-2 py-0.5 font-semibold text-white hover:bg-red-700"
            >
              Silence now
            </button>
          )}
        </div>
      )}

      {/* Push notification controls — shown only when the browser supports it */}
      {alertsEnabled && pushSupported && (
        <div className="mb-4 rounded-lg border border-ink-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-900">
                Push notifications
                {pushEnabled && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    <Icon name="check" className="size-3 stroke-[3]" />
                    Active on this device
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                {pushEnabled
                  ? 'You will receive notifications even when this tab is in the background or the screen is locked.'
                  : 'Get notified when appointments are booked or changed — even when this tab is closed or your screen is locked.'}
              </p>
              {pushError && (
                <p className="mt-1 text-xs text-red-600">{pushError}</p>
              )}
            </div>
            <div className="shrink-0">
              {pushEnabled ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={pushLoading}
                  onClick={async () => {
                    setPushError(null);
                    try { await disablePush(); } catch (err) { setPushError(err.message); }
                  }}
                >
                  Disable
                </Button>
              ) : (
                <Button
                  size="sm"
                  loading={pushLoading}
                  onClick={async () => {
                    setPushError(null);
                    try {
                      const result = await enablePush();
                      if (result === 'denied') setPushError('Notification permission denied. Allow it in your browser settings.');
                      if (result === 'not_configured') setPushError('Push notifications are not configured on this server yet.');
                    } catch (err) {
                      setPushError(err.message);
                    }
                  }}
                >
                  Enable push notifications
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <Alert tone="error" title="Could not load notifications">
          {error.message}
        </Alert>
      )}

      {loading ? (
        <Card className="grid place-items-center py-16 text-brand-600">
          <Spinner size="lg" />
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon="✓"
          title={unreadOnly ? 'Nothing unread' : 'No notifications'}
          description={
            unreadOnly
              ? 'Everything has been acknowledged.'
              : 'Appointments booked for your clinic by an Admin will appear here.'
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              basePath={basePath}
              busy={busyId === notification.id}
              onAcknowledge={acknowledge}
            />
          ))}
        </div>
      )}
    </>
  );
}
