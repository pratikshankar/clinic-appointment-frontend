import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Icon } from '../../components/Icon';
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
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
import { clinicService, refundService } from '../../services';
import { formatDate, formatMoney } from '../../utils/format';

const STATUS_TONES = {
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  COMPLETED: 'success',
};

const STATUS_LABELS = {
  PENDING_APPROVAL: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed',
};

const PAGE_SIZE = 25;

export default function RefundList() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const basePath =
    role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';

  const [filters, setFilters] = useState({ status: '', clinic_id: '' });
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: clinics } = useApi(
    () => (isAdmin ? clinicService.list({ status: 'ACTIVE' }) : null),
    [],
  );

  const query = {
    page,
    page_size: PAGE_SIZE,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.clinic_id ? { clinic_id: Number(filters.clinic_id) } : {}),
  };

  const { data: items, loading, error, reload } = useApi(
    () => refundService.list(query),
    [page, filters.status, filters.clinic_id],
  );

  const refunds = Array.isArray(items) ? items : [];

  const update = (field) => (e) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const pendingCount = refunds.filter((r) => r.status === 'PENDING_APPROVAL').length;

  return (
    <>
      <PageHeader
        title="Refunds"
        description={
          pendingCount > 0 && isAdmin
            ? `${pendingCount} request${pendingCount > 1 ? 's' : ''} awaiting approval`
            : 'Package cancellation and refund requests'
        }
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reload} loading={loading}>
              <Icon name="refresh" className="size-4" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Mobile filter bar */}
      <div className="mb-3 flex gap-2 sm:hidden">
        <div className="flex-1">
          <Select value={filters.status} onChange={update('status')} aria-label="Filter by status">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
        {isAdmin && (
          <Button variant="secondary" onClick={() => setFilterOpen(true)}>
            <Icon name="filter" className="size-4" />
          </Button>
        )}
      </div>

      <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter refunds">
        <div className="space-y-3 pb-2">
          <Select value={filters.status} onChange={update('status')} label="Status">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          {isAdmin && clinics?.items && (
            <Select value={filters.clinic_id} onChange={update('clinic_id')} label="Clinic">
              <option value="">All clinics</option>
              {clinics.items.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          )}
          <Button className="w-full" onClick={() => setFilterOpen(false)}>Apply</Button>
        </div>
      </BottomSheet>

      {/* Desktop filter card */}
      <Card className="mb-4 hidden sm:block">
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={filters.status} onChange={update('status')} label="Status">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          {isAdmin && clinics?.items && (
            <Select value={filters.clinic_id} onChange={update('clinic_id')} label="Clinic">
              <option value="">All clinics</option>
              {clinics.items.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          )}
        </div>
      </Card>

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      )}

      {/* Mobile cards */}
      {!loading && refunds.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {refunds.map((r) => (
            <Card key={r.id} className="cursor-pointer" onClick={() => navigate(`${basePath}/refunds/${r.id}`)}>
              <div className="px-4 py-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="font-medium text-ink-900">
                    {r.patient_name ?? '—'}
                    {r.patient_code && (
                      <span className="ml-1.5 text-xs text-ink-500">({r.patient_code})</span>
                    )}
                  </div>
                  <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                </div>
                <div className="mb-2 text-sm text-ink-500">
                  {r.clinic_name && <span className="mr-3">{r.clinic_name}</span>}
                  <span>{formatDate(r.created_at)}</span>
                </div>
                <div className="mb-2 line-clamp-2 text-sm text-ink-700">{r.reason}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-500">
                    {r.sessions_consumed}/{r.sessions_registered} sessions
                  </span>
                  <span className="font-semibold text-brand-600">{formatMoney(r.refund_amount)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Desktop table */}
      {!loading && (
        <div className="hidden sm:block">
          {refunds.length === 0 ? (
            <EmptyState
              title="No refund requests"
              description="Refund requests will appear here when initiated."
            />
          ) : (
            <Card>
              <Table>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Patient</Th>
                    {isAdmin && <Th>Clinic</Th>}
                    <Th>Sessions</Th>
                    <Th>Refund</Th>
                    <Th>Status</Th>
                    <Th>Initiated by</Th>
                    <Th>Date</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((r) => (
                    <tr key={r.id} className="hover:bg-ink-50">
                      <Td className="font-mono text-xs text-ink-500">#{r.id}</Td>
                      <Td>
                        <Link
                          to={`${basePath}/patients/${r.patient_id ?? ''}`}
                          className="font-medium text-brand-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.patient_name ?? '—'}
                        </Link>
                        {r.patient_code && (
                          <div className="text-xs text-ink-500">{r.patient_code}</div>
                        )}
                      </Td>
                      {isAdmin && <Td className="text-sm">{r.clinic_name ?? '—'}</Td>}
                      <Td className="text-sm">
                        {r.sessions_consumed}/{r.sessions_registered}
                      </Td>
                      <Td className="font-semibold text-brand-600">
                        {formatMoney(r.refund_amount)}
                      </Td>
                      <Td>
                        <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                      </Td>
                      <Td className="text-sm text-ink-600">{r.initiated_by_name ?? '—'}</Td>
                      <Td className="text-sm text-ink-500">{formatDate(r.created_at)}</Td>
                      <Td>
                        <Button
                          size="sm"
                          variant="secondary"
                          as={Link}
                          to={`${basePath}/refunds/${r.id}`}
                        >
                          View
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* Mobile empty state */}
      {!loading && refunds.length === 0 && (
        <EmptyState
          className="sm:hidden"
          title="No refund requests"
          description="Refund requests will appear here when initiated."
        />
      )}

      {/* Pagination */}
      {refunds.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-600">
          <span>Page {page}</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={refunds.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
