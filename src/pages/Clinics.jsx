/**
 * Clinic list, shared by Superadmin and Admin.
 *
 * The Superadmin gets create and configure actions; the Admin gets the same
 * list read-only. Clinic Users reach their own clinic through their dashboard
 * rather than this page.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '../components/Icon';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Th,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { clinicService } from '../services';

export default function Clinics() {
  const { role } = useAuth();
  const canEdit = role === 'SUPERADMIN';
  const [filters, setFilters] = useState({ search: '', status: '' });

  const { data: clinics, loading, error } = useApi(
    () =>
      clinicService.list({
        search: filters.search || undefined,
        status: filters.status || undefined,
      }),
    [filters.search, filters.status]
  );

  const detailPath = (id) => (canEdit ? `/superadmin/clinics/${id}` : `/admin/clinics/${id}`);

  return (
    <>
      <PageHeader
        title="Clinics"
        description={
          canEdit
            ? 'Create clinics and configure their hours, capacity, holidays and staff.'
            : 'Locations you can operate. Only a Superadmin can create or edit clinics.'
        }
        action={
          canEdit && (
            <Link
              to="/superadmin/clinics/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              <Icon name="building" className="size-4" />
              New clinic
            </Link>
          )
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Search" htmlFor="clinic-search">
            <Input
              id="clinic-search"
              placeholder="Clinic name or code"
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
            />
          </Field>
          <Field label="Status" htmlFor="clinic-status">
            <Select
              id="clinic-status"
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        {error ? (
          <div className="p-5">
            <Alert tone="error" title="Could not load clinics">
              {error.message}
            </Alert>
          </div>
        ) : loading ? (
          <div className="grid place-items-center py-16 text-brand-600">
            <Spinner size="lg" />
          </div>
        ) : !clinics?.length ? (
          <EmptyState
            title="No clinics found"
            description={
              canEdit
                ? 'No clinic matches your filters. Create one to start booking appointments.'
                : 'No clinic matches your filters.'
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Clinic</Th>
                <Th>Code</Th>
                <Th>Location</Th>
                <Th>Status</Th>
                <Th align="right">{canEdit ? 'Configure' : 'View'}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {clinics.map((clinic) => (
                <tr key={clinic.id} className="hover:bg-ink-50/60">
                  <Td>
                    <Link
                      to={detailPath(clinic.id)}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {clinic.name}
                    </Link>
                  </Td>
                  <Td>
                    <span className="numeric text-xs text-ink-500">{clinic.code}</span>
                  </Td>
                  <Td>
                    {clinic.location ?? '—'}
                    {clinic.city ? <span className="text-ink-400">, {clinic.city}</span> : null}
                  </Td>
                  <Td>
                    <Badge tone={clinic.status === 'ACTIVE' ? 'success' : 'danger'}>
                      {clinic.status}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <Link
                      to={detailPath(clinic.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-ink-800 ring-1 ring-inset ring-ink-300 hover:bg-ink-50"
                    >
                      <Icon name="sliders" className="size-3.5" />
                      {canEdit ? 'Configure' : 'View'}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
