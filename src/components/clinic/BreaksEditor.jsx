/**
 * Recurring break editor.
 *
 * A break with no weekday applies to every working day. The backend rejects a
 * break that does not fit inside the configured hours, and that message is
 * surfaced verbatim because it names the offending day.
 */

import { useState } from 'react';

import { Icon } from '../Icon';
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
import { clinicService } from '../../services';
import { DAY_NAMES, formatTime } from '../../utils/format';

const BLANK = { day_of_week: '', start_time: '13:00', end_time: '13:30', label: 'Lunch break' };

function toApiTime(value) {
  return value?.length === 5 ? `${value}:00` : value;
}

export function BreaksEditor({ clinicId, canEdit, onChanged }) {
  const { data: breaks, loading, error, reload } = useApi(
    () => clinicService.breaks(clinicId),
    [clinicId]
  );
  const [form, setForm] = useState(BLANK);
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
      await clinicService.addBreak(clinicId, {
        day_of_week: form.day_of_week === '' ? null : Number(form.day_of_week),
        start_time: toApiTime(form.start_time),
        end_time: toApiTime(form.end_time),
        label: form.label?.trim() || 'Break',
      });
      setForm(BLANK);
      await reload();
      onChanged?.();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(breakId) {
    setBusyId(breakId);
    setSubmitError(null);
    try {
      await clinicService.removeBreak(clinicId, breakId);
      await reload();
      onChanged?.();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Breaks"
        description="Time inside working hours that should not be bookable. Leave the day empty to apply it every working day."
      />

      <div className="space-y-4 px-5 py-4">
        {error && (
          <Alert tone="error" title="Could not load breaks">
            {error.message}
          </Alert>
        )}
        {submitError && (
          <Alert tone="error" title="Could not save the break" onDismiss={() => setSubmitError(null)}>
            {submitError.message}
          </Alert>
        )}

        {loading ? (
          <div className="grid place-items-center py-8 text-brand-600">
            <Spinner />
          </div>
        ) : breaks?.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Label</Th>
                <Th>Applies to</Th>
                <Th>From</Th>
                <Th>To</Th>
                {canEdit && <Th align="right">Action</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {breaks.map((item) => (
                <tr key={item.id} className="hover:bg-ink-50/60">
                  <Td className="font-medium text-ink-900">{item.label}</Td>
                  <Td>
                    {item.day_of_week === null ? (
                      <Badge tone="info">Every working day</Badge>
                    ) : (
                      DAY_NAMES[item.day_of_week]
                    )}
                  </Td>
                  <Td>{formatTime(item.start_time)}</Td>
                  <Td>{formatTime(item.end_time)}</Td>
                  {canEdit && (
                    <Td align="right">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === item.id}
                        onClick={() => remove(item.id)}
                      >
                        Remove
                      </Button>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            title="No breaks configured"
            description="Every slot inside working hours is bookable."
          />
        )}

        {canEdit && (
          <form onSubmit={add} className="rounded-lg bg-ink-50 px-4 py-3">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">
              Add a break
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Day" htmlFor="break-day">
                <Select id="break-day" value={form.day_of_week} onChange={update('day_of_week')}>
                  <option value="">Every working day</option>
                  {DAY_NAMES.map((name, index) => (
                    <option key={name} value={index}>
                      {name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="From" htmlFor="break-start" required>
                <Input
                  id="break-start"
                  type="time"
                  value={form.start_time}
                  onChange={update('start_time')}
                  required
                />
              </Field>
              <Field label="To" htmlFor="break-end" required>
                <Input
                  id="break-end"
                  type="time"
                  value={form.end_time}
                  onChange={update('end_time')}
                  required
                />
              </Field>
              <Field label="Label" htmlFor="break-label">
                <Input id="break-label" value={form.label} onChange={update('label')} />
              </Field>
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="submit" size="sm" loading={submitting}>
                <Icon name="check" className="size-4" />
                Add break
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
