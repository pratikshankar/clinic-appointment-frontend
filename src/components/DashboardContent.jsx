/**
 * Shared rendering for the three role dashboards.
 *
 * All three consume the same `GET /dashboard/summary` payload; the backend
 * decides which counters a role may see and omits the rest. This component
 * renders only what arrived, so the UI cannot invent a metric the caller is
 * not entitled to.
 */

import {
  Alert,
  Card,
  CardHeader,
  EmptyState,
  StatCard,
  Table,
  Td,
  Th,
  Badge,
} from './ui';
import { formatCurrency, formatDate, formatNumber } from '../utils/format';

/** Only render a tile when the API actually sent the value. */
function Tiles({ summary, loading, tiles }) {
  const visible = tiles.filter(
    ({ key }) => loading || (summary?.counters?.[key] ?? null) !== null
  );
  if (!visible.length) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {visible.map(({ key, label, tone, money, hint }) => {
        const raw = summary?.counters?.[key];
        return (
          <StatCard
            key={key}
            label={label}
            tone={tone}
            hint={hint}
            loading={loading}
            value={money ? formatCurrency(raw) : formatNumber(raw)}
          />
        );
      })}
    </div>
  );
}

export function DashboardContent({ summary, loading, error, tiles, children }) {
  if (error) {
    return (
      <Alert tone="error" title="Could not load the dashboard">
        {error.message}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Tiles summary={summary} loading={loading} tiles={tiles} />

      {summary && (
        <p className="text-xs text-ink-500">
          Scope: <span className="font-medium text-ink-700">{summary.scope_label}</span> · figures
          as of {formatDate(summary.as_of_date)}
        </p>
      )}

      {children}

      {summary?.clinic_performance?.length > 0 && (
        <Card>
          <CardHeader
            title="Clinic-wise performance"
            description="Live figures per location, from the same scoped queries as the tiles above."
          />
          <Table>
            <thead>
              <tr>
                <Th>Clinic</Th>
                <Th align="right">Patients</Th>
                <Th align="right">Today</Th>
                <Th align="right">Completed</Th>
                <Th align="right">Revenue</Th>
                <Th align="right">Outstanding</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {summary.clinic_performance.map((row) => (
                <tr key={row.clinic_id} className="hover:bg-ink-50/60">
                  <Td className="font-medium text-ink-900">{row.clinic_name}</Td>
                  <Td align="right">{formatNumber(row.total_patients)}</Td>
                  <Td align="right">{formatNumber(row.appointments_today)}</Td>
                  <Td align="right">{formatNumber(row.completed_today)}</Td>
                  <Td align="right">{formatCurrency(row.revenue)}</Td>
                  <Td align="right">
                    {Number(row.outstanding) > 0 ? (
                      <span className="font-medium text-amber-700">
                        {formatCurrency(row.outstanding)}
                      </span>
                    ) : (
                      formatCurrency(0)
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

    </div>
  );
}

export function ClinicListCard({ clinics, loading, title, description, emptyHint }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {loading ? (
        <div className="space-y-2 p-5">
          {[0, 1].map((row) => (
            <div key={row} className="h-9 animate-pulse rounded bg-ink-100" />
          ))}
        </div>
      ) : clinics?.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Clinic</Th>
              <Th>Code</Th>
              <Th>City</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {clinics.map((clinic) => (
              <tr key={clinic.id} className="hover:bg-ink-50/60">
                <Td className="font-medium text-ink-900">{clinic.name}</Td>
                <Td>
                  <span className="numeric text-xs text-ink-500">{clinic.code}</span>
                </Td>
                <Td>{clinic.city ?? '—'}</Td>
                <Td>
                  <Badge tone={clinic.status === 'ACTIVE' ? 'success' : 'danger'}>
                    {clinic.status}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="No clinics visible" description={emptyHint} />
      )}
    </Card>
  );
}
