/**
 * Audit log viewer (Section 28, Phase 9).
 *
 * Superadmin only — the log spans every clinic and includes password resets.
 * Read-only by construction: there is no endpoint that edits or deletes an
 * entry, so there is nothing to build here but a way to look.
 */

import { useState } from 'react';

import { Icon } from '../components/Icon';
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
  Table,
  Td,
  Th,
} from '../components/ui';
import { useApi } from '../hooks/useApi';
import { auditService } from '../services';
import { formatDateTime } from '../utils/format';

const PAGE_SIZE = 50;

/** Colour by consequence, not by category: destructive and security first. */
const TONES = {
  LOGIN: 'neutral',
  LOGOUT: 'neutral',
  LOGIN_FAILED: 'warning',
  PASSWORD_CHANGED: 'danger',
  CREATED: 'success',
  UPDATED: 'info',
  ENABLED: 'success',
  DISABLED: 'danger',
  DELETED: 'danger',
  APPOINTMENT_CREATED: 'success',
  APPOINTMENT_RESCHEDULED: 'warning',
  APPOINTMENT_CANCELLED: 'danger',
  SESSION_RECORDED: 'brand',
  BILL_GENERATED: 'brand',
  PAYMENT_RECORDED: 'success',
  NOTIFICATION_ACKNOWLEDGED: 'neutral',
};

export default function AuditLog() {
  const [filters, setFilters] = useState({ action: '', search: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  const { data: actionList } = useApi(() => auditService.actions(), []);

  const { data, loading, error, reload } = useApi(
    () =>
      auditService.list({
        page,
        page_size: PAGE_SIZE,
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      }),
    [page, filters.action, filters.search, filters.from, filters.to],
  );

  const update = (field) => (event) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every significant action, append-only. Nothing here can be edited or removed."
        action={
          <Button variant="secondary" onClick={reload} loading={loading}>
            <Icon name="refresh" className="size-4" />
            Refresh
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            aria-label="Search the log"
            placeholder="Description, user or entity"
            value={filters.search}
            onChange={update('search')}
          />
          <Select aria-label="Action" value={filters.action} onChange={update('action')}>
            <option value="">All actions</option>
            {(actionList?.actions ?? []).map((action) => (
              <option key={action} value={action}>
                {action.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
          <Input aria-label="From" type="date" value={filters.from} onChange={update('from')} />
          <Input aria-label="To" type="date" value={filters.to} onChange={update('to')} />
        </div>
      </Card>

      {error && (
        <Alert tone="error" title="Could not load the audit log">
          {error.message}
        </Alert>
      )}

      {loading ? (
        <Card className="grid place-items-center py-16 text-brand-600">
          <Spinner size="lg" />
        </Card>
      ) : items.length === 0 ? (
        <EmptyState title="No entries match" description="Try widening the filters." />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>User</Th>
                <Th>Entity</Th>
                <Th>What happened</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {items.map((entry) => (
                <tr
                  key={entry.id}
                  className="cursor-pointer align-top hover:bg-ink-50/60"
                  onClick={() => setOpenId(openId === entry.id ? null : entry.id)}
                >
                  <Td className="whitespace-nowrap text-xs text-ink-500">
                    {formatDateTime(entry.created_at)}
                  </Td>
                  <Td>
                    <Badge tone={TONES[entry.action] ?? 'neutral'}>
                      {entry.action.replace(/_/g, ' ')}
                    </Badge>
                  </Td>
                  <Td className="text-ink-700">
                    {entry.full_name ?? entry.username ?? 'System'}
                    {entry.username && entry.full_name && (
                      <div className="text-xs text-ink-400">{entry.username}</div>
                    )}
                  </Td>
                  <Td className="text-xs text-ink-500">
                    {entry.entity_type ?? '—'}
                    {entry.entity_id ? ` #${entry.entity_id}` : ''}
                  </Td>
                  <Td className="text-ink-800">
                    {entry.description ?? '—'}
                    {openId === entry.id && (
                      <div className="mt-2 space-y-1 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
                        {entry.ip_address && (
                          <p>
                            IP <span className="numeric">{entry.ip_address}</span>
                          </p>
                        )}
                        {entry.details && (
                          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px]">
                            {JSON.stringify(entry.details, null, 2)}
                          </pre>
                        )}
                        {!entry.ip_address && !entry.details && <p>No further detail recorded.</p>}
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3 text-sm text-ink-600">
            <span>
              {total} entr{total === 1 ? 'y' : 'ies'} · page {page} of {pages}
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
    </>
  );
}
