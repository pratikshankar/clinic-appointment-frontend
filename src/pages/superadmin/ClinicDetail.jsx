/**
 * Clinic detail with tabbed configuration.
 *
 * Reachable by any role that can see the clinic; editing controls appear only
 * for the Superadmin, and the API refuses writes from anyone else regardless.
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AppointmentConfig } from '../../components/clinic/AppointmentConfig';
import { BrandingConfig } from '../../components/clinic/BrandingConfig';
import { BreaksEditor } from '../../components/clinic/BreaksEditor';
import { HolidaysEditor } from '../../components/clinic/HolidaysEditor';
import { StaffEditor } from '../../components/clinic/StaffEditor';
import { WorkingHoursEditor } from '../../components/clinic/WorkingHoursEditor';
import { Icon } from '../../components/Icon';
import {
  Alert,
  Badge,
  Button,
  Card,
  Modal,
  PageHeader,
  Spinner,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { clinicService } from '../../services';
import { ClinicDetailsForm } from './ClinicForm';

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'config', label: 'Appointment config' },
  { key: 'hours', label: 'Working hours' },
  { key: 'breaks', label: 'Breaks' },
  { key: 'holidays', label: 'Holidays' },
  { key: 'staff', label: 'Staff' },
];

export default function ClinicDetail() {
  const { clinicId } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const canEdit = role === 'SUPERADMIN';

  const [tab, setTab] = useState('details');
  const [banner, setBanner] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const { data: clinic, loading, error, reload } = useApi(
    () => clinicService.get(clinicId),
    [clinicId]
  );

  async function toggleStatus() {
    setStatusBusy(true);
    setBanner(null);
    try {
      const action = clinic.status === 'ACTIVE' ? clinicService.deactivate : clinicService.activate;
      const response = await action(clinic.id);
      setConfirmDeactivate(false);
      setBanner({
        tone: response.warnings?.length ? 'warning' : 'success',
        title:
          response.clinic.status === 'ACTIVE' ? 'Clinic activated' : 'Clinic deactivated',
        messages: response.warnings ?? [],
      });
      await reload();
    } catch (err) {
      setBanner({ tone: 'error', title: 'Could not change status', messages: [err.message] });
    } finally {
      setStatusBusy(false);
    }
  }

  if (loading) {
    return (
      <Card className="grid place-items-center py-20 text-brand-600">
        <Spinner size="lg" />
      </Card>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Clinic" breadcrumb={[{ label: 'Clinics', to: '/superadmin/clinics' }]} />
        <Alert tone="error" title="Could not load this clinic">
          {error.message}
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={clinic.name}
        backTo={canEdit ? '/superadmin/clinics' : '/admin/clinics'}
        backLabel="All clinics"
        breadcrumb={[
          { label: 'Clinics', to: canEdit ? '/superadmin/clinics' : '/admin/clinics' },
          { label: clinic.code },
        ]}
        description={[clinic.location, clinic.city].filter(Boolean).join(', ') || undefined}
        action={
          canEdit && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => navigate('/superadmin/clinics')}>
                Back to list
              </Button>
              <Button
                variant={clinic.status === 'ACTIVE' ? 'danger' : 'primary'}
                loading={statusBusy}
                onClick={() =>
                  clinic.status === 'ACTIVE' ? setConfirmDeactivate(true) : toggleStatus()
                }
              >
                {clinic.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={clinic.status === 'ACTIVE' ? 'success' : 'danger'}>{clinic.status}</Badge>
        <Badge tone="neutral">{clinic.code}</Badge>
        <span className="text-xs text-ink-500">
          {clinic.slot_duration_minutes} min slots · capacity {clinic.capacity_per_slot} ·{' '}
          {clinic.assigned_user_count} staff
        </span>
      </div>

      {banner && (
        <div className="mb-4">
          <Alert tone={banner.tone} title={banner.title} onDismiss={() => setBanner(null)}>
            {banner.messages?.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4">
                {banner.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </Alert>
        </div>
      )}

      {!canEdit && (
        <div className="mb-4">
          <Alert tone="info">
            You have read access to this clinic. Only a Superadmin can change its
            configuration.
          </Alert>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-ink-200">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={[
              '-mb-px whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-medium transition-colors',
              tab === item.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800',
            ].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <ClinicDetailsForm
          clinic={clinic}
          canEdit={canEdit}
          onSaved={async () => {
            setBanner({ tone: 'success', title: 'Clinic details saved', messages: [] });
            await reload();
          }}
        />
      )}

      {tab === 'config' && (
        <div className="space-y-4">
          <AppointmentConfig clinic={clinic} canEdit={canEdit} onSaved={reload} />
          <BrandingConfig clinic={clinic} canEdit={canEdit} onSaved={reload} />
        </div>
      )}

      {tab === 'hours' && (
        <WorkingHoursEditor clinicId={clinic.id} canEdit={canEdit} onSaved={reload} />
      )}

      {tab === 'breaks' && (
        <BreaksEditor clinicId={clinic.id} canEdit={canEdit} onChanged={reload} />
      )}

      {tab === 'holidays' && (
        <HolidaysEditor clinicId={clinic.id} clinicName={clinic.name} canEdit={canEdit} />
      )}

      {tab === 'staff' && (
        <StaffEditor clinicId={clinic.id} clinicName={clinic.name} canEdit={canEdit} />
      )}

      <Modal
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        title={`Deactivate ${clinic.name}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDeactivate(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={statusBusy} onClick={toggleStatus}>
              Deactivate clinic
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-ink-700">
          <p>
            The clinic stops accepting new bookings and disappears from active-clinic
            selectors.
          </p>
          <p>
            <strong>Existing appointments are kept.</strong> Any already booked stay visible and
            cancellable, so staff can contact those patients.
          </p>
          <p className="text-ink-500">You can reactivate the clinic at any time.</p>
        </div>
      </Modal>
    </>
  );
}
