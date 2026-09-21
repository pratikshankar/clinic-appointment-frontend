/** Superadmin user management: list, filter, enable/disable, reset password. */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '../../components/Icon';
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
  RoleBadge,
  Select,
  Spinner,
  StatusBadge,
  Table,
  Td,
  Th,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { userService } from '../../services';
import { formatDateTime } from '../../utils/format';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [filters, setFilters] = useState({ search: '', role: '', is_active: '' });
  const [banner, setBanner] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);

  const { data, loading, error, reload } = useApi(
    () =>
      userService.list({
        search: filters.search || undefined,
        role: filters.role || undefined,
        is_active: filters.is_active || undefined,
        page_size: 100,
      }),
    [filters.search, filters.role, filters.is_active]
  );

  /**
   * Deleting is for an account created by mistake. The backend refuses once the
   * person has history, so the confirmation says what will be checked rather
   * than promising something it may not deliver.
   */
  async function removeUser(user) {
    const confirmed = window.confirm(
      `Delete ${user.full_name} (${user.username})?\n\n` +
        'This cannot be undone. It is refused if they have treated a patient or ' +
        'handled money — disable them instead in that case.',
    );
    if (!confirmed) return;

    setBusyId(user.id);
    setBanner(null);
    try {
      await userService.remove(user.id);
      await reload();
      setBanner({ tone: 'success', message: `${user.full_name} was deleted.` });
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(user) {
    setBusyId(user.id);
    setBanner(null);
    try {
      const action = user.is_active ? userService.disable : userService.enable;
      await action(user.id);
      setBanner({
        tone: 'success',
        message: `${user.full_name} was ${user.is_active ? 'disabled' : 'enabled'}.`,
      });
      await reload();
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setBusyId(null);
    }
  }

  const users = data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Users"
        description="Create and manage Admin and Clinic User accounts."
        action={
          <Link
            to="/superadmin/users/create"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <Icon name="users" className="size-4" />
            New user
          </Link>
        }
      />

      {banner && (
        <div className="mb-4">
          <Alert tone={banner.tone} onDismiss={() => setBanner(null)}>
            {banner.message}
          </Alert>
        </div>
      )}

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Search" htmlFor="search">
            <Input
              id="search"
              placeholder="Name, username or email"
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
            />
          </Field>
          <Field label="Role" htmlFor="role">
            <Select
              id="role"
              value={filters.role}
              onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))}
            >
              <option value="">All roles</option>
              <option value="SUPERADMIN">Superadmin</option>
              <option value="ADMIN">Admin</option>
              <option value="CLINIC_USER">Clinic User</option>
            </Select>
          </Field>
          <Field label="Status" htmlFor="status">
            <Select
              id="status"
              value={filters.is_active}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, is_active: event.target.value }))
              }
            >
              <option value="">All statuses</option>
              <option value="true">Active only</option>
              <option value="false">Disabled only</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        {error ? (
          <div className="p-5">
            <Alert tone="error" title="Could not load users">
              {error.message}
            </Alert>
          </div>
        ) : loading ? (
          <div className="grid place-items-center py-16 text-brand-600">
            <Spinner size="lg" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            title="No users match these filters"
            description="Try clearing the search box or switching the role filter."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Clinics</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.map((user) => {
                const isSelf = user.id === currentUser?.id;
                const isSuper = user.role === 'SUPERADMIN';
                return (
                  <tr key={user.id} className="hover:bg-ink-50/60">
                    <Td>
                      <div className="font-medium text-ink-900">{user.full_name}</div>
                      <div className="text-xs text-ink-500">
                        {user.username}
                        {user.email ? ` · ${user.email}` : ''}
                      </div>
                    </Td>
                    <Td>
                      <RoleBadge role={user.role} />
                    </Td>
                    <Td>
                      {user.clinics.length ? (
                        <div className="flex flex-wrap gap-1">
                          {user.clinics.map((clinic) => (
                            <Badge key={clinic.clinic_id} tone="info">
                              {clinic.clinic_code}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-400">All clinics</span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge active={user.is_active} />
                    </Td>
                    <Td>
                      <span className="text-xs text-ink-600">
                        {user.last_login_at ? formatDateTime(user.last_login_at) : 'Never'}
                      </span>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setResetTarget(user)}
                          disabled={isSuper && !isSelf}
                        >
                          Reset password
                        </Button>
                        <Button
                          size="sm"
                          variant={user.is_active ? 'danger' : 'primary'}
                          onClick={() => toggleActive(user)}
                          loading={busyId === user.id}
                          disabled={isSelf || isSuper}
                          title={
                            isSelf
                              ? 'You cannot disable your own account'
                              : isSuper
                                ? 'Superadmin accounts cannot be disabled'
                                : undefined
                          }
                        >
                          {user.is_active ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeUser(user)}
                          loading={busyId === user.id}
                          disabled={isSelf || isSuper}
                          title={
                            isSelf
                              ? 'You cannot delete your own account'
                              : isSuper
                                ? 'Superadmin accounts cannot be deleted'
                                : 'Delete an account created by mistake. Refused once they have history.'
                          }
                          aria-label={`Delete ${user.full_name}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <ResetPasswordModal
        user={resetTarget}
        onClose={() => setResetTarget(null)}
        onDone={(message) => {
          setResetTarget(null);
          setBanner({ tone: 'success', message });
        }}
      />
    </>
  );
}

function ResetPasswordModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await userService.resetPassword(user.id, password);
      setPassword('');
      onDone(`Password reset for ${user.full_name}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={user ? `Reset password — ${user.full_name}` : ''}
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field
          label="New password"
          htmlFor="new_password"
          required
          hint="At least 8 characters. Share it with the user over a private channel."
        >
          <Input
            id="new_password"
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Reset password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
