/**
 * Booking screen, two paths on one page.
 *
 * **New lead** — name, mobile, optional WhatsApp, complaint *and* the slot, saved
 * in a single request. Deliberately not a wizard: reception is on the phone with
 * the caller, and a second page means holding the line.
 *
 * **Existing patient** — find them with the Phase 3 picker (scoped search, then
 * chain-wide), then pick a slot. Nothing is re-typed.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { SlotPicker } from '../../components/appointment/SlotPicker';
import { Icon } from '../../components/Icon';
import { PatientPicker } from '../../components/patient/PatientPicker';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import {
  appointmentService,
  clinicService,
  patientService,
  patientSourceService,
} from '../../services';
import { formatDate, formatTime } from '../../utils/format';

const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'];

const BLANK_LEAD = {
  full_name: '',
  mobile: '',
  whatsapp_number: '',
  email: '',
  age: '',
  gender: '',
  source_id: '',
  chief_complaint: '',
};

export default function BookAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role, clinics: myClinics } = useAuth();
  const basePath = role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';

  const { data: clinics } = useApi(() => clinicService.list({ status: 'ACTIVE' }), []);
  const { data: sources } = useApi(
    () => patientSourceService.list({ include_inactive: false }),
    []
  );

  // "new" for a first-time caller, "existing" to book someone already registered.
  const [mode, setMode] = useState(searchParams.get('patient_id') ? 'existing' : 'new');
  const [lead, setLead] = useState(BLANK_LEAD);
  const [patient, setPatient] = useState(null);

  const [clinicId, setClinicId] = useState(null);
  const [onDate, setOnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState(null);
  const [notes, setNotes] = useState('');

  // Section 14: arriving from a patient profile with ?patient_id= pre-selects
  // that patient, so "book the next appointment" is one click away from their
  // record rather than a fresh search.
  const preselectedId = searchParams.get('patient_id');
  const [loadingPatient, setLoadingPatient] = useState(Boolean(preselectedId));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    if (!preselectedId) return;
    let cancelled = false;
    patientService
      .get(preselectedId)
      .then((found) => {
        if (cancelled) return;
        setPatient(found);
        setMode('existing');
        // Default the slot picker to where this patient normally attends.
        if (found.primary_clinic_id) setClinicId(found.primary_clinic_id);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoadingPatient(false));
    return () => {
      cancelled = true;
    };
  }, [preselectedId]);


  // A Clinic User books at their own clinic; the selector is locked to it.
  const clinicLocked = role === 'CLINIC_USER';
  const effectiveClinicId =
    clinicLocked ? (myClinics[0]?.clinic_id ?? null) : clinicId;

  const updateLead = (field) => (event) =>
    setLead((prev) => ({ ...prev, [field]: event.target.value }));

  const whatsappSameAsMobile = !lead.whatsapp_number.trim();

  const readyToBook =
    Boolean(effectiveClinicId && onDate && slot) &&
    (mode === 'existing'
      ? Boolean(patient)
      : lead.full_name.trim().length >= 2 && lead.mobile.replace(/\D/g, '').length >= 10);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    setConflict(null);

    const slotPart = {
      clinic_id: effectiveClinicId,
      appointment_date: onDate,
      start_time: `${slot}:00`,
      chief_complaint: lead.chief_complaint.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      const result =
        mode === 'existing'
          ? await appointmentService.book({ ...slotPart, patient_id: patient.id })
          : await appointmentService.bookNewPatient({
              ...slotPart,
              full_name: lead.full_name.trim(),
              mobile: lead.mobile.trim(),
              whatsapp_number: lead.whatsapp_number.trim() || null,
              email: lead.email.trim() || null,
              age: lead.age ? Number(lead.age) : null,
              gender: lead.gender || null,
              source_id: lead.source_id ? Number(lead.source_id) : null,
            });

      navigate(`${basePath}/appointments`, {
        replace: true,
        state: {
          booked: result.appointment,
          warnings: result.warnings,
          patientCreated: result.patient_created,
        },
      });
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors ?? {});
      // Someone took the last place while this form was open: refresh the grid
      // by nudging the date, and tell the operator plainly.
      if (err.code === 'slot_unavailable') {
        setConflict(err.details ?? {});
        setSlot(null);
      }
      // An exact duplicate on the new-lead path: offer the existing patient.
      if (err.code === 'duplicate_resource' && err.details?.existing_patient_id) {
        setConflict({ duplicate: err.details });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Book an appointment"
        backTo={`${basePath}/appointments`}
        backLabel="All appointments"
        description="A first-time caller is registered and booked in one step. An existing patient keeps their Patient ID."
      />

      <form onSubmit={submit} className="max-w-4xl space-y-4">
        {error && (
          <Alert tone="error" title="Could not book">
            {error}
          </Alert>
        )}

        {conflict?.duplicate && (
          <Alert tone="warning" title="This patient is already registered">
            {conflict.duplicate.full_name} ({conflict.duplicate.patient_code}) already has this
            mobile number. Switch to <strong>Existing patient</strong> and search for them, so
            their history stays in one place.
          </Alert>
        )}

        {conflict?.capacity !== undefined && (
          <Alert tone="warning" title="That slot just filled up">
            {conflict.time} on {conflict.date} now holds {conflict.booked} of{' '}
            {conflict.capacity} appointments. Pick another slot below — the grid has been
            refreshed.
          </Alert>
        )}

        {/* Who is this for? */}
        <Card>
          <CardHeader
            title="Patient"
            description="Everything needed for a first-time caller is on this screen."
          />
          <div className="px-5 py-4">
            <div className="mb-4 inline-flex rounded-lg bg-ink-100 p-1">
              {[
                { key: 'new', label: 'New patient' },
                { key: 'existing', label: 'Existing patient' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setMode(option.key);
                    setError(null);
                    setConflict(null);
                  }}
                  className={[
                    'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
                    mode === option.key
                      ? 'bg-white text-ink-900 shadow-sm'
                      : 'text-ink-600 hover:text-ink-900',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {loadingPatient ? (
              <div className="grid place-items-center py-6 text-brand-600">
                <Spinner />
              </div>
            ) : mode === 'existing' ? (
              patient ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-50 px-4 py-3 ring-1 ring-inset ring-brand-200">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {patient.full_name}{' '}
                      <span className="numeric text-xs font-normal text-ink-500">
                        {patient.patient_code}
                      </span>
                    </p>
                    <p className="text-xs text-ink-600">
                      {patient.mobile}
                      {patient.primary_clinic_name ? ` · ${patient.primary_clinic_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!patient.is_profile_complete && (
                      <Badge tone="warning">Profile incomplete</Badge>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setPatient(null)}>
                      Change
                    </Button>
                  </div>
                </div>
              ) : (
                <PatientPicker
                  onSelect={setPatient}
                  onCreateNew={(term) => {
                    // Carry the typed term across rather than making them retype.
                    const digits = term.replace(/\D/g, '');
                    setLead((prev) => ({
                      ...prev,
                      full_name: digits.length >= 10 ? prev.full_name : term,
                      mobile: digits.length >= 10 ? digits : prev.mobile,
                    }));
                    setMode('new');
                  }}
                  autoFocus
                />
              )
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Patient name"
                  htmlFor="lead_name"
                  required
                  error={fieldErrors.full_name}
                >
                  <Input
                    id="lead_name"
                    value={lead.full_name}
                    onChange={updateLead('full_name')}
                    required
                    minLength={2}
                    invalid={Boolean(fieldErrors.full_name)}
                  />
                </Field>

                <Field
                  label="Mobile"
                  htmlFor="lead_mobile"
                  required
                  hint="10 digits, optionally +91"
                  error={fieldErrors.mobile}
                >
                  <Input
                    id="lead_mobile"
                    value={lead.mobile}
                    onChange={updateLead('mobile')}
                    required
                    invalid={Boolean(fieldErrors.mobile)}
                  />
                </Field>

                <Field
                  label="WhatsApp number"
                  htmlFor="lead_whatsapp"
                  hint={whatsappSameAsMobile ? 'Blank = same as mobile' : 'Different number'}
                  error={fieldErrors.whatsapp_number}
                >
                  <Input
                    id="lead_whatsapp"
                    value={lead.whatsapp_number}
                    onChange={updateLead('whatsapp_number')}
                    placeholder={lead.mobile ? `${lead.mobile} (same as mobile)` : 'Optional'}
                  />
                </Field>

                <Field
                  label="Email"
                  htmlFor="lead_email"
                  hint="For appointment confirmations"
                  error={fieldErrors.email}
                >
                  <Input
                    id="lead_email"
                    type="email"
                    value={lead.email}
                    onChange={updateLead('email')}
                    placeholder="Optional"
                  />
                </Field>

                <Field label="Age" htmlFor="lead_age">
                  <Input
                    id="lead_age"
                    type="number"
                    min={0}
                    max={130}
                    value={lead.age}
                    onChange={updateLead('age')}
                  />
                </Field>

                <Field label="Gender" htmlFor="lead_gender">
                  <Select id="lead_gender" value={lead.gender} onChange={updateLead('gender')}>
                    <option value="">Not recorded</option>
                    {GENDERS.map((value) => (
                      <option key={value} value={value}>
                        {value.charAt(0) + value.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="How did they find us?" htmlFor="lead_source">
                  <Select
                    id="lead_source"
                    value={lead.source_id}
                    onChange={updateLead('source_id')}
                  >
                    <option value="">Not recorded</option>
                    {(sources ?? []).map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="sm:col-span-2">
                  <Alert tone="info">
                    The profile is saved as incomplete — gender, address and source can be
                    finished when the patient arrives.
                  </Alert>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Complaint + slot */}
        <Card>
          <CardHeader title="Reason for visit" />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field label="Chief complaint" htmlFor="complaint">
              <Input
                id="complaint"
                value={lead.chief_complaint}
                onChange={updateLead('chief_complaint')}
                placeholder="e.g. Lower back pain"
              />
            </Field>
            <Field label="Notes" htmlFor="notes" hint="Optional, internal">
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </Card>

        <SlotPicker
          clinics={clinics}
          clinicId={effectiveClinicId}
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-500">
            {readyToBook
              ? `Booking ${formatTime(`${slot}:00`)} on ${formatDate(onDate)}`
              : !slot
                ? 'Select a slot above to continue'
                : mode === 'existing' && !patient
                  ? 'Search for and select a patient above'
                  : mode === 'new' && lead.full_name.trim().length < 2
                    ? 'Enter the patient name to continue'
                    : mode === 'new' && lead.mobile.replace(/\D/g, '').length < 10
                      ? 'Enter a valid 10-digit mobile number to continue'
                      : 'Select a clinic and date'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={!readyToBook}>
              <Icon name="calendar" className="size-4" />
              {mode === 'new' ? 'Register and book' : 'Book appointment'}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
