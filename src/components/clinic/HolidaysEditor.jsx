/**
 * Holiday editor.
 *
 * Shows both this clinic's own closures and chain-wide ones. A chain-wide
 * holiday closes every clinic, so it is listed here but can only be removed
 * from the chain-wide context to avoid a surprising side effect.
 */

import { useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  Table,
  Td,
  Th,
} from '../ui';
import { useApi } from '../../hooks/useApi';
import { holidayService } from '../../services';
import { formatDate } from '../../utils/format';

export function HolidaysEditor({ clinicId, clinicName, canEdit }) {
  const { data: holidays, loading, error, reload } = useApi(
    () => holidayService.list({ clinic_id: clinicId }),
    [clinicId]
  );
  const [form, setForm] = useState({ holiday_date: '', reason: '', scope: 'clinic' });
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function add(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await holidayService.add({
        // null clinic_id means the whole chain is closed that day.
        clinic_id: form.scope === 'chain' ? null : clinicId,
        holiday_date: form.holiday_date,
        reason: form.reason?.trim() || null,
      });
      setForm({ holiday_date: '', reason: '', scope: form.scope });
      await reload();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(holidayId) {
    setBusyId(holidayId);
    setSubmitError(null);
    try {
      await holidayService.remove(holidayId);
      await reload();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setBusyId(null);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader
        title="Holidays and closed days"
        description="A chain-wide holiday closes every clinic; a clinic holiday closes only this one."
      />

      <div className="space-y-4 px-5 py-4">
        {error && (
          <Alert tone="error" title="Could not load holidays">
            {error.message}
          </Alert>
        )}
        {submitError && (
          <Alert tone="error" title="Could not save" onDismiss={() => setSubmitError(null)}>
            {submitError.message}
          </Alert>
        )}

        {loading ? (
          <div className="grid place-items-center py-8 text-brand-600">
            <Spinner />
          </div>
        ) : holidays?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Scope</Th>
                <Th>Reason</Th>
                {canEdit && <Th align="right">Action</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {holidays.map((holiday) => {
                const chainWide = holiday.clinic_id === null;
                return (
                  <tr key={holiday.id} className="hover:bg-ink-50/60">
                    <Td className="font-medium text-ink-900">
                      {formatDate(holiday.holiday_date)}
                    </Td>
                    <Td>
                      {chainWide ? (
                        <Badge tone="warning">All clinics</Badge>
                      ) : (
                        <Badge tone="neutral">{holiday.clinic_name ?? clinicName}</Badge>
                      )}
                    </Td>
                    <Td>{holiday.reason ?? '—'}</Td>
                    {canEdit && (
                      <Td align="right">
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busyId === holiday.id}
                          onClick={() => remove(holiday.id)}
                          title={
                            chainWide
                              ? 'This closure affects every clinic in the chain'
                              : undefined
                          }
                        >
                          Remove
                        </Button>
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="No closed days"
            description="This clinic follows its normal working hours all year."
          />
        )}

        {canEdit && (
          <form onSubmit={add} className="rounded-lg bg-ink-50 px-4 py-3">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">
              Add a closed day
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Date" htmlFor="holiday-date" required>
                <Input
                  id="holiday-date"
                  type="date"
                  min={today}
                  value={form.holiday_date}
                  onChange={update('holiday_date')}
                  required
                />
              </Field>
              <Field label="Applies to" htmlFor="holiday-scope">
                <Select id="holiday-scope" value={form.scope} onChange={update('scope')}>
                  <option value="clinic">This clinic only</option>
                  <option value="chain">All clinics (national holiday)</option>
                </Select>
              </Field>
              <Field label="Reason" htmlFor="holiday-reason" hint="e.g. Diwali, deep clean">
                <Input id="holiday-reason" value={form.reason} onChange={update('reason')} />
              </Field>
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="submit" size="sm" loading={submitting}>
                Add closed day
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
