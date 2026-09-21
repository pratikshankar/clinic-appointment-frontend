/**
 * System settings: patient sources, the service catalogue and chain-wide
 * holidays (Sections 11 and 17).
 *
 * Sources are deactivated rather than deleted, because patients already
 * attributed to one must keep that attribution or Phase 8's acquisition reports
 * would quietly change as the list is edited. Services follow the same rule for
 * the same reason: bills already issued must keep pointing at what was sold.
 */

import { useState } from 'react';

import { Icon } from '../../components/Icon';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
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
import { useApi } from '../../hooks/useApi';
import { billingService, clinicService, holidayService, patientSourceService } from '../../services';
import { formatDate, formatMoney } from '../../utils/format';

function PatientSources() {
  const { data: sources, loading, error, reload } = useApi(
    () => patientSourceService.list(),
    []
  );
  const [form, setForm] = useState({ name: '', sort_order: '' });
  const [banner, setBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');

  async function create(event) {
    event.preventDefault();
    setSubmitting(true);
    setBanner(null);
    try {
      await patientSourceService.create({
        name: form.name.trim(),
        sort_order: form.sort_order === '' ? 0 : Number(form.sort_order),
        is_active: true,
      });
      setForm({ name: '', sort_order: '' });
      await reload();
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(source) {
    setBusyId(source.id);
    setBanner(null);
    try {
      await patientSourceService.update(source.id, { is_active: !source.is_active });
      await reload();
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setBusyId(null);
    }
  }

  async function saveRename(source) {
    setBusyId(source.id);
    setBanner(null);
    try {
      await patientSourceService.update(source.id, { name: editName.trim() });
      setEditing(null);
      await reload();
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Patient sources"
        description="Where patients come from. Used by the patient registration form and by acquisition reports."
      />

      <div className="space-y-4 px-5 py-4">
        {banner && (
          <Alert tone={banner.tone} onDismiss={() => setBanner(null)}>
            {banner.message}
          </Alert>
        )}
        {error && (
          <Alert tone="error" title="Could not load sources">
            {error.message}
          </Alert>
        )}

        {loading ? (
          <div className="grid place-items-center py-8 text-brand-600">
            <Spinner />
          </div>
        ) : sources?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Source</Th>
                <Th align="right">Patients</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {sources.map((source) => (
                <tr key={source.id} className="hover:bg-ink-50/60">
                  <Td>
                    {editing === source.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className="w-48"
                          aria-label="Source name"
                        />
                        <Button
                          size="sm"
                          loading={busyId === source.id}
                          onClick={() => saveRename(source)}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <span className="font-medium text-ink-900">{source.name}</span>
                    )}
                  </Td>
                  <Td align="right">{source.patient_count}</Td>
                  <Td>
                    <Badge tone={source.is_active ? 'success' : 'neutral'}>
                      {source.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1.5">
                      {editing !== source.id && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditing(source.id);
                            setEditName(source.name);
                          }}
                        >
                          Rename
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={source.is_active ? 'secondary' : 'primary'}
                        loading={busyId === source.id && editing !== source.id}
                        onClick={() => toggleActive(source)}
                        title={
                          source.patient_count > 0
                            ? `${source.patient_count} patient(s) keep this source either way`
                            : undefined
                        }
                      >
                        {source.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No patient sources" description="Add one to get started." />
        )}

        <form onSubmit={create} className="rounded-lg bg-ink-50 px-4 py-3">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">
            Add a source
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" htmlFor="source-name" required>
              <Input
                id="source-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. Billboard"
                required
                minLength={2}
              />
            </Field>
            <Field label="Sort order" htmlFor="source-order" hint="Lower appears first">
              <Input
                id="source-order"
                type="number"
                min={0}
                max={999}
                value={form.sort_order}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sort_order: event.target.value }))
                }
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" loading={submitting} disabled={!form.name.trim()}>
                <Icon name="check" className="size-4" />
                Add source
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Card>
  );
}

function ChainWideHolidays() {
  const { data: holidays, loading, error, reload } = useApi(() => holidayService.list(), []);
  const [form, setForm] = useState({ holiday_date: '', reason: '' });
  const [banner, setBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const chainWide = (holidays ?? []).filter((holiday) => holiday.clinic_id === null);

  async function add(event) {
    event.preventDefault();
    setSubmitting(true);
    setBanner(null);
    try {
      await holidayService.add({
        clinic_id: null,
        holiday_date: form.holiday_date,
        reason: form.reason?.trim() || null,
      });
      setForm({ holiday_date: '', reason: '' });
      await reload();
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(holidayId) {
    setBusyId(holidayId);
    try {
      await holidayService.remove(holidayId);
      await reload();
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Chain-wide holidays"
        description="Closes every clinic on that date. Per-clinic closures live on each clinic's Holidays tab."
      />
      <div className="space-y-4 px-5 py-4">
        {banner && (
          <Alert tone={banner.tone} onDismiss={() => setBanner(null)}>
            {banner.message}
          </Alert>
        )}
        {error && (
          <Alert tone="error" title="Could not load holidays">
            {error.message}
          </Alert>
        )}

        {loading ? (
          <div className="grid place-items-center py-8 text-brand-600">
            <Spinner />
          </div>
        ) : chainWide.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Reason</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {chainWide.map((holiday) => (
                <tr key={holiday.id} className="hover:bg-ink-50/60">
                  <Td className="font-medium text-ink-900">{formatDate(holiday.holiday_date)}</Td>
                  <Td>{holiday.reason ?? '—'}</Td>
                  <Td align="right">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyId === holiday.id}
                      onClick={() => remove(holiday.id)}
                    >
                      Remove
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="No chain-wide holidays"
            description="Add national holidays here once instead of per clinic."
          />
        )}

        <form onSubmit={add} className="rounded-lg bg-ink-50 px-4 py-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date" htmlFor="chain-holiday-date" required>
              <Input
                id="chain-holiday-date"
                type="date"
                value={form.holiday_date}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, holiday_date: event.target.value }))
                }
                required
              />
            </Field>
            <Field label="Reason" htmlFor="chain-holiday-reason">
              <Input
                id="chain-holiday-reason"
                value={form.reason}
                onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                placeholder="e.g. Diwali"
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" loading={submitting} disabled={!form.holiday_date}>
                Add holiday
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Card>
  );
}

const ITEM_TYPES = [
  { value: 'CONSULTATION', label: 'Consultation' },
  { value: 'SESSION_PACKAGE', label: 'Therapy / session' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * The catalogue of chargeable services (Section 17).
 *
 * Prices set here are *defaults*. They are copied onto a bill line when the
 * service is added, and the line keeps its own copy — so repricing a service
 * changes what the next patient is quoted without rewriting bills already
 * issued. That is also why a service is deactivated, never deleted.
 */
function ServiceCatalogue() {
  const { data: services, loading, error, reload } = useApi(
    () => billingService.serviceItems(),
    [],
  );
  const { data: clinics } = useApi(() => clinicService.list({ status: 'ACTIVE' }), []);

  const [form, setForm] = useState({
    name: '',
    default_price: '',
    item_type: 'CONSULTATION',
    clinic_id: '',
  });
  const [banner, setBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function create(event) {
    event.preventDefault();
    setSubmitting(true);
    setBanner(null);
    try {
      await billingService.createServiceItem({
        name: form.name.trim(),
        default_price: form.default_price || '0',
        item_type: form.item_type,
        clinic_id: form.clinic_id ? Number(form.clinic_id) : null,
      });
      setForm({ name: '', default_price: '', item_type: 'CONSULTATION', clinic_id: '' });
      await reload();
      setBanner({ tone: 'success', message: 'Service added.' });
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(service) {
    setBusyId(service.id);
    setBanner(null);
    try {
      await billingService.updateServiceItem(service.id, { is_active: !service.is_active });
      await reload();
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setBusyId(null);
    }
  }

  async function reprice(service, value) {
    const price = value.trim();
    if (price === '' || price === String(service.default_price)) return;
    setBusyId(service.id);
    setBanner(null);
    try {
      await billingService.updateServiceItem(service.id, { default_price: price });
      await reload();
      setBanner({
        tone: 'success',
        message: `${service.name} now defaults to ${formatMoney(price)}. Bills already issued are unchanged.`,
      });
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Services and charges"
        description="Consultation fees, add-on therapies and products staff can put on a bill. Leave the clinic blank to offer a service across the chain."
      />

      <div className="space-y-4 px-5 py-4">
        {banner && (
          <Alert tone={banner.tone} onDismiss={() => setBanner(null)}>
            {banner.message}
          </Alert>
        )}
        {error && (
          <Alert tone="error" title="Could not load services">
            {error.message}
          </Alert>
        )}

        {loading ? (
          <div className="grid place-items-center py-8 text-brand-600">
            <Spinner />
          </div>
        ) : services?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Service</Th>
                <Th>Type</Th>
                <Th>Scope</Th>
                <Th align="right">Default price</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-ink-50/60">
                  <Td className="font-medium text-ink-900">{service.name}</Td>
                  <Td className="text-ink-600">
                    {ITEM_TYPES.find((t) => t.value === service.item_type)?.label ??
                      service.item_type}
                  </Td>
                  <Td className="text-ink-600">
                    {service.clinic_name ?? <Badge tone="brand">All clinics</Badge>}
                  </Td>
                  <Td align="right">
                    <Input
                      aria-label={`Default price for ${service.name}`}
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={service.default_price}
                      disabled={busyId === service.id}
                      className="w-28 text-right"
                      onBlur={(event) => reprice(service, event.target.value)}
                    />
                  </Td>
                  <Td>
                    <Badge tone={service.is_active ? 'success' : 'neutral'}>
                      {service.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyId === service.id}
                      onClick={() => toggleActive(service)}
                    >
                      {service.is_active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="No services yet"
            description="Add a consultation fee or an add-on therapy so staff can bill it in one click."
          />
        )}

        <form onSubmit={create} className="border-t border-ink-100 pt-4">
          <div className="grid items-end gap-3 sm:grid-cols-5">
            <Field label="Service name" htmlFor="service_name" required>
              <Input
                id="service_name"
                value={form.name}
                onChange={update('name')}
                placeholder="e.g. Laser therapy"
                required
                minLength={2}
              />
            </Field>
            <Field label="Type" htmlFor="service_type">
              <Select id="service_type" value={form.item_type} onChange={update('item_type')}>
                {ITEM_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Default price" htmlFor="service_price">
              <Input
                id="service_price"
                type="number"
                min={0}
                step="0.01"
                value={form.default_price}
                onChange={update('default_price')}
                placeholder="500.00"
              />
            </Field>
            <Field label="Clinic" htmlFor="service_clinic" hint="Blank = all clinics">
              <Select id="service_clinic" value={form.clinic_id} onChange={update('clinic_id')}>
                <option value="">All clinics</option>
                {(clinics ?? []).map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" loading={submitting} disabled={form.name.trim().length < 2}>
              <Icon name="check" className="size-4" />
              Add service
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

export default function Settings() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Chain-wide configuration used across every clinic."
      />
      <div className="space-y-4">
        <PatientSources />
        <ServiceCatalogue />
        <ChainWideHolidays />
      </div>
    </>
  );
}
