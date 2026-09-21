/**
 * Clinic create page and the reusable details form.
 *
 * `code` is shown but disabled when editing: it is immutable after creation so
 * historical records stay unambiguous. On creation it can be left blank, and the
 * backend derives it from the name.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
} from '../../components/ui';
import { clinicService } from '../../services';

const BLANK = {
  name: '',
  code: '',
  address: '',
  location: '',
  city: '',
  state: '',
  pin_code: '',
  phone: '',
  email: '',
  slot_duration_minutes: 30,
  capacity_per_slot: 3,
  // Branding: blank everywhere means "use the chain brand", which is the case
  // for every clinic except one trading under its own name.
  brand_name: '',
  brand_tagline: '',
  logo_filename: '',
  document_footer: '',
  bill_number_prefix: '',
};

/** Fields shared by create and edit. */
function DetailFields({ form, update, fieldErrors, canEdit, isEdit }) {
  return (
    <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
      <Field label="Clinic name" htmlFor="name" required error={fieldErrors.name}>
        <Input
          id="name"
          value={form.name}
          onChange={update('name')}
          disabled={!canEdit}
          required
          minLength={2}
          invalid={Boolean(fieldErrors.name)}
        />
      </Field>

      <Field
        label="Code"
        htmlFor="code"
        hint={
          isEdit
            ? 'Fixed after creation — it appears in historical records'
            : 'Leave blank to derive it from the name'
        }
        error={fieldErrors.code}
      >
        <Input
          id="code"
          value={form.code}
          onChange={update('code')}
          disabled={isEdit || !canEdit}
          maxLength={20}
        />
      </Field>

      <Field label="Address" htmlFor="address" error={fieldErrors.address}>
        <Input id="address" value={form.address} onChange={update('address')} disabled={!canEdit} />
      </Field>

      <Field label="Location / area" htmlFor="location" error={fieldErrors.location}>
        <Input
          id="location"
          value={form.location}
          onChange={update('location')}
          disabled={!canEdit}
        />
      </Field>

      <Field label="City" htmlFor="city" error={fieldErrors.city}>
        <Input id="city" value={form.city} onChange={update('city')} disabled={!canEdit} />
      </Field>

      <Field label="State" htmlFor="state" error={fieldErrors.state}>
        <Input id="state" value={form.state} onChange={update('state')} disabled={!canEdit} />
      </Field>

      <Field label="PIN code" htmlFor="pin_code" hint="6 digits" error={fieldErrors.pin_code}>
        <Input
          id="pin_code"
          value={form.pin_code}
          onChange={update('pin_code')}
          disabled={!canEdit}
          maxLength={6}
          invalid={Boolean(fieldErrors.pin_code)}
        />
      </Field>

      <Field
        label="Phone"
        htmlFor="phone"
        hint="10 digits, optionally +91"
        error={fieldErrors.phone}
      >
        <Input
          id="phone"
          value={form.phone}
          onChange={update('phone')}
          disabled={!canEdit}
          invalid={Boolean(fieldErrors.phone)}
        />
      </Field>

      <Field label="Email" htmlFor="email" error={fieldErrors.email}>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={update('email')}
          disabled={!canEdit}
          invalid={Boolean(fieldErrors.email)}
        />
      </Field>
    </div>
  );
}

/** Editable details block used by the clinic detail page. */
export function ClinicDetailsForm({ clinic, canEdit, onSaved }) {
  const [form, setForm] = useState({
    name: clinic.name ?? '',
    code: clinic.code ?? '',
    address: clinic.address ?? '',
    location: clinic.location ?? '',
    city: clinic.city ?? '',
    state: clinic.state ?? '',
    pin_code: clinic.pin_code ?? '',
    phone: clinic.phone ?? '',
    email: clinic.email ?? '',
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    // `code` is deliberately omitted: the API forbids it and would return 422.
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      location: form.location.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      pin_code: form.pin_code.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    };

    try {
      await clinicService.update(clinic.id, payload);
      onSaved?.();
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors ?? {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <Card>
        <CardHeader
          title="Clinic details"
          action={
            canEdit && (
              <Button type="submit" loading={saving}>
                Save details
              </Button>
            )
          }
        />
        {error && (
          <div className="px-5 pt-4">
            <Alert tone="error" title="Could not save">
              {error}
            </Alert>
          </div>
        )}
        <DetailFields
          form={form}
          update={update}
          fieldErrors={fieldErrors}
          canEdit={canEdit}
          isEdit
        />
      </Card>
    </form>
  );
}

/** Full create page. */
export default function ClinicCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      address: form.address.trim() || null,
      location: form.location.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      pin_code: form.pin_code.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      slot_duration_minutes: Number(form.slot_duration_minutes),
      capacity_per_slot: Number(form.capacity_per_slot),
      // Empty string means "inherit", which the API stores as NULL.
      brand_name: form.brand_name.trim() || null,
      brand_tagline: form.brand_tagline.trim() || null,
      logo_filename: form.logo_filename.trim() || null,
      document_footer: form.document_footer.trim() || null,
      bill_number_prefix: form.bill_number_prefix.trim() || null,
    };

    try {
      const response = await clinicService.create(payload);
      // Land on the new clinic so working hours can be configured immediately.
      navigate(`/superadmin/clinics/${response.clinic.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors ?? {});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="New clinic"
        backTo="/superadmin/clinics"
        backLabel="All clinics"
        breadcrumb={[{ label: 'Clinics', to: '/superadmin/clinics' }, { label: 'New' }]}
        description="The clinic starts with Monday–Saturday 09:00–13:00 and 16:00–20:00 shifts, which you can change straight after creating it."
      />

      <form onSubmit={submit} className="max-w-3xl space-y-4">
        {error && (
          <Alert tone="error" title="Could not create the clinic">
            {error}
          </Alert>
        )}

        <Card>
          <CardHeader title="Clinic details" />
          <DetailFields
            form={form}
            update={update}
            fieldErrors={fieldErrors}
            canEdit
            isEdit={false}
          />
        </Card>

        <Card>
          <CardHeader
            title="Appointment configuration"
            description="Both can be changed later."
          />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field
              label="Appointment duration"
              htmlFor="slot_duration_minutes"
              hint="Minutes per slot"
              required
              error={fieldErrors.slot_duration_minutes}
            >
              <Input
                id="slot_duration_minutes"
                type="number"
                min={5}
                max={240}
                step={5}
                value={form.slot_duration_minutes}
                onChange={update('slot_duration_minutes')}
                required
              />
            </Field>
            <Field
              label="Capacity per slot"
              htmlFor="capacity_per_slot"
              hint="Patients treated in parallel"
              required
              error={fieldErrors.capacity_per_slot}
            >
              <Input
                id="capacity_per_slot"
                type="number"
                min={1}
                max={100}
                value={form.capacity_per_slot}
                onChange={update('capacity_per_slot')}
                required
              />
            </Field>
          </div>
        </Card>

        {/*
          Almost every clinic leaves this untouched. It exists because one branch
          may trade under its own name and file under its own registration, and a
          document is issued *by a clinic* — so the brand belongs to the clinic
          rather than to the deployment.
        */}
        <Card>
          <CardHeader
            title="Branding and invoicing"
            description="Leave blank to use the chain brand. Only fill this in for a clinic that trades under its own name."
          />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field
              label="Trading name"
              htmlFor="brand_name"
              hint="Shown on invoices, receipts and treatment statements"
              error={fieldErrors.brand_name}
            >
              <Input
                id="brand_name"
                value={form.brand_name}
                onChange={update('brand_name')}
                placeholder="e.g. Physiocare by Dr Swati"
              />
            </Field>
            <Field label="Tagline" htmlFor="brand_tagline" error={fieldErrors.brand_tagline}>
              <Input
                id="brand_tagline"
                value={form.brand_tagline}
                onChange={update('brand_tagline')}
                placeholder="e.g. Bellandur"
              />
            </Field>
            <Field
              label="Logo file"
              htmlFor="logo_filename"
              hint="Filename in backend/app/assets/. A missing file falls back to the chain logo."
              error={fieldErrors.logo_filename}
            >
              <Input
                id="logo_filename"
                value={form.logo_filename}
                onChange={update('logo_filename')}
                placeholder="physiocare-logo.png"
              />
            </Field>
            <Field
              label="Invoice series"
              htmlFor="bill_number_prefix"
              hint="Blank uses the chain series (INV). Set only for a separate legal entity."
              error={fieldErrors.bill_number_prefix}
            >
              <Input
                id="bill_number_prefix"
                value={form.bill_number_prefix}
                onChange={update('bill_number_prefix')}
                placeholder="PC"
                maxLength={10}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Document footer"
                htmlFor="document_footer"
                hint="Registration or GST lines printed at the foot of invoices and statements"
                error={fieldErrors.document_footer}
              >
                <Input
                  id="document_footer"
                  value={form.document_footer}
                  onChange={update('document_footer')}
                  placeholder="Physiocare Pvt Ltd · GSTIN 29ABCDE1234F1Z5"
                />
              </Field>
            </div>
          </div>
          {form.bill_number_prefix.trim() && (
            <div className="px-5 pb-4">
              <Alert tone="warning">
                This clinic will issue its own invoice sequence
                (<strong>{form.bill_number_prefix.trim().toUpperCase()}-{new Date().getFullYear()}-000001</strong>),
                separate from the chain&apos;s. Set this only if it is a separate legal
                entity — changing it later leaves a gap in whichever series you move away
                from.
              </Alert>
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create clinic
          </Button>
        </div>
      </form>
    </>
  );
}
