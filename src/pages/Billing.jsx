/**
 * Chain-level billing (Sections 17-19).
 *
 * The per-patient view lives on the patient profile; this is the other question
 * staff ask — "what has this clinic billed, and who still owes us?" — which is
 * unanswerable from a profile you have to know the name for.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '../components/Icon';
import { DocumentActions } from '../components/billing/DocumentActions';
import { RecordPaymentForm } from '../components/billing/RecordPaymentForm';
import {
  Alert,
  Badge,
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

  const { data: clinics } = useApi(() => clinicService.list({ status: 'ACTIVE' }), []);

  const query = {
    page,
    page_size: PAGE_SIZE,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.payment_status ? { payment_status: filters.payment_status } : {}),
    ...(filters.clinic_id ? { clinic_id: Number(filters.clinic_id) } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  };

  const { data, loading, error, reload } = useApi(
    () => billingService.list(query),
    [page, filters.search, filters.payment_status, filters.clinic_id, filters.from, filters.to],
  );

  const { data: counters, reload: reloadCounters } = useApi(
    () => billingService.counters(filters.clinic_id ? Number(filters.clinic_id) : undefined),
    [filters.clinic_id],
  );

  const bills = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function update(field) {
    return (event) => {
      setPage(1); // a filter change invalidates the current page number
      setFilters((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  async function reloadAll() {
    await Promise.all([reload(), reloadCounters()]);
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Collected today"
          value={formatMoney(counters?.collected_today)}
          tone="positive"
        />
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

      <Card className="mb-4">
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
          {/* A Clinic User is already scoped by the API; the selector would only
              ever have one option, so it is not shown. */}
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
          <Input
            aria-label="From date"
            type="date"
            value={filters.from}
            onChange={update('from')}
          />
          <Input aria-label="To date" type="date" value={filters.to} onChange={update('to')} />
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
          description="Registering a package or adding a charge on a patient's profile creates one."
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Bill</Th>
                <Th>Date</Th>
                <Th>Patient</Th>
                <Th>Clinic</Th>
                <Th align="right">Total</Th>
                <Th align="right">Paid</Th>
                <Th align="right">Balance</Th>
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
                  <Td align="right" className="numeric">
                    {formatMoney(bill.total_amount)}
                  </Td>
                  <Td align="right" className="numeric">
                    {formatMoney(bill.amount_paid)}
                  </Td>
                  <Td align="right" className="numeric">
                    {Number(bill.balance_amount) > 0 ? (
                      <span className="font-medium text-amber-700">
                        {formatMoney(bill.balance_amount)}
                      </span>
                    ) : (
                      formatMoney(0)
                    )}
                  </Td>
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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3 text-sm text-ink-600">
            <span>
              {total} bill{total === 1 ? '' : 's'} · page {page} of {pages}
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
