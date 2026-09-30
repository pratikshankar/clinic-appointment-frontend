/**
 * Patient list with search, filters and a chain-wide fallback lookup.
 *
 * Browsing is clinic-scoped by the API. When a scoped search finds nothing and
 * the term looks like a full mobile number or a Patient ID, the page offers an
 * explicit chain-wide lookup — the mechanism that stops a second Patient ID
 * being created for someone already registered at another branch.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Icon } from '../../components/Icon';
import {
  Alert,
  Badge,
  BottomSheet,
  Button,
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
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { clinicService, patientService, patientSourceService } from '../../services';
import { MIN_NAME_LOOKUP, lookupParamsFor } from '../../utils/patientLookup';
import { formatDate } from '../../utils/format';


export default function PatientList() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const basePath = role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';

  const [filters, setFilters] = useState({
    search: '',
    clinic_id: '',
    source_id: '',
    profile_complete: '',
    has_active_package: '',
    is_active: 'true',
  });
  const [chainResults, setChainResults] = useState(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: page, loading, error } = useApi(
    () =>
      patientService.list({
        search: filters.search || undefined,
        clinic_id: filters.clinic_id || undefined,
        source_id: filters.source_id || undefined,
        profile_complete: filters.profile_complete || undefined,
        has_active_package: filters.has_active_package || undefined,
        is_active: filters.is_active,
        page_size: 50,
      }),
    [
      filters.search,
      filters.clinic_id,
      filters.source_id,
      filters.profile_complete,
      filters.has_active_package,
      filters.is_active,
    ]
  );

  const { data: clinics } = useApi(() => clinicService.list(), []);
  const { data: sources } = useApi(() => patientSourceService.list(), []);

  const term = filters.search.trim();
  const lookupParams = lookupParamsFor(term);
  const lookupPossible = lookupParams !== null;
  const noLocalMatch = !loading && page && page.total === 0 && term.length > 0;

  async function chainLookup() {
    if (!lookupParams) return;
    setLookupBusy(true);
    setLookupError(null);
    try {
      setChainResults(await patientService.lookup(lookupParams));
    } catch (err) {
      setLookupError(err);
    } finally {
      setLookupBusy(false);
    }
  }

  function update(field) {
    return (event) => {
      setChainResults(null);
      setFilters((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  const patients = page?.items ?? [];

  return (
    <>
      <PageHeader
        title="Patients"
        description={
          role === 'CLINIC_USER'
            ? 'Patients at your clinic. If a search finds nothing here, search every clinic.'
            : 'Every patient in the chain, with their permanent Patient ID.'
        }
        action={
          <Link
            to={`${basePath}/patients/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <Icon name="user" className="size-4" />
            Register patient
          </Link>
        }
      />

      {/* Mobile: search + filter button */}
      <div className="mb-4 sm:hidden">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={filters.search}
              onChange={update('search')}
              placeholder="Name, mobile or PT-ID…"
            />
          </div>
          <Button variant="secondary" onClick={() => setFilterOpen(true)}>
            <Icon name="sliders" className="size-4" />
            Filter
          </Button>
        </div>
        <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter patients">
          <div className="space-y-4 py-2">
            {role !== 'CLINIC_USER' && (
              <Field label="Clinic" htmlFor="patient-clinic-m">
                <Select id="patient-clinic-m" value={filters.clinic_id} onChange={update('clinic_id')}>
                  <option value="">All clinics</option>
                  {(clinics ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Source" htmlFor="patient-source-m">
              <Select id="patient-source-m" value={filters.source_id} onChange={update('source_id')}>
                <option value="">All sources</option>
                {(sources ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Profile" htmlFor="patient-complete-m">
              <Select id="patient-complete-m" value={filters.profile_complete} onChange={update('profile_complete')}>
                <option value="">All profiles</option>
                <option value="false">Incomplete only</option>
                <option value="true">Complete only</option>
              </Select>
            </Field>
            <Field label="Package" htmlFor="patient-package-m">
              <Select id="patient-package-m" value={filters.has_active_package} onChange={update('has_active_package')}>
                <option value="">Any</option>
                <option value="false">No active package</option>
                <option value="true">Has active package</option>
              </Select>
            </Field>
            <Field label="Status" htmlFor="patient-active-m">
              <Select id="patient-active-m" value={filters.is_active} onChange={update('is_active')}>
                <option value="true">Active</option>
                <option value="false">Archived</option>
              </Select>
            </Field>
            <Button className="w-full" onClick={() => setFilterOpen(false)}>Apply</Button>
          </div>
        </BottomSheet>
      </div>

      {/* Desktop filter card */}
      <Card className="mb-4 hidden p-4 sm:block">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search" htmlFor="patient-search" hint="Name, mobile or Patient ID">
            <Input
              id="patient-search"
              value={filters.search}
              onChange={update('search')}
              placeholder="e.g. Rahul, 9876543210, PT-000001"
            />
          </Field>

          {role !== 'CLINIC_USER' && (
            <Field label="Clinic" htmlFor="patient-clinic">
              <Select id="patient-clinic" value={filters.clinic_id} onChange={update('clinic_id')}>
                <option value="">All clinics</option>
                {(clinics ?? []).map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Source" htmlFor="patient-source">
            <Select id="patient-source" value={filters.source_id} onChange={update('source_id')}>
              <option value="">All sources</option>
              {(sources ?? []).map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Profile" htmlFor="patient-complete">
            <Select
              id="patient-complete"
              value={filters.profile_complete}
              onChange={update('profile_complete')}
            >
              <option value="">All profiles</option>
              <option value="false">Incomplete only</option>
              <option value="true">Complete only</option>
            </Select>
          </Field>

          <Field label="Package" htmlFor="patient-package">
            <Select
              id="patient-package"
              value={filters.has_active_package}
              onChange={update('has_active_package')}
            >
              <option value="">Any</option>
              <option value="false">No active package</option>
              <option value="true">Has active package</option>
            </Select>
          </Field>

          <Field label="Status" htmlFor="patient-active">
            <Select id="patient-active" value={filters.is_active} onChange={update('is_active')}>
              <option value="true">Active</option>
              <option value="false">Archived</option>
            </Select>
          </Field>
        </div>
      </Card>

      {lookupError && (
        <div className="mb-4">
          <Alert tone="error" onDismiss={() => setLookupError(null)}>
            {lookupError.message}
          </Alert>
        </div>
      )}

      {chainResults !== null && (
        <div className="mb-4">
          {chainResults.length > 0 ? (
            <Alert tone="info" title="Found elsewhere in the chain">
              <ul className="mt-1 space-y-1.5">
                {chainResults.map((patient) => (
                  <li
                    key={patient.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 px-3 py-2"
                  >
                    <span className="text-sm">
                      <strong>{patient.full_name}</strong>{' '}
                      <span className="numeric text-xs text-ink-500">
                        {patient.patient_code}
                      </span>
                      <span className="text-xs text-ink-500">
                        {' '}
                        · {patient.mobile}
                        {patient.primary_clinic_name
                          ? ` · ${patient.primary_clinic_name}`
                          : ''}
                      </span>
                    </span>
                    {patient.in_your_scope ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`${basePath}/patients/${patient.id}`)}
                      >
                        Open
                      </Button>
                    ) : (
                      <Badge tone="warning">Another clinic — link via appointment</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : (
            <Alert tone="warning">
              No patient with that exact mobile number or Patient ID exists anywhere in the
              chain. It is safe to register a new one.
            </Alert>
          )}
        </div>
      )}

      <Card>
        {error ? (
          <div className="p-5">
            <Alert tone="error" title="Could not load patients">
              {error.message}
            </Alert>
          </div>
        ) : loading ? (
          <div className="grid place-items-center py-16 text-brand-600">
            <Spinner size="lg" />
          </div>
        ) : patients.length === 0 ? (
          <EmptyState
            title={term ? `No patient matches “${term}”` : 'No patients yet'}
            description={
              noLocalMatch && lookupPossible
                ? 'Not registered at your clinic. Check the rest of the chain before creating a new record — a patient keeps one Patient ID everywhere.'
                : noLocalMatch
                  ? `Type at least ${MIN_NAME_LOOKUP} characters to search other clinics.`
                  : 'Register a patient to get started.'
            }
            action={
              noLocalMatch && lookupPossible ? (
                <Button onClick={chainLookup} loading={lookupBusy}>
                  <Icon name="users" className="size-4" />
                  Search all clinics for “{term}”
                </Button>
              ) : (
                <Link
                  to={`${basePath}/patients/new`}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Register patient
                </Link>
              )
            }
          />
        ) : (
          <>
            {/* Mobile card list */}
            <div className="divide-y divide-ink-100 sm:hidden">
              {patients.map((patient) => (
                <div key={patient.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`${basePath}/patients/${patient.id}`}
                      className="font-medium text-brand-700"
                    >
                      {patient.full_name}
                    </Link>
                    <div className="flex shrink-0 gap-1">
                      {patient.is_profile_complete ? (
                        <Badge tone="success">Complete</Badge>
                      ) : (
                        <Badge tone="warning">Incomplete</Badge>
                      )}
                      {patient.has_active_package === false && (
                        <Badge tone="neutral">No pkg</Badge>
                      )}
                    </div>
                  </div>
                  <div className="numeric mt-0.5 text-xs text-ink-500">
                    {patient.patient_code}
                    {patient.age ? ` · ${patient.age}y` : ''}
                    {patient.gender ? ` · ${patient.gender.toLowerCase()}` : ''}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-500">
                    {patient.mobile}
                    {patient.primary_clinic_name ? ` · ${patient.primary_clinic_name}` : ''}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <thead>
                  <tr>
                    <Th>Patient</Th>
                    <Th>Mobile</Th>
                    <Th>Clinic</Th>
                    <Th>Source</Th>
                    <Th>Registered</Th>
                    <Th align="right">Profile</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {patients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-ink-50/60">
                      <Td>
                        <Link
                          to={`${basePath}/patients/${patient.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {patient.full_name}
                        </Link>
                        <div className="numeric text-xs text-ink-500">
                          {patient.patient_code}
                          {patient.age ? ` · ${patient.age}y` : ''}
                          {patient.gender ? ` · ${patient.gender.toLowerCase()}` : ''}
                        </div>
                      </Td>
                      <Td className="numeric">{patient.mobile}</Td>
                      <Td>{patient.primary_clinic_name ?? '—'}</Td>
                      <Td>{patient.source_name ?? '—'}</Td>
                      <Td>{formatDate(patient.registration_date)}</Td>
                      <Td align="right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {patient.is_profile_complete ? (
                            <Badge tone="success">Complete</Badge>
                          ) : (
                            <Badge tone="warning">Incomplete</Badge>
                          )}
                          {patient.has_active_package === false && (
                            <Badge tone="neutral">No package</Badge>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-5 py-2.5 text-xs text-ink-500">
              <span>
                Showing {patients.length} of {page.total} patient
                {page.total === 1 ? '' : 's'}
                {role === 'CLINIC_USER' ? ' at your clinic' : ''}
              </span>
              {lookupPossible && role === 'CLINIC_USER' && (
                <button
                  type="button"
                  onClick={chainLookup}
                  disabled={lookupBusy}
                  className="font-medium text-brand-700 hover:underline disabled:opacity-50"
                >
                  {lookupBusy ? 'Searching…' : 'Not the right person? Search all clinics'}
                </button>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  );
}
