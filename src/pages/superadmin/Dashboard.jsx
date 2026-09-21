import { Button, PageHeader } from '../../components/ui';
import { DashboardContent, ClinicListCard } from '../../components/DashboardContent';
import { Icon } from '../../components/Icon';
import { useApi } from '../../hooks/useApi';
import { dashboardService } from '../../services';

const TILES = [
  { key: 'total_clinics', label: 'Total clinics', tone: 'brand' },
  { key: 'active_clinics', label: 'Active clinics' },
  { key: 'total_patients', label: 'Total patients' },
  { key: 'total_users', label: 'User accounts' },
  { key: 'appointments_today', label: "Today's appointments", tone: 'brand' },
  { key: 'completed_today', label: 'Completed today', tone: 'positive' },
  { key: 'cancelled_today', label: 'Cancelled today', tone: 'danger' },
  { key: 'upcoming_appointments', label: 'Upcoming' },
  { key: 'revenue_total', label: 'Revenue collected', money: true, tone: 'positive' },
  { key: 'revenue_this_month', label: 'Collected this month', money: true },
  { key: 'outstanding_amount', label: 'Outstanding', money: true, tone: 'warning' },
  { key: 'unacknowledged_notifications', label: 'Unacknowledged alerts' },
];

export default function SuperadminDashboard() {
  const { data, loading, error, reload } = useApi(() => dashboardService.summary(), []);

  return (
    <>
      <PageHeader
        title="Superadmin dashboard"
        description="System-wide figures across every clinic in the chain."
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
          title="Clinics"
          description="Every location in the chain."
          emptyHint="Create your first clinic to start booking appointments."
        />
      </DashboardContent>
    </>
  );
}
