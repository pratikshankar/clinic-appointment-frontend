import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Icon } from '../../components/Icon';
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Th,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { clinicService, referralService } from '../../services';
import { formatDate } from '../../utils/format';

const STATUS_TONES = {
  PENDING: 'warning',
  CREDITED: 'success',
  VOIDED: 'danger',
};

const STATUS_LABELS = {
  PENDING: 'Pending',
  CREDITED: 'Credited',
  VOIDED: 'Voided',
};

const PAGE_SIZE = 25;

export default function ReferralList() {
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
    () => referralService.list(query),
    [page, filters.status, filters.clinic_id],
  );

  const referrals = Array.isArray(items) ? items : [];
  const pendingCount = referrals.filter((r) => r.status === 'PENDING').length;

  const update = (field) => (e) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <>
      <PageHeader
        title="Referrals"
        description={
          pendingCount > 0
            ? `${pendingCount} pending — credit not yet applied`
            : 'Patient referral programme'
        }
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reload} loading={loading}>
              <Icon name="refresh" className="size-4" />
              Refresh
            </Button>
            <Link
              to={`${basePath}/referrals/new`}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Icon name="plus" className="size-4" />
              New referral
            </Link>
          </div>
        }
      />

      {/* Mobile filter + fab */}
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

      <BottomSheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter referrals">
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
        <div className="flex justify-center py-12"><Spinner /></div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      )}

      {/* Mobile cards */}
      {!loading && referrals.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {referrals.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer"
              onClick={() => navigate(`${basePath}/referrals/${r.id}`)}
            >
              <div className="px-4 py-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-ink-900">
                    {r.referrer_patient_name ?? '—'}
                    <span className="mx-1 text-ink-400">→</span>
                    {r.referred_patient_name ?? '—'}
                  </div>
                  <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                </div>
                <div className="mb-1 text-xs text-ink-500">
                  {r.clinic_name && <span className="mr-3">{r.clinic_name}</span>}
                  {formatDate(r.created_at)}
                </div>
                <div className="flex items-center justify-between text-xs text-ink-600">
                  <span>{r.credit_sessions} session{r.credit_sessions > 1 ? 's' : ''} credit</span>
                  {r.status === 'CREDITED' && r.credited_at && (
                    <span className="text-green-600">Credited {formatDate(r.credited_at)}</span>
                  )}
                  {r.status === 'VOIDED' && r.voided_reason && (
                    <span className="text-red-500 truncate max-w-[60%]">{r.voided_reason}</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Desktop table */}
      {!loading && (
        <div className="hidden sm:block">
          {referrals.length === 0 ? (
            <EmptyState
              title="No referrals"
              description="Referrals appear here once staff register them."
            />
          ) : (
            <Card>
              <Table>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Referrer</Th>
                    <Th>Referred patient</Th>
                    {isAdmin && <Th>Clinic</Th>}
                    <Th>Credit</Th>
                    <Th>Status</Th>
                    <Th>Registered</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="hover:bg-ink-50">
                      <Td className="font-mono text-xs text-ink-500">#{r.id}</Td>
                      <Td>
                        <div className="font-medium text-ink-900">{r.referrer_patient_name ?? '—'}</div>
                        {r.referrer_patient_code && (
                          <div className="text-xs text-ink-500">{r.referrer_patient_code}</div>
                        )}
                      </Td>
                      <Td>
                        <div className="font-medium text-ink-900">{r.referred_patient_name ?? '—'}</div>
                        {r.referred_patient_code && (
                          <div className="text-xs text-ink-500">{r.referred_patient_code}</div>
                        )}
                      </Td>
                      {isAdmin && <Td className="text-sm">{r.clinic_name ?? '—'}</Td>}
                      <Td className="text-sm">
                        {r.credit_sessions} session{r.credit_sessions > 1 ? 's' : ''}
                      </Td>
                      <Td>
                        <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                      </Td>
                      <Td className="text-sm text-ink-500">{formatDate(r.created_at)}</Td>
                      <Td>
                        <Link
                          to={`${basePath}/referrals/${r.id}`}
                          className="inline-flex items-center justify-center rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-ink-800 ring-1 ring-inset ring-ink-300 hover:bg-ink-50"
                        >
                          View
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {!loading && referrals.length === 0 && (
        <EmptyState
          className="sm:hidden"
          title="No referrals"
          description="Referrals appear here once staff register them."
        />
      )}

      {referrals.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-600">
          <span>Page {page}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={referrals.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
