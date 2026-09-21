/**
 * Floating alert for unacknowledged notifications (Section 15).
 *
 * Deliberately **non-blocking**. It sits in the bottom-right corner and never
 * takes focus, so a half-filled patient form or a session note being typed
 * underneath is unaffected. A modal that appears unpredictably under the
 * cursor is how you get the accidental-click class of bug this app already had
 * to fix once on appointment completion; routine bookings do not justify
 * freezing someone's work.
 *
 * One card summarising everything outstanding, showing the newest in detail:
 * that is what makes it useful at a glance without growing a stack of cards
 * down the corner on a busy morning.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '../Icon';
import { Badge, Button } from '../ui';

const ACCENTS = {
  NEW_APPOINTMENT: 'border-l-emerald-500',
  RESCHEDULED_APPOINTMENT: 'border-l-amber-500',
  CANCELLED_APPOINTMENT: 'border-l-red-500',
};

const TONES = {
  NEW_APPOINTMENT: 'success',
  RESCHEDULED_APPOINTMENT: 'warning',
  CANCELLED_APPOINTMENT: 'danger',
};

export function NotificationToast({
  unread,
  latest,
  alarmActive,
  soundBlocked,
  onAcknowledgeAll,
  onSilence,
  onEnableSound,
  to,
}) {
  const [busy, setBusy] = useState(false);
  // Hidden for *this* batch only. A new arrival raises the id and brings the
  // card back, so dismissing can never hide something that arrives later.
  const [hiddenFor, setHiddenFor] = useState(0);

  const latestId = latest?.id ?? 0;

  if (!latest || unread <= 0 || latestId <= hiddenFor) return null;

  const others = unread - 1;
  const detail = [latest.date, latest.time].filter(Boolean).join(' · ');

  async function acknowledgeAll() {
    setBusy(true);
    try {
      await onAcknowledgeAll?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      // Above the modal layer (z-50) so it stays visible, but anchored in a
      // corner where it does not cover a centred dialog's content.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-end p-4 sm:p-6"
      role="status"
      aria-live="polite"
    >
      <div
        className={[
          'pointer-events-auto w-full max-w-sm rounded-xl border-l-4 bg-white shadow-2xl',
          'ring-1 ring-ink-900/10 motion-safe:animate-[fadeIn_.2s_ease-out]',
          ACCENTS[latest.notification_type] ?? 'border-l-brand-500',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-3">
          <div className="flex items-center gap-2">
            <Badge tone={TONES[latest.notification_type] ?? 'brand'}>{latest.title}</Badge>
            {alarmActive && (
              <span className="flex size-2 rounded-full bg-red-500 motion-safe:animate-ping" />
            )}
          </div>
          <button
            type="button"
            onClick={() => setHiddenFor(latestId)}
            className="-mr-1 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Hide this alert"
            title="Hide until the next one arrives — this does not acknowledge it"
          >
            <Icon name="close" className="size-4" />
          </button>
        </div>

        <div className="px-4 pb-1 pt-2">
          <p className="truncate text-base font-semibold text-ink-900">
            {latest.patient_name ?? 'Appointment update'}
          </p>
          <p className="numeric mt-0.5 text-sm text-ink-600">{detail || '—'}</p>
          {latest.clinic_name && (
            <p className="text-xs text-ink-500">{latest.clinic_name}</p>
          )}
          {others > 0 && (
            <p className="mt-2 text-xs font-medium text-ink-700">
              +{others} more awaiting acknowledgement
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-2">
          <Button size="sm" loading={busy} onClick={acknowledgeAll}>
            {unread > 1 ? `Acknowledge all ${unread}` : 'Acknowledge'}
          </Button>
          <Link
            to={to}
            className="rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            View
          </Link>
          {soundBlocked ? (
            <button
              type="button"
              onClick={onEnableSound}
              className="ml-auto rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
            >
              Enable sound
            </button>
          ) : (
            alarmActive && (
              <button
                type="button"
                onClick={onSilence}
                className="ml-auto rounded-lg px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100"
              >
                Silence
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
