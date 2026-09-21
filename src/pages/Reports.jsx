/**
 * Reports (Phase 8).
 *
 * One filter bar and one export button drive all five reports, because the
 * questions differ but the way you ask them does not: a date range and
 * optionally a clinic.
 *
 * Charts are deliberately plain inline SVG bars rather than a charting library.
 * The only shapes needed are "value per day" and "share of a total"; adding
 * ~100 KB of dependency to draw a rectangle is not a trade worth making, and a
 * bar whose label states its own number is more readable at a glance anyway.
 */

import { useState } from 'react';

import { Icon } from '../components/Icon';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Spinner,
  StatCard,
  Table,
  Td,
  Th,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { clinicService, reportService, saveBlob } from '../services';
import { formatDate, formatMoney, formatNumber } from '../utils/format';

const REPORTS = [
  { key: 'month-comparison', label: 'Month on month' },
  { key: 'clinics', label: 'Clinics' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'patient-sources', label: 'Patient sources' },
  { key: 'retention', label: 'Drop-offs' },
];

/**
 * Month-on-month asks a different question of time — "up to which day?" rather
 * than "between which dates?" — so it swaps the range picker for a single date.
 */
const USES_AS_OF = 'month-comparison';

/** Slice colours for the source donut, walked in order. */
const PIE_COLOURS = [
  '#1C7FC4', '#123A6E', '#38BDF8', '#0E7490', '#7C3AED',
  '#DB2777', '#EA580C', '#65A30D', '#64748B',
];

const STATUS_TONES = {
  BOOKED: 'info',
  CONFIRMED: 'brand',
  CHECKED_IN: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  RESCHEDULED: 'neutral',
  NO_SHOW: 'danger',
};

function isoDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Horizontal bars, sized against the largest value in the set. */
function BarList({ rows, labelKey, valueKey, format = formatNumber, empty = 'No data' }) {
  if (!rows?.length) return <p className="px-5 py-4 text-sm text-ink-500">{empty}</p>;
  const max = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1);

  return (
    <ul className="space-y-2 px-5 py-4">
      {rows.map((row) => {
        const value = Number(row[valueKey]) || 0;
        return (
          <li key={row[labelKey]}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-ink-700">{row[labelKey]}</span>
              <span className="numeric shrink-0 font-medium text-ink-900">
                {format(row[valueKey])}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max((value / max) * 100, 2)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Donut chart, drawn with one SVG circle per slice using `stroke-dasharray`.
 *
 * A donut rather than a full pie: the hole gives somewhere to put the total,
 * which is the number people actually want next to the proportions.
 */
function Donut({ rows, labelKey, valueKey, total, caption }) {
  const data = (rows ?? []).filter((row) => Number(row[valueKey]) > 0);
  if (!data.length) {
    return <p className="px-5 py-4 text-sm text-ink-500">Nothing to chart in this range.</p>;
  }

  const sum = data.reduce((acc, row) => acc + Number(row[valueKey]), 0) || 1;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6 px-5 py-4 sm:flex-row sm:items-start">
      <svg viewBox="0 0 200 200" className="size-48 shrink-0 -rotate-90">
        {data.map((row, index) => {
          const share = Number(row[valueKey]) / sum;
          const dash = share * circumference;
          const circle = (
            <circle
              key={row[labelKey]}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={PIE_COLOURS[index % PIE_COLOURS.length]}
              strokeWidth="34"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            >
              <title>{`${row[labelKey]}: ${row[valueKey]} (${Math.round(share * 100)}%)`}</title>
            </circle>
          );
          offset += dash;
          return circle;
        })}
      </svg>

      <div className="min-w-0 flex-1">
        {total !== undefined && (
          <p className="mb-2 text-sm text-ink-600">
            <span className="numeric text-2xl font-semibold text-ink-900">{total}</span>{' '}
            {caption}
          </p>
        )}
        <ul className="space-y-1.5">
          {data.map((row, index) => (
            <li key={row[labelKey]} className="flex items-center gap-2 text-sm">
              <span
                className="size-3 shrink-0 rounded-sm"
                style={{ background: PIE_COLOURS[index % PIE_COLOURS.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-ink-700">{row[labelKey]}</span>
              <span className="numeric shrink-0 font-medium text-ink-900">
                {row[valueKey]}
              </span>
              <span className="numeric w-12 shrink-0 text-right text-xs text-ink-500">
                {Math.round((Number(row[valueKey]) / sum) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Signed percentage change, coloured by direction. `null` means no baseline. */
function Change({ value, suffix = 'vs last month' }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-ink-400">no comparable period</span>;
  }
  const up = value >= 0;
  return (
    <span className={`text-xs font-medium ${up ? 'text-emerald-700' : 'text-red-600'}`}>
      {up ? '▲' : '▼'} {Math.abs(value)}% {suffix}
    </span>
  );
}

/** Daily volume as a column chart. Bars carry their value in the tooltip. */
function DailyChart({ rows, valueKey, format = formatNumber, label }) {
  if (!rows?.length) {
    return <p className="px-5 py-4 text-sm text-ink-500">Nothing in this range.</p>;
  }
  const max = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1);

  return (
    <div className="px-5 py-4">
      <div className="flex h-40 items-end gap-1 overflow-x-auto">
        {rows.map((row) => {
          const value = Number(row[valueKey]) || 0;
          return (
            <div
              key={row.date}
              className="flex min-w-3 flex-1 flex-col items-center justify-end gap-1"
              title={`${formatDate(row.date)} · ${format(row[valueKey])}`}
            >
              <div
                className="w-full rounded-t bg-brand-500/80 transition-colors hover:bg-brand-600"
                style={{ height: `${Math.max((value / max) * 100, 1)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-500">
        <span>{formatDate(rows[0].date)}</span>
        <span>
          {label} · peak {format(max)}
        </span>
        <span>{formatDate(rows[rows.length - 1].date)}</span>
      </div>
    </div>
  );
}

export default function Reports() {
  const { role } = useAuth();
  const isClinicUser = role === 'CLINIC_USER';

  const [name, setName] = useState('month-comparison');
  const [filters, setFilters] = useState({
    from: isoDaysAgo(29),
    to: new Date().toISOString().slice(0, 10),
    clinic_id: '',
    // Defaults to yesterday: today is still in progress, and counting a
    // half-finished day makes the current month look worse than it is.
    as_of: isoDaysAgo(1),
    months: '4',
  });
  const asOfMode = name === USES_AS_OF;
  const [exporting, setExporting] = useState(false);
  const [banner, setBanner] = useState(null);

  const { data: clinics } = useApi(() => clinicService.list({ status: 'ACTIVE' }), []);

  const params = asOfMode
    ? {
        as_of: filters.as_of,
        months: Number(filters.months),
        ...(filters.clinic_id ? { clinic_id: Number(filters.clinic_id) } : {}),
      }
    : {
        from: filters.from,
        to: filters.to,
        ...(filters.clinic_id ? { clinic_id: Number(filters.clinic_id) } : {}),
      };

  const { data, loading, error, reload } = useApi(
    () => (asOfMode ? reportService.monthComparison(params) : reportService.run(name, params)),
    [name, filters.from, filters.to, filters.clinic_id, filters.as_of, filters.months],
  );

  /**
   * Only render a report from *its own* payload.
   *
   * `useApi` refetches from an effect, which runs after the render that already
   * has the new `name`. So for one frame after a tab switch, `name` is the new
   * report while `data` is still the previous one — and rendering the revenue
   * view against a clinics payload crashed on `undefined.map()`. The response
   * carries the report it answered for, so that is what decides.
   */
  const showing = asOfMode
    ? (data?.as_of !== undefined ? data : null)
    : data?.report === name
      ? data
      : null;
  const busy = loading || (!error && !showing);

  const update = (field) => (event) =>
    setFilters((prev) => ({ ...prev, [field]: event.target.value }));

  async function exportCsv() {
    setExporting(true);
    setBanner(null);
    try {
      saveBlob(
        asOfMode
          ? await reportService.monthComparisonCsv(params)
          : await reportService.csv(name, params),
      );
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description={
          isClinicUser
            ? 'Activity and revenue for your clinic.'
            : 'Activity and revenue across the chain.'
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={reload} loading={loading}>
              <Icon name="refresh" className="size-4" />
              Refresh
            </Button>
            <Button loading={exporting} onClick={exportCsv}>
              <Icon name="list" className="size-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      {banner && (
        <div className="mb-4">
          <Alert tone={banner.tone} onDismiss={() => setBanner(null)}>
            {banner.message}
          </Alert>
        </div>
      )}

      {/* Report chooser */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-white p-1 ring-1 ring-inset ring-ink-200">
        {REPORTS.map((report) => (
          <button
            key={report.key}
            type="button"
            onClick={() => setName(report.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              name === report.key
                ? 'bg-brand-600 text-white'
                : 'text-ink-700 hover:bg-ink-100'
            }`}
          >
            {report.label}
          </button>
        ))}
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
          {asOfMode ? (
            <>
              <label className="flex items-center gap-2 text-sm text-ink-600">
                <span className="shrink-0">Up to</span>
                <Input
                  aria-label="Compare up to this day of the month"
                  type="date"
                  value={filters.as_of}
                  onChange={update('as_of')}
                />
              </label>
              <Select
                aria-label="Months to compare"
                value={filters.months}
                onChange={update('months')}
              >
                {[3, 4, 6, 12].map((count) => (
                  <option key={count} value={count}>
                    Last {count} months
                  </option>
                ))}
              </Select>
            </>
          ) : (
            <>
              <Input aria-label="From" type="date" value={filters.from} onChange={update('from')} />
              <Input aria-label="To" type="date" value={filters.to} onChange={update('to')} />
            </>
          )}
          {!isClinicUser && (
            <Select
              aria-label="Clinic"
              value={filters.clinic_id}
              onChange={update('clinic_id')}
            >
              <option value="">All clinics</option>
              {(clinics ?? []).map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </Card>

      {error && (
        <Alert tone="error" title="Could not run this report">
          {error.message}
        </Alert>
      )}

      {error ? null : busy ? (
        <Card className="grid place-items-center py-20 text-brand-600">
          <Spinner size="lg" />
        </Card>
      ) : (
        <>
          <p className="mb-4 text-xs text-ink-500">
            {asOfMode
              ? `Each month counted to day ${showing.day_of_month}, so part-months are compared like for like`
              : `${formatDate(showing.date_from)} to ${formatDate(showing.date_to)} · ${showing.days} day${showing.days === 1 ? '' : 's'}`}
          </p>

          {name === 'month-comparison' && <MonthComparison data={showing} />}
          {name === 'retention' && <RetentionReport data={showing} />}
          {name === 'clinics' && <ClinicReport data={showing} />}
          {name === 'revenue' && <RevenueReport data={showing} />}
          {name === 'appointments' && <AppointmentReport data={showing} />}
          {name === 'sessions' && <SessionReport data={showing} />}
          {name === 'patient-sources' && <SourceReport data={showing} />}
        </>
      )}
    </>
  );
}

function ClinicReport({ data }) {
  const rows = data.rows ?? [];
  const totals = data.totals ?? {};
  if (!rows.length) {
    return <EmptyState title="No clinics in scope" description="Nothing to report." />;
  }
  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Appointments" value={formatNumber(totals.appointments)} />
        <StatCard label="Sessions" value={formatNumber(totals.sessions)} tone="brand" />
        <StatCard label="Collected" value={formatMoney(totals.collected)} tone="positive" />
        <StatCard
          label="Outstanding"
          value={formatMoney(totals.outstanding)}
          tone={Number(totals.outstanding) > 0 ? 'warning' : 'default'}
        />
      </div>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Clinic</Th>
              <Th align="right">Appts</Th>
              <Th align="right">Completed</Th>
              <Th align="right">No shows</Th>
              <Th align="right">Sessions</Th>
              <Th align="right">New patients</Th>
              <Th align="right">Billed</Th>
              <Th align="right">Collected</Th>
              <Th align="right">Outstanding</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((row) => (
              <tr key={row.clinic_id} className="hover:bg-ink-50/60">
                <Td className="font-medium text-ink-900">{row.clinic_name}</Td>
                <Td align="right">{row.appointments}</Td>
                <Td align="right">{row.completed}</Td>
                <Td align="right">{row.no_shows}</Td>
                <Td align="right">{row.sessions}</Td>
                <Td align="right">{row.new_patients}</Td>
                <Td align="right" className="numeric">
                  {formatMoney(row.billed)}
                </Td>
                <Td align="right" className="numeric">
                  {formatMoney(row.collected)}
                </Td>
                <Td align="right" className="numeric">
                  {Number(row.outstanding) > 0 ? (
                    <span className="font-medium text-amber-700">
                      {formatMoney(row.outstanding)}
                    </span>
                  ) : (
                    formatMoney(0)
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-ink-200 bg-ink-50 font-semibold">
            <tr>
              <Td>Total</Td>
              <Td align="right">{totals.appointments}</Td>
              <Td align="right">{totals.completed}</Td>
              <Td align="right">{totals.no_shows}</Td>
              <Td align="right">{totals.sessions}</Td>
              <Td align="right">{totals.new_patients}</Td>
              <Td align="right" className="numeric">
                {formatMoney(totals.billed)}
              </Td>
              <Td align="right" className="numeric">
                {formatMoney(totals.collected)}
              </Td>
              <Td align="right" className="numeric">
                {formatMoney(totals.outstanding)}
              </Td>
            </tr>
          </tfoot>
        </Table>
      </Card>
    </>
  );
}

function RevenueReport({ data }) {
  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Billed" value={formatMoney(data.billed)} />
        <StatCard label="Collected" value={formatMoney(data.collected)} tone="positive" />
        <StatCard
          label="Outstanding"
          value={formatMoney(data.outstanding)}
          tone={Number(data.outstanding) > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Collection rate"
          value={`${data.collection_rate}%`}
          tone="brand"
          hint="Money in vs value invoiced"
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Bills raised" value={formatNumber(data.bills)} />
        <StatCard label="Average bill" value={formatMoney(data.average_bill)} />
        <StatCard
          label="Average per patient"
          value={formatMoney(data.average_per_patient)}
          hint={`${data.paying_patients ?? 0} patient(s) billed`}
        />
      </div>

      {/*
        Billed is dated by invoice, collected by when the money actually arrived,
        so the two need not match over a short window. Saying so prevents the
        difference being read as an error.
      */}
      <Alert tone="info">
        <strong>Billed</strong> is the value of invoices raised in this range;{' '}
        <strong>collected</strong> is money that arrived in it, which may settle an
        earlier invoice. <strong>Outstanding</strong> is what is still owed on invoices
        raised in this range.
      </Alert>
      <div className="h-4" />

      <div className="space-y-4">
        <Card>
          <CardHeader title="Daily" description="Collected per day in this range." />
          <DailyChart rows={data.daily} valueKey="collected" format={formatMoney} label="Collected" />
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="By payment method" />
            <BarList
              rows={(data.by_payment_method ?? []).map((row) => ({
                ...row,
                label: row.payment_method.replace('_', ' '),
              }))}
              labelKey="label"
              valueKey="amount"
              format={formatMoney}
            />
          </Card>
          <Card>
            <CardHeader title="By clinic" />
            <BarList
              rows={data.by_clinic ?? []}
              labelKey="clinic_name"
              valueKey="collected"
              format={formatMoney}
            />
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Top services by revenue"
            description="From invoice line items — the charge, not the payment."
          />
          <BarList
            rows={data.by_service ?? []}
            labelKey="description"
            valueKey="amount"
            format={formatMoney}
          />
        </Card>
      </div>
    </>
  );
}

function AppointmentReport({ data }) {
  const statuses = Object.entries(data.by_status ?? {});
  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Appointments"
          value={formatNumber(data.total)}
          hint={`${data.new_patients ?? 0} new + ${data.returning_patients ?? 0} returning patients`}
        />
        <StatCard label="Completion rate" value={`${data.completion_rate}%`} tone="positive" />
        <StatCard
          label="No-show rate"
          value={`${data.no_show_rate}%`}
          tone={data.no_show_rate > 10 ? 'warning' : 'default'}
        />
        <StatCard label="Cancellation rate" value={`${data.cancellation_rate}%`} />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="New vs returning"
            description="A patient counts as new when their first ever appointment falls in this range — acquisition, as against repeat business."
          />
          <Donut
            rows={[
              {
                label: 'New patients',
                appointments: data.new_patient_appointments ?? 0,
              },
              {
                label: 'Returning patients',
                appointments: data.returning_patient_appointments ?? 0,
              },
            ]}
            labelKey="label"
            valueKey="appointments"
            total={data.total}
            caption="appointments"
          />
        </Card>

        <Card>
          <CardHeader title="Daily volume" />
          <DailyChart rows={data.daily} valueKey="appointments" label="Appointments" />
        </Card>

        {/* Staffing signal: which day and which hour actually carry the load. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="By weekday" description="Where to put your therapists." />
            <BarList
              rows={data.by_weekday ?? []}
              labelKey="weekday"
              valueKey="appointments"
              empty="No appointments in this range."
            />
          </Card>
          <Card>
            <CardHeader title="By hour" description="Peak times within the day." />
            <BarList
              rows={data.by_hour ?? []}
              labelKey="label"
              valueKey="appointments"
              empty="No appointments in this range."
            />
          </Card>
        </div>

        <Card>
          <CardHeader
            title="By status"
            description={
              data.busiest_day
                ? `Busiest day: ${formatDate(data.busiest_day.date)} (${data.busiest_day.appointments})`
                : undefined
            }
          />
          {statuses.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-500">No appointments in this range.</p>
          ) : (
            <div className="flex flex-wrap gap-2 px-5 py-4">
              {statuses.map(([status, count]) => (
                <span key={status} className="flex items-center gap-1.5">
                  <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{status}</Badge>
                  <span className="numeric text-sm font-medium text-ink-900">{count}</span>
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function SessionReport({ data }) {
  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sessions delivered" value={formatNumber(data.total)} tone="brand" />
        <StatCard label="Average per day" value={data.average_per_day} />
        <StatCard
          label="Utilisation"
          value={`${data.utilisation_rate}%`}
          hint={`${data.sessions_used} of ${data.sessions_purchased} purchased`}
        />
        <StatCard
          label="Voided"
          value={formatNumber(data.voided)}
          tone={data.voided > 0 ? 'warning' : 'default'}
          hint="Excluded from the total"
        />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Daily" />
          <DailyChart rows={data.daily} valueKey="sessions" label="Sessions" />
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="By therapist" />
            <BarList rows={data.by_therapist ?? []} labelKey="therapist" valueKey="sessions" />
          </Card>
          <Card>
            <CardHeader title="By clinic" />
            <BarList rows={data.by_clinic ?? []} labelKey="clinic_name" valueKey="sessions" />
          </Card>
        </div>
      </div>
    </>
  );
}

function SourceReport({ data }) {
  const rows = data.rows ?? [];
  const totals = data.totals ?? {};
  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="New patients" value={formatNumber(totals.new_patients)} tone="brand" />
        <StatCard label="Billed to them" value={formatMoney(totals.billed)} />
        <StatCard label="Collected" value={formatMoney(totals.collected)} tone="positive" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No new patients in this range"
          description="Acquisition is measured by registration date."
        />
      ) : (
        <div className="space-y-4">
        <Card>
          <CardHeader
            title="Where patients came from"
            description="Share of new registrations in this range."
          />
          <Donut
            rows={rows}
            labelKey="source_name"
            valueKey="new_patients"
            total={totals.new_patients}
            caption="new patients"
          />
        </Card>

        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Source</Th>
                <Th align="right">New patients</Th>
                <Th align="right">Share</Th>
                <Th align="right">Billed</Th>
                <Th align="right">Collected</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((row) => (
                <tr key={row.source_name} className="hover:bg-ink-50/60">
                  <Td className="font-medium text-ink-900">{row.source_name}</Td>
                  <Td align="right">{row.new_patients}</Td>
                  <Td align="right">{row.share_percent}%</Td>
                  <Td align="right" className="numeric">
                    {formatMoney(row.billed)}
                  </Td>
                  <Td align="right" className="numeric">
                    {formatMoney(row.collected)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        </div>
      )}
    </>
  );
}

function MonthComparison({ data }) {
  const periods = data.periods ?? [];
  const current = data.current ?? {};

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`${current.label ?? 'This month'} so far`}
          value={formatMoney(current.collected)}
          tone="positive"
          hint={`to day ${data.day_of_month}`}
        />
        <StatCard
          label="Previous month, same span"
          value={formatMoney(periods[1]?.collected)}
        />
        <StatCard
          label="Average of previous months"
          value={formatMoney(data.average_of_previous)}
          tone="brand"
        />
        <StatCard
          label="Sessions delivered"
          value={formatNumber(current.sessions)}
          hint={`${current.new_patients ?? 0} new patients`}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-4">
        <Change value={data.change_vs_last_month_percent} suffix="vs last month" />
        <Change value={data.change_vs_average_percent} suffix="vs the average" />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Collected, same span each month"
          description="Every bar covers day 1 to the same day number, so a part-month is never compared against a whole one."
        />
        <BarList
          rows={periods}
          labelKey="label"
          valueKey="collected"
          format={formatMoney}
        />
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Month</Th>
              <Th>Counted to</Th>
              <Th align="right">Collected</Th>
              <Th align="right">Billed</Th>
              <Th align="right">Outstanding</Th>
              <Th align="right">Sessions</Th>
              <Th align="right">New patients</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {periods.map((row, index) => (
              <tr
                key={row.label}
                className={index === 0 ? 'bg-brand-50/60 font-medium' : 'hover:bg-ink-50/60'}
              >
                <Td className="text-ink-900">
                  {row.label}
                  {index === 0 && (
                    <Badge tone="brand" className="ml-2">
                      Current
                    </Badge>
                  )}
                </Td>
                <Td className="text-ink-600">{formatDate(row.period_end)}</Td>
                <Td align="right" className="numeric">
                  {formatMoney(row.collected)}
                </Td>
                <Td align="right" className="numeric">
                  {formatMoney(row.billed)}
                </Td>
                <Td align="right" className="numeric">
                  {formatMoney(row.outstanding)}
                </Td>
                <Td align="right">{row.sessions}</Td>
                <Td align="right">{row.new_patients}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

function RetentionReport({ data }) {
  const rows = data.rows ?? [];
  const repeat = data.repeat_patients ?? {};

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Dropped off"
          value={formatNumber(data.dropped_out)}
          tone={data.dropped_out > 0 ? 'warning' : 'positive'}
          hint={`no visit in ${data.dropout_days}+ days, sessions still owed`}
        />
        <StatCard
          label="Value at risk"
          value={formatMoney(data.value_at_risk)}
          tone={Number(data.value_at_risk) > 0 ? 'warning' : 'default'}
          hint={`${data.sessions_owed} session(s) owed`}
        />
        <StatCard
          label="Drop-off rate"
          value={`${data.dropout_rate}%`}
          hint={`of ${data.active_packages_with_sessions_left} live packages`}
        />
        <StatCard
          label="Repeat patients"
          value={`${repeat.repeat_rate ?? 0}%`}
          tone="brand"
          hint={`${repeat.repeat_patients ?? 0} of ${repeat.patients_with_packages ?? 0} bought again`}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="✓"
          title="Nobody has dropped off"
          description={`Every patient with sessions left has been seen in the last ${data.dropout_days} days.`}
        />
      ) : (
        <Card>
          <CardHeader
            title="Patients to call back"
            description="They paid for sessions they have not taken. Export the CSV for a call list with mobile numbers."
          />
          <Table>
            <thead>
              <tr>
                <Th>Patient</Th>
                <Th>Clinic</Th>
                <Th>Last seen</Th>
                <Th align="right">Days since</Th>
                <Th align="right">Sessions owed</Th>
                <Th align="right">Value at risk</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((row) => (
                <tr key={row.package_id} className="hover:bg-ink-50/60">
                  <Td className="font-medium text-ink-900">
                    {row.patient_name}
                    <div className="numeric text-xs text-ink-500">
                      {row.patient_code}
                      {row.mobile ? ` · ${row.mobile}` : ''}
                    </div>
                  </Td>
                  <Td className="text-ink-600">{row.clinic_name ?? '—'}</Td>
                  <Td>{row.last_seen ? formatDate(row.last_seen) : 'Never attended'}</Td>
                  <Td align="right">
                    <span
                      className={
                        row.days_since > 120 ? 'font-medium text-red-600' : 'text-amber-700'
                      }
                    >
                      {row.days_since}
                    </span>
                  </Td>
                  <Td align="right">
                    {row.sessions_taken} of {row.sessions_registered} taken ·{' '}
                    <strong>{row.sessions_remaining}</strong> left
                  </Td>
                  <Td align="right" className="numeric font-medium text-amber-700">
                    {formatMoney(row.value_at_risk)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
