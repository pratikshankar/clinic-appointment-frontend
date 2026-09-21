/**
 * Appointment list: today / upcoming / past, with the actions reception uses.
 *
 * Every action is a real endpoint call and the row refreshes from the response,
 * so what is on screen is what the server believes. Illegal transitions are not
 * offered, and the server refuses them regardless.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { Icon } from '../../components/Icon';
import { SlotPicker } from '../../components/appointment/SlotPicker';
import { SessionForm } from '../../components/session/SessionForm';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  StatCard,
  Table,
  Td,
  Th,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { appointmentService, clinicService } from '../../services';
import { formatDate, formatDateTime, formatNumber, formatTime } from '../../utils/format';

const STATUS_TONES = {
  BOOKED: 'info',
  CONFIRMED: 'brand',
  CHECKED_IN: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  RESCHEDULED: 'neutral',
  NO_SHOW: 'danger',
};

/**
 * Which actions are offered for a given status — a subset of what the server
 * allows.
 *
 * CONFIRMED is absent from BOOKED on purpose: making the booking *is* the
 * confirmation, so a separate staff click adds nothing. The status and its
 * endpoint remain for Phase 6, where the *patient* confirms by replying to a
 * WhatsApp message — a genuinely different event.
 */
const ACTIONS = {
  BOOKED: ['checkIn', 'complete', 'noShow', 'reschedule', 'cancel'],
  CONFIRMED: ['checkIn', 'complete', 'noShow', 'reschedule', 'cancel'],
  CHECKED_IN: ['complete', 'reschedule', 'cancel'],
  COMPLETED: [],
  CANCELLED: [],
  RESCHEDULED: [],
  NO_SHOW: [],
};

const ACTION_LABELS = {
  confirm: 'Confirm',
  checkIn: 'Check in',
  complete: 'Complete',
  noShow: 'No-show',
  reschedule: 'Reschedule',
  cancel: 'Cancel',
};

const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

export default function AppointmentList() {
  const { role, clinics: myClinics } = useAuth();
  const location = useLocation();
  const basePath = role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';

  const [window_, setWindow] = useState('today');
  const [filters, setFilters] = useState({ clinic_id: '', status: '', search: '' });
  const [banner, setBanner] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  // Completing an appointment opens the session form; "Skip for now"
  // completes it without notes.
  const [completing, setCompleting] = useState(null);

  const { data: clinics } = useApi(() => clinicService.list(), []);
  const { data: page, loading, error, reload } = useApi(
    () =>
      appointmentService.list({
        window: window_,
        clinic_id: filters.clinic_id || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
        page_size: 100,
      }),
    [window_, filters.clinic_id, filters.status, filters.search]
  );
  const { data: counters, reload: reloadCounters } = useApi(
    () => appointmentService.counters(filters.clinic_id || undefined),
    [filters.clinic_id]
  );

  // A booking made on the previous screen arrives here as navigation state.
  useEffect(() => {
    const booked = location.state?.booked;
    if (!booked) return;
    setBanner({
      tone: 'success',
      title: `Booked ${booked.patient.full_name} — ${booked.appointment_code}`,
      messages: [
        `${formatDate(booked.appointment_date)} at ${formatTime(booked.start_time)}, ${
          booked.clinic_name
        }`,
        ...(location.state.warnings ?? []),
      ],
    });
    window.history.replaceState({}, '');
  }, [location.state]);

  async function refresh() {
    await Promise.all([reload(), reloadCounters()]);
  }

  async function act(appointment, action) {
    if (action === 'cancel') return setCancelling(appointment);
    if (action === 'reschedule') return setRescheduling(appointment);
    // Section 13: the session is recorded as part of completing the visit, so
    // the appointment count and the session count cannot drift apart.
    if (action === 'complete') return setCompleting(appointment);

    setBusyId(appointment.id);
    setBanner(null);
    try {
      const method = {
        confirm: appointmentService.confirm,
        checkIn: appointmentService.checkIn,
        noShow: appointmentService.noShow,
      }[action];
      const updated = await method(appointment.id);
      setBanner({
        tone: 'success',
        title: `${updated.appointment_code} is now ${updated.status}`,
        messages: [],
      });
      await refresh();
    } catch (err) {
      setBanner({ tone: 'error', title: 'Could not update', messages: [err.message] });
    } finally {
      setBusyId(null);
    }
  }

  const appointments = page?.items ?? [];

  return (
    <>
      <PageHeader
        title="Appointments"
        description={
          role === 'CLINIC_USER'
            ? "Your clinic's schedule."
            : 'Bookings across every clinic you manage.'
        }
        action={
          <Link
            to={`${basePath}/appointments/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <Icon name="calendar" className="size-4" />
            Book appointment
          </Link>
        }
      />

      {counters && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Today" value={formatNumber(counters.today)} tone="brand" />
          <StatCard label="Still to come today" value={formatNumber(counters.pending_today)} />
          <StatCard
            label="Checked in"
            value={formatNumber(counters.checked_in)}
            tone="warning"
          />
          <StatCard
            label="Completed today"
            value={formatNumber(counters.completed_today)}
            tone="positive"
          />
        </div>
      )}

      {banner && (
        <div className="mb-4">
          <Alert tone={banner.tone} title={banner.title} onDismiss={() => setBanner(null)}>
            {banner.messages?.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4">
                {banner.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </Alert>
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-ink-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setWindow(tab.key)}
            className={[
              '-mb-px whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-medium transition-colors',
              window_ === tab.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800',
            ].join(' ')}
          >
            {tab.label}
            {counters && (
              <span className="numeric ml-1.5 text-xs text-ink-400">
                {counters[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Search" htmlFor="appt-search" hint="Patient, mobile or reference">
            <Input
              id="appt-search"
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
            />
          </Field>
          {role !== 'CLINIC_USER' && (
            <Field label="Clinic" htmlFor="appt-clinic">
              <Select
                id="appt-clinic"
                value={filters.clinic_id}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, clinic_id: event.target.value }))
                }
              >
                <option value="">All clinics</option>
                {(clinics ?? []).map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Status" htmlFor="appt-status">
            <Select
              id="appt-status"
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="">All statuses</option>
              {Object.keys(STATUS_TONES).map((status) => (
                <option key={status} value={status}>
                  {status.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        {error ? (
          <div className="p-5">
            <Alert tone="error" title="Could not load appointments">
              {error.message}
            </Alert>
          </div>
        ) : loading ? (
          <div className="grid place-items-center py-16 text-brand-600">
            <Spinner size="lg" />
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState
            title={`No ${window_} appointments`}
            description={
              window_ === 'today'
                ? 'Nothing is scheduled for today.'
                : 'Nothing matches these filters.'
            }
            action={
              <Link
                to={`${basePath}/appointments/new`}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Book appointment
              </Link>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Patient</Th>
                <Th>Clinic</Th>
                <Th>Complaint</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {appointments.map((appointment) => (
                <tr key={appointment.id} className="hover:bg-ink-50/60">
                  <Td>
                    <div className="numeric font-medium text-ink-900">
                      {formatTime(appointment.start_time)}
                    </div>
                    <div className="text-xs text-ink-500">
                      {formatDate(appointment.appointment_date)}
                    </div>
                  </Td>
                  <Td>
                    <Link
                      to={`${basePath}/patients/${appointment.patient.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {appointment.patient.full_name}
                    </Link>
                    <div className="numeric text-xs text-ink-500">
                      {appointment.patient.patient_code} · {appointment.patient.mobile}
                    </div>
                  </Td>
                  <Td>{appointment.clinic_name}</Td>
                  <Td className="max-w-[14rem] truncate">
                    {appointment.chief_complaint ?? '—'}
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => setHistoryFor(appointment)}
                      title="View history"
                    >
                      <Badge tone={STATUS_TONES[appointment.status] ?? 'neutral'}>
                        {appointment.status.replace('_', ' ')}
                      </Badge>
                    </button>
                  </Td>
                  <Td align="right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {(ACTIONS[appointment.status] ?? []).map((action) => (
                        <Button
                          key={action}
                          size="sm"
                          variant={
                            action === 'cancel' || action === 'noShow' ? 'secondary' : 'primary'
                          }
                          loading={busyId === appointment.id}
                          onClick={() => act(appointment, action)}
                        >
                          {ACTION_LABELS[action]}
                        </Button>
                      ))}
                      {(ACTIONS[appointment.status] ?? []).length === 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setHistoryFor(appointment)}
                        >
                          History
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <CancelDialog
        appointment={cancelling}
        onClose={() => setCancelling(null)}
        onDone={async (message) => {
          setCancelling(null);
          setBanner({ tone: 'success', title: message, messages: [] });
          await refresh();
        }}
      />

      <RescheduleDialog
        appointment={rescheduling}
        clinics={clinics}
        clinicLocked={role === 'CLINIC_USER'}
        myClinicId={myClinics[0]?.clinic_id}
        onClose={() => setRescheduling(null)}
        onDone={async (message) => {
          setRescheduling(null);
          setBanner({ tone: 'success', title: message, messages: [] });
          await refresh();
        }}
      />

      <SessionForm
        open={Boolean(completing)}
        patientId={completing?.patient?.id}
        appointment={completing}
        title={completing ? `Record session — ${completing.patient.full_name}` : ''}
        // Closing is not an action: the appointment is left exactly as it was.
        onClose={() => setCompleting(null)}
        onCompleteWithoutSession={async () => {
          const appointment = completing;
          setCompleting(null);
          if (!appointment) return;
          try {
            const updated = await appointmentService.complete(appointment.id);
            setBanner({
              tone: 'warning',
              title: `${updated.appointment_code} completed without a session note`,
              messages: ['Log the session later from the patient profile.'],
            });
            await refresh();
          } catch (err) {
            setBanner({ tone: 'error', title: 'Could not complete', messages: [err.message] });
          }
        }}
        onSaved={async (result) => {
          setCompleting(null);
          setBanner({
            tone: 'success',
            title: `Session ${result.session.session_number} recorded`,
            messages: [
              result.appointment_completed ? 'The appointment was marked completed.' : null,
              result.package
                ? `${result.package.sessions_remaining} of ${result.package.sessions_registered} sessions remaining.`
                : 'Logged without consuming a package.',
              ...(result.warnings ?? []),
            ].filter(Boolean),
          });
          await refresh();
        }}
      />

      <HistoryDialog appointment={historyFor} onClose={() => setHistoryFor(null)} />
    </>
  );
}

function CancelDialog({ appointment, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const updated = await appointmentService.cancel(appointment.id, reason.trim() || null);
      setReason('');
      onDone(`${updated.appointment_code} cancelled`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={Boolean(appointment)}
      onClose={onClose}
      title={appointment ? `Cancel ${appointment.appointment_code}?` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" loading={busy} onClick={submit}>
            Cancel appointment
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        {appointment && (
          <p className="text-sm text-ink-700">
            {appointment.patient.full_name} at {formatTime(appointment.start_time)} on{' '}
            {formatDate(appointment.appointment_date)}. The slot becomes available again and
            the appointment is kept in the history.
          </p>
        )}
        <Field label="Reason" htmlFor="cancel-reason" hint="Recorded in the audit trail">
          <Input
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Patient unwell"
          />
        </Field>
      </div>
    </Modal>
  );
}

function RescheduleDialog({ appointment, clinics, clinicLocked, myClinicId, onClose, onDone }) {
  const [clinicId, setClinicId] = useState(null);
  const [onDate, setOnDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Start from the appointment's own clinic and date.
  useEffect(() => {
    if (!appointment) return;
    setClinicId(clinicLocked ? myClinicId : appointment.clinic_id);
    setOnDate(appointment.appointment_date);
    setSlot(null);
    setReason('');
    setError(null);
  }, [appointment, clinicLocked, myClinicId]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await appointmentService.reschedule(appointment.id, {
        clinic_id: clinicId,
        appointment_date: onDate,
        start_time: `${slot}:00`,
        reason: reason.trim() || null,
      });
      onDone(
        `Moved to ${formatDate(result.appointment.appointment_date)} at ${formatTime(
          result.appointment.start_time
        )} — new reference ${result.appointment.appointment_code}`
      );
    } catch (err) {
      setError(err.message);
      if (err.code === 'slot_unavailable') setSlot(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={Boolean(appointment)}
      onClose={onClose}
      size="lg"
      dismissOnBackdrop={false}
      title={appointment ? `Reschedule ${appointment.appointment_code}` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!slot} onClick={submit}>
            Move appointment
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        {appointment && (
          <p className="text-sm text-ink-700">
            Currently {formatTime(appointment.start_time)} on{' '}
            {formatDate(appointment.appointment_date)}. The original is kept and marked
            rescheduled, so the trail stays intact.
          </p>
        )}
        <SlotPicker
          clinics={clinics}
          clinicId={clinicId}
          onClinicChange={setClinicId}
          onDate={onDate}
          onDateChange={(value) => {
            setOnDate(value);
            setSlot(null);
          }}
          selected={slot}
          onSelect={setSlot}
          clinicLocked={clinicLocked}
        />
        <Field label="Reason" htmlFor="reschedule-reason">
          <Input
            id="reschedule-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Patient travelling"
          />
        </Field>
      </div>
    </Modal>
  );
}

function HistoryDialog({ appointment, onClose }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!appointment) {
      setEntries(null);
      return;
    }
    let cancelled = false;
    appointmentService
      .history(appointment.id)
      .then((data) => !cancelled && setEntries(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [appointment]);

  return (
    <Modal
      open={Boolean(appointment)}
      onClose={onClose}
      title={appointment ? `History — ${appointment.appointment_code}` : ''}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {error && <Alert tone="error">{error}</Alert>}
      {!entries ? (
        <div className="grid place-items-center py-8 text-brand-600">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-ink-500">No history recorded.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">
                  {entry.action.replace('_', ' ')}
                  {entry.old_status && entry.new_status && (
                    <span className="font-normal text-ink-500">
                      {' '}
                      · {entry.old_status} → {entry.new_status}
                    </span>
                  )}
                </p>
                {(entry.old_time || entry.new_time) && (
                  <p className="numeric text-xs text-ink-600">
                    {entry.old_date && entry.old_time
                      ? `${formatDate(entry.old_date)} ${formatTime(entry.old_time)}`
                      : ''}
                    {entry.new_time ? ' → ' : ''}
                    {entry.new_date && entry.new_time
                      ? `${formatDate(entry.new_date)} ${formatTime(entry.new_time)}`
                      : ''}
                  </p>
                )}
                {entry.reason && <p className="text-xs text-ink-600">{entry.reason}</p>}
                <p className="text-[11px] text-ink-400">
                  {formatDateTime(entry.changed_at)}
                  {entry.changed_by ? ` · ${entry.changed_by}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
