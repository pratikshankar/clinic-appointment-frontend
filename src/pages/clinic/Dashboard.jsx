import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Alert, Badge, Button, Card, CardHeader, PageHeader } from '../../components/ui';
import { DashboardContent } from '../../components/DashboardContent';
import { Icon } from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { dashboardService, notificationService } from '../../services';

const TONES = {
  NEW_APPOINTMENT: 'success',
  RESCHEDULED_APPOINTMENT: 'warning',
  CANCELLED_APPOINTMENT: 'danger',
};

const TILES = [
  { key: 'appointments_today', label: "Today's appointments", tone: 'brand' },
  { key: 'pending_today', label: 'Still to come today' },
  { key: 'checked_in_now', label: 'Checked in', tone: 'warning' },
  { key: 'completed_today', label: 'Completed today', tone: 'positive' },
  { key: 'upcoming_appointments', label: 'Upcoming appointments' },
  { key: 'sessions_completed_today', label: 'Sessions logged today' },
  { key: 'total_patients', label: 'Patients at your clinic' },
  {
    key: 'unacknowledged_notifications',
    label: 'Unacknowledged alerts',
    tone: 'danger',
    hint: 'Appointments booked for you by an Admin',
  },
];

export default function ClinicDashboard() {
  const { clinics } = useAuth();
  const { data, loading, error, reload } = useApi(() => dashboardService.summary(), []);
  const clinicName = clinics[0]?.clinic_name;

  return (
    <>
      <PageHeader
        title={clinicName ? `${clinicName} dashboard` : 'Clinic dashboard'}
        description="Today's activity for your clinic."
        action={
          <Button variant="secondary" onClick={reload} loading={loading}>
            <Icon name="refresh" className="size-4" />
            Refresh
          </Button>
        }
      />

      {!clinics.length && (
        <div className="mb-6">
          <Alert tone="warning" title="No clinic assigned">
            Your account is not linked to a clinic yet, so there is nothing to show. Ask your
            Superadmin to assign you to one.
          </Alert>
        </div>
      )}

      <DashboardContent summary={data} loading={loading} error={error} tiles={TILES} />

      {/*
        Section 22 lists "new appointment notifications" on this dashboard, not
        only on the notifications page -- the point is that someone who never
        leaves the dashboard still sees what was booked for them.
      */}
      <div className="mt-6">
        <PendingNotifications onChange={reload} />
      </div>
    </>
  );
}

/** Unacknowledged alerts, acknowledgeable without leaving the dashboard. */
function PendingNotifications({ onChange }) {
  const [busyId, setBusyId] = useState(null);
  const { data, loading, reload } = useApi(
    () => notificationService.list({ unacknowledged_only: true, page_size: 5 }),
    [],
  );
  const items = data?.items ?? [];

  async function acknowledge(id) {
    setBusyId(id);
    try {
      await notificationService.acknowledge(id);
      await Promise.all([reload(), onChange?.()]);
    } finally {
      setBusyId(null);
    }
  }

  if (loading || items.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Needs acknowledgement"
        description="Booked, moved or cancelled for your clinic by someone else."
        action={
          <Link
            to="/clinic/notifications"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            View all
          </Link>
        }
      />
      <ul className="divide-y divide-ink-100">
        {items.map((item) => {
          const payload = item.payload ?? {};
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={TONES[item.notification_type] ?? 'neutral'}>
                    {item.title}
                  </Badge>
                  <span className="text-sm font-medium text-ink-900">
                    {payload.patient_name ?? '—'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">
                  {payload.date} · {payload.time}
                  {payload.booked_by ? ` · by ${payload.booked_by}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                loading={busyId === item.id}
                onClick={() => acknowledge(item.id)}
              >
                Acknowledge
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
