/**
 * Patient registration and editing.
 *
 * The duplicate check runs when the mobile field loses focus, before anything is
 * saved, so staff see an existing patient at the moment it matters. Creation is
 * still refused server-side on an exact match — the check is a convenience, not
 * the guard.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { DuplicateWarning } from '../../components/patient/DuplicateWarning';
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
import { clinicService, patientService, patientSourceService } from '../../services';

const BLANK = {
  full_name: '',
  mobile: '',
  whatsapp_number: '',
  email: '',
  date_of_birth: '',
  age: '',
  gender: '',
  address: '',
  chief_complaint: '',
  diagnosis: '',
  source_id: '',
  source_detail: '',
  primary_clinic_id: '',
};

const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'];

export default function PatientForm() {
  const { patientId } = useParams();
  const isEdit = Boolean(patientId);
  const navigate = useNavigate();
  const { role, clinics: myClinics } = useAuth();
  const basePath = role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';

  const [form, setForm] = useState(BLANK);
  const [loaded, setLoaded] = useState(!isEdit);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState(null);
  const [checking, setChecking] = useState(false);
  const [existing, setExisting] = useState(null);

  const { data: clinics } = useApi(() => clinicService.list({ status: 'ACTIVE' }), []);
  const { data: sources } = useApi(
    () => patientSourceService.list({ include_inactive: false }),
    []
  );

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    patientService
      .get(patientId)
      .then((patient) => {
        if (cancelled) return;
        setExisting(patient);
        setForm({
          full_name: patient.full_name ?? '',
          mobile: patient.mobile ?? '',
          whatsapp_number: patient.whatsapp_number ?? '',
          email: patient.email ?? '',
          date_of_birth: patient.date_of_birth ?? '',
          // Only prefill age when it was actually stored, not when derived.
          age: patient.age_as_of === 'registration' && patient.age ? String(patient.age) : '',
          gender: patient.gender ?? '',
          address: patient.address ?? '',
          chief_complaint: patient.chief_complaint ?? '',
          diagnosis: patient.diagnosis ?? '',
          source_id: patient.source_id ? String(patient.source_id) : '',
          source_detail: patient.source_detail ?? '',
          primary_clinic_id: patient.primary_clinic_id ? String(patient.primary_clinic_id) : '',
        });
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [isEdit, patientId]);

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    if (field === 'mobile' || field === 'full_name') setDuplicates(null);
  };

  // A blank WhatsApp number means "same as mobile" -- the backend falls back to
  // `mobile`, so there is no second copy of the number to keep in sync.
  const whatsappSameAsMobile = !form.whatsapp_number.trim();

  /** Look for an existing patient once there is a plausible mobile number. */
  async function checkDuplicates() {
    const digits = form.mobile.replace(/\D/g, '');
    if (digits.length < 10) return;
    setChecking(true);
    try {
      const result = await patientService.duplicateCheck({
        full_name: form.full_name.trim() || null,
        mobile: form.mobile.trim(),
      });
      // When editing, the patient's own record is not a duplicate of itself.
      if (isEdit) {
        const mine = Number(patientId);
        result.exact_match =
          result.exact_match && result.exact_match.id !== mine ? result.exact_match : null;
        result.same_mobile = (result.same_mobile ?? []).filter((p) => p.id !== mine);
        result.similar_name = (result.similar_name ?? []).filter((p) => p.id !== mine);
      }
      setDuplicates(result);
    } catch {
      // A failed pre-check must not block the form; the API still guards it.
      setDuplicates(null);
    } finally {
      setChecking(false);
    }
  }

  function buildPayload() {
    const body = {
      full_name: form.full_name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim() || null,
      whatsapp_number: form.whatsapp_number.trim() || null,
      date_of_birth: form.date_of_birth || null,
      age: form.date_of_birth ? null : form.age ? Number(form.age) : null,
      gender: form.gender || null,
      address: form.address.trim() || null,
      chief_complaint: form.chief_complaint.trim() || null,
      diagnosis: form.diagnosis.trim() || null,
      source_id: form.source_id ? Number(form.source_id) : null,
      source_detail: form.source_detail.trim() || null,
      primary_clinic_id: form.primary_clinic_id ? Number(form.primary_clinic_id) : null,
    };
    return body;
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      if (isEdit) {
        await patientService.update(patientId, buildPayload());
        navigate(`${basePath}/patients/${patientId}`, { replace: true });
      } else {
        const created = await patientService.create(buildPayload());
        navigate(`${basePath}/patients/${created.id}`, { replace: true });
      }
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors ?? {});
      // A 409 carries the existing patient, so offer to open it.
      if (err.status === 409 && err.details?.existing_patient_id) {
        setDuplicates({
          exact_match: {
            id: err.details.existing_patient_id,
            patient_code: err.details.patient_code,
            full_name: err.details.full_name,
            mobile: err.details.mobile,
            in_your_scope: true,
            is_profile_complete: true,
          },
          same_mobile: [],
          similar_name: [],
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) {
    return (
      <Card className="grid place-items-center py-20 text-brand-600">
        <Spinner size="lg" />
      </Card>
    );
  }

  const clinicOptions = clinics ?? [];
  const clinicLocked = role === 'CLINIC_USER';

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit ${existing?.full_name ?? 'patient'}` : 'Register patient'}
        backTo={isEdit ? `${basePath}/patients/${patientId}` : `${basePath}/patients`}
        backLabel={isEdit ? 'Back to patient' : 'All patients'}
        breadcrumb={[
          { label: 'Patients', to: `${basePath}/patients` },
          { label: isEdit ? existing?.patient_code ?? 'Edit' : 'New' },
        ]}
        description={
          isEdit && existing && !existing.is_profile_complete
            ? 'Fill in gender, address and source to mark this profile complete.'
            : 'A permanent Patient ID is generated automatically and never changes.'
        }
      />

      <form onSubmit={submit} className="max-w-3xl space-y-4">
        {error && (
          <Alert tone="error" title="Could not save">
            {error}
          </Alert>
        )}

        <DuplicateWarning
          result={duplicates}
          onSelect={(patient) => navigate(`${basePath}/patients/${patient.id}`)}
        />

        <Card>
          <CardHeader
            title="Identity"
            description="Name and mobile number together identify a patient."
            action={
              isEdit &&
              existing && (
                <Badge tone={existing.is_profile_complete ? 'success' : 'warning'}>
                  {existing.patient_code}
                </Badge>
              )
            }
          />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="full_name" required error={fieldErrors.full_name}>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={update('full_name')}
                onBlur={checkDuplicates}
                required
                minLength={2}
                invalid={Boolean(fieldErrors.full_name)}
              />
            </Field>

            <Field
              label="Mobile"
              htmlFor="mobile"
              required
              hint={checking ? 'Checking for an existing patient…' : '10 digits, optionally +91'}
              error={fieldErrors.mobile}
            >
              <Input
                id="mobile"
                value={form.mobile}
                onChange={update('mobile')}
                onBlur={checkDuplicates}
                required
                invalid={Boolean(fieldErrors.mobile)}
              />
            </Field>

            <Field
              label="WhatsApp number"
              htmlFor="whatsapp_number"
              hint={
                whatsappSameAsMobile
                  ? 'Blank = same as mobile'
                  : 'Different from the mobile number'
              }
              error={fieldErrors.whatsapp_number}
            >
              <div className="flex items-center gap-2">
                <Input
                  id="whatsapp_number"
                  value={form.whatsapp_number}
                  onChange={update('whatsapp_number')}
                  placeholder={form.mobile ? `${form.mobile} (same as mobile)` : 'Optional'}
                  invalid={Boolean(fieldErrors.whatsapp_number)}
                />
                {!whatsappSameAsMobile && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, whatsapp_number: '' }))}
                    className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                    title="Clear, so WhatsApp goes to the mobile number"
                  >
                    Same as mobile
                  </button>
                )}
              </div>
            </Field>

            <Field label="Email" htmlFor="email" error={fieldErrors.email}>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={update('email')}
                invalid={Boolean(fieldErrors.email)}
              />
            </Field>

            <Field
              label="Home clinic"
              htmlFor="primary_clinic_id"
              hint={clinicLocked ? 'Your clinic' : 'Where the patient normally attends'}
              error={fieldErrors.primary_clinic_id}
            >
              <Select
                id="primary_clinic_id"
                value={form.primary_clinic_id}
                onChange={update('primary_clinic_id')}
                disabled={clinicLocked}
              >
                <option value="">
                  {clinicLocked ? myClinics[0]?.clinic_name ?? 'Your clinic' : 'Select a clinic…'}
                </option>
                {clinicOptions.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Demographics"
            description="Gender and address are two of the three fields required for a complete profile."
          />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
            <Field label="Date of birth" htmlFor="date_of_birth" error={fieldErrors.date_of_birth}>
              <Input
                id="date_of_birth"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.date_of_birth}
                onChange={update('date_of_birth')}
              />
            </Field>

            <Field
              label="Age"
              htmlFor="age"
              hint={form.date_of_birth ? 'Derived from date of birth' : 'If DOB is unknown'}
              error={fieldErrors.age}
            >
              <Input
                id="age"
                type="number"
                min={0}
                max={130}
                value={form.date_of_birth ? '' : form.age}
                onChange={update('age')}
                disabled={Boolean(form.date_of_birth)}
              />
            </Field>

            <Field label="Gender" htmlFor="gender" error={fieldErrors.gender}>
              <Select id="gender" value={form.gender} onChange={update('gender')}>
                <option value="">Not recorded</option>
                {GENDERS.map((value) => (
                  <option key={value} value={value}>
                    {value.charAt(0) + value.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="sm:col-span-3">
              <Field label="Address" htmlFor="address" error={fieldErrors.address}>
                <Input id="address" value={form.address} onChange={update('address')} />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Clinical and source"
            description="Source is the third field required for a complete profile."
          />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field label="Chief complaint" htmlFor="chief_complaint">
              <Input
                id="chief_complaint"
                value={form.chief_complaint}
                onChange={update('chief_complaint')}
                placeholder="e.g. Lower back pain"
              />
            </Field>

            <Field label="Diagnosis / condition" htmlFor="diagnosis">
              <Input
                id="diagnosis"
                value={form.diagnosis}
                onChange={update('diagnosis')}
                placeholder="e.g. Lumbar strain"
              />
            </Field>

            <Field label="How did they find us?" htmlFor="source_id" error={fieldErrors.source_id}>
              <Select id="source_id" value={form.source_id} onChange={update('source_id')}>
                <option value="">Not recorded</option>
                {(sources ?? []).map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Source detail"
              htmlFor="source_detail"
              hint="e.g. referring doctor's name"
            >
              <Input
                id="source_detail"
                value={form.source_detail}
                onChange={update('source_detail')}
              />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={Boolean(duplicates?.exact_match)}>
            {isEdit ? 'Save patient' : 'Register patient'}
          </Button>
        </div>
      </form>
    </>
  );
}
