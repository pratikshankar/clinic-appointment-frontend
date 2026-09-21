/**
 * Staff assignment for a clinic.
 *
 * Only Clinic Users are assignable: Superadmin and Admin reach every clinic by
 * role, so giving them a row here would imply their access is scoped when it is
 * not. The candidate list therefore filters to CLINIC_USER accounts.
 */

import { useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  RoleBadge,
  Select,
  Spinner,
  StatusBadge,
  Table,
  Td,
  Th,
} from '../ui';
import { useApi } from '../../hooks/useApi';
import { clinicService, userService } from '../../services';

export function StaffEditor({ clinicId, clinicName, canEdit }) {
  const { data: staff, loading, error, reload } = useApi(
    () => clinicService.staff(clinicId),
    [clinicId]
  );
  const { data: candidates } = useApi(
    () =>
      canEdit
        ? userService.list({ role: 'CLINIC_USER', page_size: 200 })
        : Promise.resolve({ items: [] }),
    [clinicId, canEdit]
  );

  const [form, setForm] = useState({ user_id: '', designation: '' });
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const assignedIds = new Set((staff ?? []).map((member) => member.user_id));
  const assignable = (candidates?.items ?? []).filter((user) => !assignedIds.has(user.id));

  async function assign(event) {
    event.preventDefault();
    if (!form.user_id) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await clinicService.assignStaff(clinicId, {
        user_id: Number(form.user_id),
        designation: form.designation?.trim() || null,
      });
      setForm({ user_id: '', designation: '' });
      await reload();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function unassign(userId) {
    setBusyId(userId);
    setSubmitError(null);
    try {
      await clinicService.unassignStaff(clinicId, userId);
      await reload();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Staff"
        description={`Clinic Users who can see and act on ${clinicName}'s data.`}
      />

      <div className="space-y-4 px-5 py-4">
        {error && (
          <Alert tone="error" title="Could not load staff">
            {error.message}
          </Alert>
        )}
        {submitError && (
          <Alert tone="error" onDismiss={() => setSubmitError(null)}>
            {submitError.message}
          </Alert>
        )}

        {loading ? (
          <div className="grid place-items-center py-8 text-brand-600">
            <Spinner />
          </div>
        ) : staff?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Designation</Th>
                <Th>Status</Th>
                {canEdit && <Th align="right">Action</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {staff.map((member) => (
                <tr key={member.user_id} className="hover:bg-ink-50/60">
                  <Td>
                    <div className="font-medium text-ink-900">{member.full_name}</div>
                    <div className="text-xs text-ink-500">{member.username}</div>
                  </Td>
                  <Td>
                    <RoleBadge role={member.role} />
                  </Td>
                  <Td>
                    {member.designation ?? '—'}
                    {member.is_primary && (
                      <Badge tone="brand" className="ml-2">
                        Primary
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge active={member.is_active} />
                  </Td>
                  {canEdit && (
                    <Td align="right">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === member.user_id}
                        onClick={() => unassign(member.user_id)}
                      >
                        Unassign
                      </Button>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="No staff assigned"
            description="Nobody can see this clinic's appointments yet."
          />
        )}

        {canEdit && (
          <form onSubmit={assign} className="rounded-lg bg-ink-50 px-4 py-3">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">
              Assign a Clinic User
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="User" htmlFor="staff-user" required>
                <Select
                  id="staff-user"
                  value={form.user_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, user_id: event.target.value }))
                  }
                  required
                >
                  <option value="">Select a user…</option>
                  {assignable.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.username})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Designation" htmlFor="staff-designation" hint="e.g. Receptionist">
                <Input
                  id="staff-designation"
                  value={form.designation}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, designation: event.target.value }))
                  }
                />
              </Field>
              <div className="flex items-end">
                <Button type="submit" loading={submitting} disabled={!form.user_id}>
                  Assign
                </Button>
              </div>
            </div>
            {assignable.length === 0 && (
              <p className="mt-2 text-xs text-ink-500">
                Every Clinic User is already assigned here. Create a new user from the Users
                page first.
              </p>
            )}
          </form>
        )}
      </div>
    </Card>
  );
}
