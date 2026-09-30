import { useEffect, useState } from 'react';
import { Alert, Button, Field, Modal, Select } from '../ui';
import { api } from '../../services/api.js';
import { prescriptionService } from '../../services/prescriptionService.js';
import { patientService } from '../../services/index.js';

const BLANK = {
  prescribed_by_user_id: '',
  chief_complaint: '',
  history: '',
  on_examination: '',
  diagnosis: '',
  treatment_plan: '',
  home_protocol: '',
  notes: '',
};

const textareaClass =
  'block w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 ' +
  'placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ' +
  'disabled:bg-ink-50 disabled:text-ink-500 resize-y';

export function PrescriptionForm({
  open,
  patient,
  clinicId,
  onClose,
  onCreated,
  onPatientUpdated,
}) {
  const [form, setForm] = useState(BLANK);
  const [age, setAge] = useState('');
  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Derived: age is missing from patient record
  const ageMissing = !patient?.age && !patient?.date_of_birth;

  useEffect(() => {
    if (!open) return;
    setForm({
      ...BLANK,
      chief_complaint: patient?.chief_complaint || '',
      diagnosis: patient?.diagnosis || '',
    });
    setAge('');
    setError(null);
  }, [open, patient]);

  useEffect(() => {
    if (!open || !clinicId) return;
    api.get(`/clinics/${clinicId}/users`)
      .then(setStaff)
      .catch(() => setStaff([]));
  }, [open, clinicId]);

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function submit(e) {
    e?.preventDefault();
    setError(null);

    // Validate age if missing
    const ageNum = age.trim() ? parseInt(age, 10) : null;
    if (ageMissing && age.trim() && (isNaN(ageNum) || ageNum < 0 || ageNum > 130)) {
      setError('Please enter a valid age (0–130).');
      return;
    }

    setSaving(true);
    try {
      // Save age back to patient profile if it was just filled in
      if (ageMissing && ageNum !== null) {
        await patientService.update(patient.id, { age: ageNum });
        onPatientUpdated?.();
      }

      const payload = {
        patient_id: patient.id,
        clinic_id: clinicId || null,
        prescribed_by_user_id: form.prescribed_by_user_id
          ? Number(form.prescribed_by_user_id)
          : null,
        chief_complaint: form.chief_complaint.trim() || null,
        history: form.history.trim() || null,
        on_examination: form.on_examination.trim() || null,
        diagnosis: form.diagnosis.trim() || null,
        treatment_plan: form.treatment_plan.trim() || null,
        home_protocol: form.home_protocol.trim() || null,
        notes: form.notes.trim() || null,
      };
      const created = await prescriptionService.create(payload);
      onCreated?.(created);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save prescription');
    } finally {
      setSaving(false);
    }
  }

  // Compute age display for the banner
  const displayAge = patient?.age
    ? `${patient.age} yrs`
    : patient?.date_of_birth
    ? `${Math.floor((Date.now() - new Date(patient.date_of_birth)) / 31557600000)} yrs`
    : null;

  return (
    <Modal open={open} onClose={onClose} title="New Prescription" size="lg">
      {/* Patient banner */}
      <div className="mb-5 rounded-lg bg-brand-50 border border-brand-100 px-4 py-3">
        <p className="text-sm font-semibold text-ink-900">{patient?.full_name}</p>
        <p className="text-xs text-ink-500 mt-0.5">
          {[patient?.patient_code, displayAge, patient?.gender]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <div
        className="space-y-4"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
      >
        {/* Age — only shown when missing from profile */}
        {ageMissing && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-800 mb-2">
              Age not on file — please enter it to include in the prescription.
            </p>
            <Field label="Patient Age (years)" htmlFor="prx_age">
              <input
                id="prx_age"
                type="number"
                min="0"
                max="130"
                className="block w-40 rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 35"
              />
            </Field>
            <p className="mt-1 text-xs text-amber-700">
              This will be saved to the patient's profile.
            </p>
          </div>
        )}

        {/* Physiotherapist */}
        <Field label="Physiotherapist" htmlFor="prx_physio">
          <Select
            id="prx_physio"
            value={form.prescribed_by_user_id}
            onChange={update('prescribed_by_user_id')}
          >
            <option value="">— select —</option>
            {staff.map((s) => (
              <option key={s.user_id ?? s.id} value={s.user_id ?? s.id}>
                {s.full_name}
                {s.designation ? ` — ${s.designation}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        {/* Chief Complaints */}
        <Field label="Chief Complaints" htmlFor="prx_cc">
          <textarea
            id="prx_cc"
            rows={2}
            className={textareaClass}
            value={form.chief_complaint}
            onChange={update('chief_complaint')}
            placeholder="Patient's presenting complaints…"
          />
        </Field>

        {/* Present and Past History */}
        <Field
          label="Present and Past History"
          htmlFor="prx_hist"
          hint="Relevant medical, surgical or physiotherapy history"
        >
          <textarea
            id="prx_hist"
            rows={3}
            className={textareaClass}
            value={form.history}
            onChange={update('history')}
            placeholder="e.g. H/o RTA 6 months ago, no prior physiotherapy…"
          />
        </Field>

        {/* On Examination */}
        <Field label="On Examination" htmlFor="prx_oe">
          <textarea
            id="prx_oe"
            rows={3}
            className={textareaClass}
            value={form.on_examination}
            onChange={update('on_examination')}
            placeholder="e.g. ROM limited, tenderness at L4-L5, SLR positive at 40°…"
          />
        </Field>

        {/* Diagnosis */}
        <Field label="Diagnosis" htmlFor="prx_dx">
          <textarea
            id="prx_dx"
            rows={2}
            className={textareaClass}
            value={form.diagnosis}
            onChange={update('diagnosis')}
            placeholder="Clinical diagnosis…"
          />
        </Field>

        {/* Treatment */}
        <Field
          label="Treatment"
          htmlFor="prx_tx"
          hint="In-clinic physiotherapy treatment protocol"
        >
          <textarea
            id="prx_tx"
            rows={3}
            className={textareaClass}
            value={form.treatment_plan}
            onChange={update('treatment_plan')}
            placeholder="e.g. IFT 15 min, hot pack 10 min, manual therapy, US therapy…"
          />
        </Field>

        {/* Home Protocol */}
        <Field
          label="Home Protocol"
          htmlFor="prx_home"
          hint="Instructions the patient takes home"
        >
          <textarea
            id="prx_home"
            rows={3}
            className={textareaClass}
            value={form.home_protocol}
            onChange={update('home_protocol')}
            placeholder="e.g. Pendulum exercises 3×10 twice daily, ice pack 15 min after…"
          />
        </Field>

        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={saving} onClick={submit}>
            Save Prescription
          </Button>
        </div>
      </div>
    </Modal>
  );
}
