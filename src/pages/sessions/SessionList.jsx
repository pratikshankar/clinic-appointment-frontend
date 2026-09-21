/**
 * Sessions delivered, with filters and the void action.
 *
 * Voided sessions are hidden by default and shown on request, greyed out with
 * their reason — a correction is information, not something to erase.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

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
import { clinicService, sessionService } from '../../services';
import { formatDate, formatNumber } from '../../utils/format';

export default function SessionList() {
  const { role } = useAuth();
  const basePath = role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';

  const [filters, setFilters] = useState({
    search: '',
    clinic_id: '',
    from: '',
    to: '',
    include_voided: 'false',
  });
  const [banner, setBanner] = useState(null);
  const [voiding, setVoiding] = useState(null);
  const [editing, setEditing] = useState(null);

  const { data: clinics } = useApi(() => clinicService.list(), []);
  const { data: page, loading, error, reload } = useApi(
    () =>
      sessionService.list({
        search: filters.search || undefined,
        clinic_id: filters.clinic_id || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        include_voided: filters.include_voided,
        page_size: 100,
      }),
    [filters.search, filters.clinic_id, filters.from, filters.to, filters.include_voided]
  );
  const { data: counters, reload: reloadCounters } = useApi(
    () => sessionService.counters(filters.clinic_id || undefined),
    [filters.clinic_id]
  );

  const update = (field) => (event) =>
    setFilters((prev) => ({ ...prev, [field]: event.target.value }));

  async function refresh() {
    await Promise.all([reload(), reloadCounters()]);
  }

  const sessions = page?.items ?? [];

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Physiotherapy sessions delivered. Log a session from a patient's profile or by completing their appointment."
      />

      {counters && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Today" value={formatNumber(counters.today)} tone="brand" />
          <StatCard label="This month" value={formatNumber(counters.this_month)} />
          <StatCard label="All time" value={formatNumber(counters.total)} />
        </div>
      )}

      {banner && (
        <div className="mb-4">
          <Alert tone={banner.tone} title={banner.title} onDismiss={() => setBanner(null)}>
            {banner.message}
          </Alert>
        </div>
      )}

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Search" htmlFor="s-search" hint="Patient name, ID or mobile">
            <Input id="s-search" value={filters.search} onChange={update('search')} />
          </Field>
          {role !== 'CLINIC_USER' && (
            <Field label="Clinic" htmlFor="s-clinic">
              <Select id="s-clinic" value={filters.clinic_id} onChange={update('clinic_id')}>
                <option value="">All clinics</option>
                {(clinics ?? []).map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="From" htmlFor="s-from">
            <Input id="s-from" type="date" value={filters.from} onChange={update('from')} />
          </Field>
          <Field label="To" htmlFor="s-to">
            <Input id="s-to" type="date" value={filters.to} onChange={update('to')} />
          </Field>
          <Field label="Voided" htmlFor="s-voided">
            <Select
              id="s-voided"
              value={filters.include_voided}
              onChange={update('include_voided')}
            >
              <option value="false">Hide voided</option>
              <option value="true">Include voided</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        {error ? (
          <div className="p-5">
            <Alert tone="error" title="Could not load sessions">
              {error.message}
            </Alert>
          </div>
        ) : loading ? (
          <div className="grid place-items-center py-16 text-brand-600">
            <Spinner size="lg" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            title="No sessions recorded"
            description="Sessions appear here once a therapist logs one, or when an appointment is completed with notes."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Patient</Th>
                <Th align="right">Session</Th>
                <Th>Therapist</Th>
                <Th>Treatment</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  className={session.is_voided ? 'bg-ink-50/60 text-ink-400' : 'hover:bg-ink-50/60'}
                >
                  <Td>{formatDate(session.session_date)}</Td>
                  <Td>
                    <Link
                      to={`${basePath}/patients/${session.patient_id}`}
                      className={
                        session.is_voided
                          ? 'text-ink-400'
                          : 'font-medium text-brand-700 hover:underline'
                      }
                    >
                      {session.patient_name}
                    </Link>
                    <div className="numeric text-xs text-ink-500">{session.patient_code}</div>
                  </Td>
                  <Td align="right">
                    {session.package_progress ?? `#${session.session_number}`}
                    {session.is_voided && (
                      <Badge tone="danger" className="ml-2">
                        Voided
                      </Badge>
                    )}
                  </Td>
                  <Td>{session.therapist_name ?? '—'}</Td>
                  <Td className="max-w-[16rem] truncate">
                    {session.treatment_provided ?? '—'}
                    {session.is_voided && session.void_reason && (
                      <div className="text-xs italic">Voided: {session.void_reason}</div>
                    )}
                  </Td>
                  <Td align="right">
                    {!session.is_voided && (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(session)}>
                          Edit notes
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setVoiding(session)}>
                          Void
                        </Button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <VoidDialog
        session={voiding}
        onClose={() => setVoiding(null)}
        onDone={async (message) => {
          setVoiding(null);
          setBanner({ tone: 'success', title: 'Session voided', message });
          await refresh();
        }}
      />

      <EditNotesDialog
        session={editing}
        onClose={() => setEditing(null)}
        onDone={async () => {
          setEditing(null);
          setBanner({ tone: 'success', title: 'Notes updated', message: '' });
          await refresh();
        }}
      />
    </>
  );
}

function VoidDialog({ session, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await sessionService.void(session.id, reason.trim());
      setReason('');
      onDone(
        result.package
          ? `${result.package.sessions_remaining} of ${result.package.sessions_registered} sessions now remaining.`
          : 'The session no longer counts.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={Boolean(session)}
      onClose={onClose}
      title={session ? `Void session for ${session.patient_name}?` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={submit}>
            Void session
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-sm text-ink-700">
          The session is kept on the record and marked voided, and the place is returned to
          the package. The session number is not reused.
        </p>
        <Field
          label="Reason"
          htmlFor="void-reason"
          required
          hint="At least a few words — this stays on the record"
        >
          <Input
            id="void-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Logged against the wrong patient"
          />
        </Field>
      </div>
    </Modal>
  );
}

function EditNotesDialog({ session, onClose, onDone }) {
  const [form, setForm] = useState({ treatment_provided: '', notes: '', remarks: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(null);

  // Load the current values once per session opened.
  if (session && loaded !== session.id) {
    setLoaded(session.id);
    setForm({
      treatment_provided: session.treatment_provided ?? '',
      notes: session.notes ?? '',
      remarks: session.remarks ?? '',
    });
  }

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await sessionService.update(session.id, {
        treatment_provided: form.treatment_provided.trim() || null,
        notes: form.notes.trim() || null,
        remarks: form.remarks.trim() || null,
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={Boolean(session)}
      onClose={onClose}
      title="Edit session notes"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Save notes
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <Alert tone="info">
          Only the clinical narrative can be changed. The date and package are fixed — void
          the session if those are wrong.
        </Alert>
        <Field label="Treatment provided" htmlFor="edit-treatment">
          <Input
            id="edit-treatment"
            value={form.treatment_provided}
            onChange={update('treatment_provided')}
          />
        </Field>
        <Field label="Notes" htmlFor="edit-notes">
          <Input id="edit-notes" value={form.notes} onChange={update('notes')} />
        </Field>
        <Field label="Remarks" htmlFor="edit-remarks">
          <Input id="edit-remarks" value={form.remarks} onChange={update('remarks')} />
        </Field>
      </div>
    </Modal>
  );
}

export { SessionForm };
