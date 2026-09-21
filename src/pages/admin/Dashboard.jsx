import { Button, PageHeader } from '../../components/ui';
import { ClinicListCard, DashboardContent } from '../../components/DashboardContent';
import { Icon } from '../../components/Icon';
import { useApi } from '../../hooks/useApi';
import { dashboardService } from '../../services';

const TILES = [
  { key: 'appointments_today', label: "Today's appointments", tone: 'brand' },
  { key: 'upcoming_appointments', label: 'Upcoming appointments' },
  { key: 'completed_today', label: 'Completed today', tone: 'positive' },
  { key: 'cancelled_today', label: 'Cancelled today', tone: 'danger' },
  { key: 'total_patients', label: 'Patients' },
  { key: 'patients_registered_today', label: 'Registered today' },
  { key: 'revenue_total', label: 'Revenue collected', money: true, tone: 'positive' },
  { key: 'outstanding_amount', label: 'Outstanding', money: true, tone: 'warning' },
];

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi(() => dashboardService.summary(), []);

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        description="Operational view across all clinics you manage."
        action={
          <Button variant="secondary" onClick={reload} loading={loading}>
            <Icon name="refresh" className="size-4" />
            Refresh
          </Button>
        }
      />

      <DashboardContent summary={data} loading={loading} error={error} tiles={TILES}>
        <ClinicListCard
          clinics={data?.clinics}
          loading={loading}
          title="Clinics you can operate"
          description="Admins reach every active clinic but cannot create or edit them."
          emptyHint="No clinics have been created yet."
        />
      </DashboardContent>
    </>
  );
}
