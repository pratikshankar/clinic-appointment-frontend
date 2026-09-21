/** Create an Admin or Clinic User. Talks to POST /api/users. */

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
  Select,
} from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { clinicService, userService } from '../../services';

const EMPTY = {
  username: '',
  full_name: '',
  email: '',
  phone: '',
  employee_id: '',
  registration_number: '',
  password: '',
  role: 'CLINIC_USER',
  clinic_id: '',
  designation: '',
};

export default function UserCreate() {
  const navigate = useNavigate();
  const { data: clinics } = useApi(() => clinicService.list({ status: 'ACTIVE' }), []);

  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const isClinicUser = form.role === 'CLINIC_USER';

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    // A Clinic User is scoped to a clinic; Admins are chain-wide and must not
    // carry clinic_ids at all (the API rejects that combination).
    const payload = {
      username: form.username.trim(),
      full_name: form.full_name.trim(),
      password: form.password,
      role: form.role,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      employee_id: form.employee_id.trim() || null,
      registration_number: form.registration_number.trim() || null,
      clinic_ids: isClinicUser && form.clinic_id ? [Number(form.clinic_id)] : [],
      designation: isClinicUser ? form.designation.trim() || null : null,
    };

    try {
      const created = await userService.create(payload);
      navigate('/superadmin/users', {
        replace: true,
        state: { created: created.username },
      });
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
        title="Create user"
        backTo="/superadmin/users"
        backLabel="All users"
        breadcrumb={[{ label: 'Users', to: '/superadmin/users' }, { label: 'Create' }]}
        description="Admins reach every clinic. Clinic Users are limited to the clinic you assign."
      />

      <form onSubmit={submit} className="max-w-2xl space-y-4">
        {error && <Alert tone="error" title="Could not create the user">{error}</Alert>}

        <Card>
          <CardHeader title="Role" />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field label="Role" htmlFor="role" required error={fieldErrors.role}>
              <Select id="role" value={form.role} onChange={update('role')} required>
                <option value="CLINIC_USER">Clinic User — one clinic</option>
                <option value="ADMIN">Admin — all clinics</option>
              </Select>
            </Field>

            {isClinicUser && (
              <>
                <Field
                  label="Assigned clinic"
                  htmlFor="clinic_id"
                  required
                  error={fieldErrors.clinic_ids}
                >
                  <Select
                    id="clinic_id"
                    value={form.clinic_id}
                    onChange={update('clinic_id')}
                    required
                    invalid={Boolean(fieldErrors.clinic_ids)}
                  >
                    <option value="">Select a clinic…</option>
                    {(clinics ?? []).map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.name} ({clinic.code})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Registration number"
                  htmlFor="registration_number"
                  hint="Physiotherapists only. Printed on treatment statements for insurers."
                  error={fieldErrors.registration_number}
                >
                  <Input
                    id="registration_number"
                    value={form.registration_number}
                    onChange={update('registration_number')}
                    placeholder="e.g. KSPC/PT/2019/4471"
                  />
                </Field>
                <Field label="Designation" htmlFor="designation" hint="e.g. Receptionist">
                  <Input
                    id="designation"
                    value={form.designation}
                    onChange={update('designation')}
                  />
                </Field>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Account details" />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field
              label="Full name"
              htmlFor="full_name"
              required
              error={fieldErrors.full_name}
            >
              <Input
                id="full_name"
                value={form.full_name}
                onChange={update('full_name')}
                required
                minLength={2}
                invalid={Boolean(fieldErrors.full_name)}
              />
            </Field>

            <Field
              label="Username"
              htmlFor="username"
              required
              hint="Letters, numbers, dot, dash, underscore"
              error={fieldErrors.username}
            >
              <Input
                id="username"
                value={form.username}
                onChange={update('username')}
                required
                minLength={3}
                pattern="[A-Za-z0-9._\-]+"
                autoComplete="off"
                invalid={Boolean(fieldErrors.username)}
              />
            </Field>

            <Field
              label="Employee ID"
              htmlFor="employee_id"
              hint="The clinic's own staff number. Optional, but unique when given."
              error={fieldErrors.employee_id}
            >
              <Input
                id="employee_id"
                value={form.employee_id}
                onChange={update('employee_id')}
                placeholder="e.g. EMP-014"
                invalid={Boolean(fieldErrors.employee_id)}
              />
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
              label="Mobile"
              htmlFor="phone"
              hint="10 digits, optionally +91"
              error={fieldErrors.phone}
            >
              <Input
                id="phone"
                value={form.phone}
                onChange={update('phone')}
                invalid={Boolean(fieldErrors.phone)}
              />
            </Field>

            <Field
              label="Temporary password"
              htmlFor="password"
              required
              hint="At least 8 characters; the user can change it after signing in"
              error={fieldErrors.password}
            >
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={update('password')}
                required
                minLength={8}
                autoComplete="new-password"
                invalid={Boolean(fieldErrors.password)}
              />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create user
          </Button>
        </div>
      </form>
    </>
  );
}
