/**
 * Today's Activity — Admin / Superadmin only.
 *
 * Consolidated view of all patients who have an appointment or session today,
 * grouped one card per patient so the person running the centre can see at a
 * glance who is here, what stage they are at, and whether a session has been
 * logged.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '../components/Icon';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { appointmentService, clinicService, sessionService } from '../services';
import { formatDate, formatTime } from '../utils/format';

// Mirrors the status→tone map in AppointmentList so colours are consistent.
const STATUS_TONE = {
  SCHEDULED: 'neutral',
  CONFIRMED: 'brand',
  CHECKED_IN: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  RESCHEDULED: 'neutral',
  NO_SHOW: 'danger',
};

const STATUS_LABEL = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked in',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  RESCHEDULED: 'Rescheduled',
  NO_SHOW: 'No show',
};

// Statuses that represent an "active" patient (not cancelled / no-show).
const ACTIVE_STATUSES = new Set(['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED']);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Stat tile used in the summary bar. */
function StatTile({ label, value, tone = 'neutral' }) {
  const toneClasses = {
    neutral: 'bg-ink-50 text-ink-900',
    success: 'bg-emerald-50 text-emerald-800',
    brand: 'bg-brand-50 text-brand-800',
    warning: 'bg-amber-50 text-amber-800',
    danger: 'bg-red-50 text-red-800',
    info: 'bg-sky-50 text-sky-800',
  };
  return (
    <div className={`rounded-lg px-4 py-3 text-center ${toneClasses[tone] ?? toneClasses.neutral}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs font-medium">{label}</div>
    </div>
  );
}

/** One patient's combined row. */
function PatientActivityCard({ entry, basePath }) {
  const { patient, appointment, sessions } = entry;
  const appt = appointment;
  const session = sessions[0] ?? null; // most recently logged session today

  const profileLink = `${basePath}/patients/${patient.id}`;

  return (
    <Card className="overflow-hidden">
      {/* Patient header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {patient.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink-900 truncate">{patient.full_name}</span>
              <span className="text-xs text-ink-400">{patient.patient_code}</span>
            </div>
            {patient.mobile && (
              <p className="text-xs text-ink-500">{patient.mobile}</p>
            )}
          </div>
        </div>
        <Link
          to={profileLink}
          className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
        >
          <Icon name="user" className="size-3.5" />
          Profile
        </Link>
      </div>

      {/* Appointment + Session columns */}
      <div className="grid divide-y divide-ink-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {/* Appointment column */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Appointment
          </p>
          {appt ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONE[appt.status] ?? 'neutral'}>
                  {STATUS_LABEL[appt.status] ?? appt.status}
                </Badge>
                <span className="text-sm font-medium text-ink-800 tabular-nums">
                  {formatTime(appt.start_time)} – {formatTime(appt.end_time)}
                </span>
              </div>
              {appt.clinic_name && (
                <p className="text-xs text-ink-500">
                  <Icon name="building" className="mr-1 inline size-3.5 align-text-bottom" />
                  {appt.clinic_name}
                </p>
              )}
              {appt.chief_complaint && (
                <p className="text-xs text-ink-600 italic">"{appt.chief_complaint}"</p>
              )}
              <p className="text-xs text-ink-400">
                {appt.appointment_code}
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink-400 italic">Walk-in (no appointment)</p>
          )}
        </div>

        {/* Session column */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Session
          </p>
          {session ? (
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Logged
              </span>
              {session.therapist_name && (
                <p className="text-xs text-ink-600">
                  <Icon name="user" className="mr-1 inline size-3.5 align-text-bottom" />
                  {session.therapist_name}
                </p>
              )}
              {session.treatment_provided && (
                <p className="text-xs text-ink-800">{session.treatment_provided}</p>
              )}
              {session.package_progress && (
                <p className="text-xs text-ink-400">
                  Package: {session.package_progress}
                </p>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-500">
              <span className="size-1.5 rounded-full bg-ink-400" />
              Not logged yet
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function TodayActivity() {
  const { role } = useAuth();
  const basePath =
    role === 'SUPERADMIN' ? '/superadmin' : '/admin';

  const today = todayStr();
  const [clinicFilter, setClinicFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Clinics for the filter dropdown.
  const { data: clinicsData } = useApi(() => clinicService.list({ page_size: 100 }), []);
  const clinics = clinicsData?.items ?? [];

  const apptParams = {
    date: today,
    page_size: 200,
    ...(clinicFilter ? { clinic_id: clinicFilter } : {}),
  };
  const sessParams = {
    from: today,
    to: today,
    page_size: 200,
    ...(clinicFilter ? { clinic_id: clinicFilter } : {}),
  };

  const {
    data: apptData,
    loading: apptLoading,
    reload: reloadAppts,
  } = useApi(() => appointmentService.list(apptParams), [today, clinicFilter]);

  const {
    data: sessData,
    loading: sessLoading,
    reload: reloadSess,
  } = useApi(() => sessionService.list(sessParams), [today, clinicFilter]);

  const loading = apptLoading || sessLoading;

  function reload() {
    reloadAppts();
    reloadSess();
  }

  // Merge appointments and sessions, grouped by patient_id.
  const { entries, stats } = useMemo(() => {
    const appointments = apptData?.items ?? [];
    const sessions = sessData?.items ?? [];

    const map = new Map();

    for (const appt of appointments) {
      const pid = appt.patient?.id;
      if (!pid) continue;
      if (!map.has(pid)) {
        map.set(pid, {
          patient: {
            id: pid,
            full_name: appt.patient.full_name,
            patient_code: appt.patient.patient_code,
            mobile: appt.patient.mobile,
          },
          appointment: null,
          sessions: [],
        });
      }
      // Keep the latest/most relevant appointment per patient (appointments
      // are sorted by start_time from the API, so first match is earliest).
      if (!map.get(pid).appointment) {
        map.get(pid).appointment = appt;
      }
    }

    for (const sess of sessions) {
      if (sess.is_voided) continue;
      const pid = sess.patient_id;
      if (!pid) continue;
      if (!map.has(pid)) {
        map.set(pid, {
          patient: {
            id: pid,
            full_name: sess.patient_name ?? 'Unknown',
            patient_code: sess.patient_code ?? '',
            mobile: '',
          },
          appointment: null,
          sessions: [],
        });
      }
      map.get(pid).sessions.push(sess);
    }

    const allEntries = [...map.values()].sort((a, b) => {
      // Sort by appointment start_time; walk-ins go to the bottom.
      const ta = a.appointment?.start_time ?? '99:99';
      const tb = b.appointment?.start_time ?? '99:99';
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });

    const appts = allEntries.map((e) => e.appointment).filter(Boolean);
    const stats = {
      total: allEntries.length,
      checkedIn: appts.filter((a) => a.status === 'CHECKED_IN').length,
      completed: appts.filter((a) => a.status === 'COMPLETED').length,
      noShow: appts.filter((a) => a.status === 'NO_SHOW').length,
      sessionsLogged: allEntries.filter((e) => e.sessions.length > 0).length,
    };

    return { entries: allEntries, stats };
  }, [apptData, sessData]);

  // Client-side status filter.
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return entries;
    if (statusFilter === 'active')
      return entries.filter(
        (e) => e.appointment && ACTIVE_STATUSES.has(e.appointment.status),
      );
    if (statusFilter === 'completed')
      return entries.filter((e) => e.appointment?.status === 'COMPLETED');
    if (statusFilter === 'noshow_cancelled')
      return entries.filter(
        (e) => e.appointment?.status === 'NO_SHOW' || e.appointment?.status === 'CANCELLED',
      );
    if (statusFilter === 'no_appt')
      return entries.filter((e) => !e.appointment);
    return entries;
  }, [entries, statusFilter]);

  const STATUS_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' },
    { id: 'noshow_cancelled', label: 'No show / Cancelled' },
    { id: 'no_appt', label: 'Walk-ins' },
  ];

  return (
    <>
      <PageHeader
        title="Today's Activity"
        description={`${formatDate(today)} · ${filtered.length} patient${filtered.length !== 1 ? 's' : ''} showing`}
        action={
          <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
            <Icon name="refresh" className="size-4" />
            Refresh
          </Button>
        }
      />

      {/* Summary stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="Total patients" value={stats.total} />
        <StatTile label="Checked in" value={stats.checkedIn} tone="warning" />
        <StatTile label="Completed" value={stats.completed} tone="success" />
        <StatTile label="No show" value={stats.noShow} tone="danger" />
        <StatTile label="Sessions logged" value={stats.sessionsLogged} tone="brand" />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Clinic dropdown */}
        {clinics.length > 1 && (
          <select
            value={clinicFilter}
            onChange={(e) => setClinicFilter(e.target.value)}
            className="rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm text-ink-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">All clinics</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {/* Status chips */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === f.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Card className="grid place-items-center py-16 text-brand-600">
          <Spinner size="lg" />
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No patients today"
          description={
            statusFilter !== 'all'
              ? 'No patients match this filter — try switching to "All".'
              : 'No appointments or sessions have been recorded for today yet.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <PatientActivityCard
              key={entry.patient.id}
              entry={entry}
              basePath={basePath}
            />
          ))}
        </div>
      )}
    </>
  );
}
