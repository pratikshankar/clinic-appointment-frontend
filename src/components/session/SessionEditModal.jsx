/**
 * Correct a data-entry mistake on a logged session.
 * Editable: session_date, therapist, treatment_provided, notes, remarks.
 * Package and patient are fixed — void and re-log to change those.
 */

import { useEffect, useState } from 'react';

import { Alert, Button, Field, Input, Modal, Select } from '../ui';
import { sessionService } from '../../services';

export function SessionEditModal({ open, session, therapists = [], onClose, onSaved }) {
  const [form, setForm] = useState({
    session_date: '',
    therapist_user_id: '',
    treatment_provided: '',
    notes: '',
    remarks: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !session) return;
    setError(null);
    setForm({
      session_date: session.session_date ?? '',
      therapist_user_id: session.therapist_user_id ? String(session.therapist_user_id) : '',
      treatment_provided: session.treatment_provided ?? '',
      notes: session.notes ?? '',
      remarks: session.remarks ?? '',
    });
  }, [open, session]);

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {};
      if (form.session_date) payload.session_date = form.session_date;
      payload.therapist_user_id = form.therapist_user_id ? Number(form.therapist_user_id) : null;
      payload.treatment_provided = form.treatment_provided.trim() || null;
      payload.notes = form.notes.trim() || null;
      payload.remarks = form.remarks.trim() || null;

      const updated = await sessionService.update(session.id, payload);
      onSaved?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!session) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissOnBackdrop={false}
      title={`Edit session #${session.session_number}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Session date" htmlFor="se_date" required>
            <Input id="se_date" type="date" value={form.session_date} onChange={update('session_date')} />
          </Field>

          <Field label="Therapist" htmlFor="se_therapist" hint="Optional">
            <Select id="se_therapist" value={form.therapist_user_id} onChange={update('therapist_user_id')}>
              <option value="">— Select therapist —</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Treatment provided" htmlFor="se_treatment">
              <Input id="se_treatment" value={form.treatment_provided} onChange={update('treatment_provided')} placeholder="What was done in this session" />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Clinical notes" htmlFor="se_notes" hint="Optional">
              <Input id="se_notes" value={form.notes} onChange={update('notes')} placeholder="Observations, response to treatment…" />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Remarks" htmlFor="se_remarks" hint="Optional">
              <Input id="se_remarks" value={form.remarks} onChange={update('remarks')} placeholder="Internal remarks" />
            </Field>
          </div>
        </div>
      </div>
    </Modal>
  );
}
