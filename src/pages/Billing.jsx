/**
 * Chain-level billing (Sections 17-19).
 *
 * Two date-filter modes:
 *   Bill date    — shows bills created in the range (original behaviour)
 *   Payment date — shows bills that received a payment in the range, with the
 *                  "Paid" column showing only what was collected in that period,
 *                  plus a Cash / UPI / Card breakdown.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '../components/Icon';
import { DocumentActions } from '../components/billing/DocumentActions';
import { RecordPaymentForm } from '../components/billing/RecordPaymentForm';
import {
  Alert,
  Badge,
  BottomSheet,
  Button,
  Card,
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
import { billingService, clinicService } from '../services';
import { formatDate, formatMoney } from '../utils/format';

const PAYMENT_TONES = { PAID: 'success', PARTIAL: 'warning', UNPAID: 'danger' };
const PAGE_SIZE = 25;

export default function Billing() {
  const { role } = useAuth();
  const basePath =
    role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';
  const isClinicUser = role === 'CLINIC_USER';

  // 'bill' = filter by bill_date (original), 'payment' = filter by payment_date
  const [viewMode, setViewMode] = useState('payment');

  const [filters, setFilters] = useState({
    search: '',
    payment_status: '',
    clinic_id: '',
    from: '',
    to: '',
  });
  const [page, setPage] = useState(1);
  const [payingBill, setPayingBill] = useState(null);
  const [banner, setBanner] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: clinics } = useApi(() => clinicService.list({ status: 'ACTIVE' }), []);

  const isPaymentMode = viewMode === 'payment';

  const query = {
    page,
    page_size: PAGE_SIZE,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.payment_status ? { payment_status: filters.payment_status } : {}),
    ...(filters.clinic_id ? { clinic_id: Number(filters.clinic_id) } : {}),
    // In payment mode send payment_from/payment_to; in bill mode send from/to
    ...(isPaymentMode
      ? {
          ...(filters.from ? { payment_from: filters.from } : {}),
          ...(filters.to ? { payment_to: filters.to } : {}),
        }
      : {
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {}),
        }),
  };

  const { data, loading, error, reload } = useApi(
    () => billingService.list(query),
    [page, filters.search, filters.payment_status, filters.clinic_id, filters.from, filters.to, viewMode],
  );

  const { data: counters, reload: reloadCounters } = useApi(
    () => billingService.counters(filters.clinic_id ? Number(filters.clinic_id) : undefined),
    [filters.clinic_id],
  );

  // Payment breakdown — only when in payment mode and at least one date is set
  const breakdownActive = isPaymentMode && (filters.from || filters.to);
  const { data: breakdown } = useApi(
    () =>
      breakdownActive
        ? billingService.paymentBreakdown({
            ...(filters.clinic_id ? { clinic_id: Number(filters.clinic_id) } : {}),
            ...(filters.from ? { from: filters.from } : {}),
            ...(filters.to ? { to: filters.to } : {}),
          })
        : Promise.resolve(null),
    [filters.clinic_id, filters.from, filters.to, viewMode],
  );

  const bills = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function update(field) {
    return (event) => {
      setPage(1);
      setFilters((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  function switchMode(mode) {
    setViewMode(mode);
    setPage(1);
  }

  async function reloadAll() {
    await Promise.all([reload(), reloadCounters()]);
  }

  // In payment mode, show amount_paid_in_period if present, else fall back to amount_paid
  function paidAmount(bill) {
    return isPaymentMode && bill.amount_paid_in_period != null
      ? bill.amount_paid_in_period
      : bill.amount_paid;
  }

  return (
    <>
      <PageHeader
        title="Billing"
        description={
          isClinicUser
            ? 'Invoices and payments for your clinic.'
            : 'Invoices and payments across the chain.'
        }
        action={
          <Button variant="secondary" onClick={reloadAll} loading={loading}>
            <Icon name="refresh" className="size-4" />
            Refresh
          </Button>
        }
      />

      {banner && (
        <div className="mb-4">
          <Alert tone={banner.tone} onDismiss={() => setBanner(null)}>
            {banner.message}
          </Alert>
        </div>
      )}

      {/* Summary stat cards — top row always visible */}
      {(() => {
        // When payment mode + date filter is active, the first card shows
        // the period total (from the breakdown) instead of today's figure.
        const periodLabel = (() => {
          if (!breakdownActive) return null;
          if (filters.from && filters.to) {
            return filters.from === filters.to
              ? formatDate(filters.from)
              : `${formatDate(filters.from)} – ${formatDate(filters.to)}`;
          }
          if (filters.from) return `From ${formatDate(filters.from)}`;
          return `Up to ${formatDate(filters.to)}`;
        })();

        return (
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {breakdownActive ? (
              <StatCard
                label="Collected (period)"
                value={formatMoney(breakdown?.total ?? 0)}
                tone="positive"
                hint={periodLabel}
              />
            ) : (
              <StatCard
                label="Day's collection"
                value={formatMoney(counters?.collected_today)}
                tone="positive"
                hint="Today"
              />
            )}
            <StatCard label="Total billed" value={formatMoney(counters?.total_billed)} />
            <StatCard
              label="Total collected"
              value={formatMoney(counters?.total_collected)}
              tone="brand"
            />
            <StatCard
              label="Outstanding"
              value={formatMoney(counters?.outstanding)}
              tone={Number(counters?.outstanding) > 0 ? 'warning' : 'default'}
              hint={counters ? `${counters.bills} bill(s)` : undefined}
            />
          </div>
        );
      })()}

      {/* Cash / UPI / Card breakdown — shown below when payment mode + date filter active */}
      {isPaymentMode && breakdownActive && (
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Cash"
            value={formatMoney(breakdown?.cash ?? 0)}
            hint="of period total"
          />
          <StatCard
            label="UPI"
            value={formatMoney(breakdown?.upi ?? 0)}
            hint="of period total"
          />
          <StatCard
            label="Card"
            value={formatMoney(breakdown?.card ?? 0)}
            hint="of period total"
          />
        </div>
      )}

      {/* Date-filter mode toggle */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-sm text-ink-500">Filter by:</span>
        <div className="inline-flex rounded-lg border border-ink-200 bg-ink-50 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => switchMode('payment')}
            className={`rounded-md px-3 py-1 transition-colors ${
              isPaymentMode
                ? 'bg-white font-medium text-ink-900 shadow-sm'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            Payment date
          </button>
          <button
            type="button"
            onClick={() => switchMode('bill')}
            className={`rounded-md px-3 py-1 transition-colors ${
              !isPaymentMode
                ? 'bg-white font-medium text-ink-900 shadow-sm'
                : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            Bill date
          </button>
        </div>
      </div>

      {/* Mobile: search bar + filter button */}
      <div className="mb-4 sm:hidden">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Bill no., patient or ID…"
              value={filters.search}
              onChange={update('search')}
            />
          </div>
          <Button variant="secondary" onClick={() => setFilterOpen(true)}>
            <Icon name="sliders" className="size-4" />
            Filter
          </Button>
        </div>
        <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter bills">
          <div className="space-y-4 py-2">
            <Select aria-label="Payment status" value={filters.payment_status} onChange={update('payment_status')}>
              <option value="">All statuses</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partly paid</option>
              <option value="PAID">Paid</option>
            </Select>
            {!isClinicUser && (
              <Select aria-label="Clinic" value={filters.clinic_id} onChange={update('clinic_id')}>
                <option value="">All clinics</option>
                {(clinics ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            )}
            <Input
              aria-label={isPaymentMode ? 'Payment from' : 'Bill from'}
              type="date"
              value={filters.from}
              onChange={update('from')}
            />
            <Input
              aria-label={isPaymentMode ? 'Payment to' : 'Bill to'}
              type="date"
              value={filters.to}
              onChange={update('to')}
            />
            <Button className="w-full" onClick={() => setFilterOpen(false)}>Apply</Button>
          </div>
        </BottomSheet>
      </div>

      {/* Desktop filter card */}
      <Card className="mb-4 hidden sm:block">
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            aria-label="Search bills"
            placeholder="Bill no., patient name or ID"
            value={filters.search}
            onChange={update('search')}
          />
          <Select
            aria-label="Payment status"
            value={filters.payment_status}
            onChange={update('payment_status')}
          >
            <option value="">All statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIAL">Partly paid</option>
            <option value="PAID">Paid</option>
          </Select>
          {!isClinicUser && (
            <Select aria-label="Clinic" value={filters.clinic_id} onChange={update('clinic_id')}>
              <option value="">All clinics</option>
              {(clinics ?? []).map((clinic) => (
                <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
              ))}
            </Select>
          )}
          <Input
            aria-label={isPaymentMode ? 'Payment from date' : 'Bill from date'}
            placeholder={isPaymentMode ? 'Payment from' : 'Bill from'}
            type="date"
            value={filters.from}
            onChange={update('from')}
          />
          <Input
            aria-label={isPaymentMode ? 'Payment to date' : 'Bill to date'}
            placeholder={isPaymentMode ? 'Payment to' : 'Bill to'}
            type="date"
            value={filters.to}
            onChange={update('to')}
          />
        </div>
      </Card>

      {error && (
        <Alert tone="error" title="Could not load bills">
          {error.message}
        </Alert>
      )}

      {loading ? (
        <Card className="grid place-items-center py-16 text-brand-600">
          <Spinner size="lg" />
        </Card>
      ) : bills.length === 0 ? (
        <EmptyState
          title="No bills match"
          description={
            isPaymentMode
              ? 'No payments recorded in this date range.'
              : 'Registering a package or adding a charge on a patient profile creates one.'
          }
        />
      ) : (
        <Card>
          {/* Mobile card list */}
          <div className="divide-y divide-ink-100 sm:hidden">
            {bills.map((bill) => (
              <div key={bill.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      to={`${basePath}/patients/${bill.patient_id}`}
                      className="font-medium text-brand-700"
                    >
                      {bill.patient_name ?? '—'}
                    </Link>
                    <div className="numeric text-xs text-ink-500">
                      {bill.bill_number} · {formatDate(bill.bill_date)}
                    </div>
                  </div>
                  <Badge tone={PAYMENT_TONES[bill.payment_status] ?? 'neutral'}>
                    {bill.payment_status}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="numeric text-sm">
                    <span className="font-semibold text-ink-900">{formatMoney(bill.total_amount)}</span>
                    {isPaymentMode ? (
                      <span className="ml-2 font-medium text-emerald-700">
                        {formatMoney(paidAmount(bill))} received
                      </span>
                    ) : (
                      Number(bill.balance_amount) > 0 && (
                        <span className="ml-2 font-medium text-amber-700">
                          {formatMoney(bill.balance_amount)} due
                        </span>
                      )
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <DocumentActions
                    label="Invoice"
                    patientName={bill.patient_name}
                    fetchPdf={() => billingService.invoicePdf(bill.id)}
                    send={(payload) => billingService.sendInvoice(bill.id, payload)}
                  />
                  {Number(bill.balance_amount) > 0 && (
                    <Button size="sm" onClick={() => setPayingBill(bill)}>
                      Record payment
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <Table>
              <thead>
                <tr>
                  <Th>Bill</Th>
                  <Th>Bill Date</Th>
                  <Th>Patient</Th>
                  <Th>Clinic</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">{isPaymentMode ? 'Paid (period)' : 'Paid'}</Th>
                  {!isPaymentMode && <Th align="right">Balance</Th>}
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-ink-50/60">
                    <Td className="numeric font-medium text-ink-900">{bill.bill_number}</Td>
                    <Td>{formatDate(bill.bill_date)}</Td>
                    <Td>
                      <Link
                        to={`${basePath}/patients/${bill.patient_id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {bill.patient_name ?? '—'}
                      </Link>
                      <div className="numeric text-xs text-ink-500">{bill.patient_code}</div>
                    </Td>
                    <Td className="text-ink-600">{bill.clinic_name ?? '—'}</Td>
                    <Td align="right" className="numeric">{formatMoney(bill.total_amount)}</Td>
                    <Td align="right" className="numeric font-medium text-emerald-700">
                      {formatMoney(paidAmount(bill))}
                    </Td>
                    {!isPaymentMode && (
                      <Td align="right" className="numeric">
                        {Number(bill.balance_amount) > 0 ? (
                          <span className="font-medium text-amber-700">
                            {formatMoney(bill.balance_amount)}
                          </span>
                        ) : (
                          formatMoney(0)
                        )}
                      </Td>
                    )}
                    <Td>
                      <Badge tone={PAYMENT_TONES[bill.payment_status] ?? 'neutral'}>
                        {bill.payment_status}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <DocumentActions
                          label="Invoice"
                          patientName={bill.patient_name}
                          fetchPdf={() => billingService.invoicePdf(bill.id)}
                          send={(payload) => billingService.sendInvoice(bill.id, payload)}
                        />
                        {Number(bill.balance_amount) > 0 && (
                          <Button size="sm" onClick={() => setPayingBill(bill)}>
                            Record payment
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Footer with total for payment mode */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3 text-sm text-ink-600">
            <span>
              {total} bill{total === 1 ? '' : 's'} · page {page} of {pages}
              {isPaymentMode && breakdownActive && breakdown && (
                <span className="ml-3 font-medium text-emerald-700">
                  · Total received: {formatMoney(breakdown.total)}
                </span>
              )}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      <RecordPaymentForm
        open={Boolean(payingBill)}
        bill={payingBill}
        onClose={() => setPayingBill(null)}
        onSaved={async (updated) => {
          setPayingBill(null);
          setBanner({
            tone: 'success',
            message: `Payment recorded on ${updated.bill_number}. ${
              Number(updated.balance_amount) > 0
                ? `${formatMoney(updated.balance_amount)} still outstanding.`
                : 'Paid in full.'
            }`,
          });
          await reloadAll();
        }}
      />
    </>
  );
}
