/**
 * Weekly working-hours editor.
 *
 * Edits the whole week locally and saves it in one request, matching the
 * backend's atomic replace. A partial save could momentarily leave overlapping
 * shifts, which is exactly what the server-side validation rejects.
 */

import { useEffect, useState } from 'react';

import { Icon } from '../Icon';
import { Alert, Badge, Button, Card, CardHeader, Input, Spinner } from '../ui';
import { DAY_NAMES } from '../../utils/format';
import { clinicService } from '../../services';

const EMPTY_SHIFT = { open_time: '09:00', close_time: '13:00', label: '' };

/** "09:00:00" -> "09:00" for <input type="time">. */
function toInputTime(value) {
  return value ? value.slice(0, 5) : '';
}

/** "09:00" -> "09:00:00" for the API. */
function toApiTime(value) {
  if (!value) return null;
  return value.length === 5 ? `${value}:00` : value;
}

function groupByDay(hours) {
  const byDay = DAY_NAMES.map(() => []);
  hours.forEach((hour) => {
    byDay[hour.day_of_week].push({
      open_time: toInputTime(hour.open_time),
      close_time: toInputTime(hour.close_time),
      label: hour.label ?? '',
    });
  });
  return byDay.map((shifts) => shifts.sort((a, b) => a.open_time.localeCompare(b.open_time)));
}

export function WorkingHoursEditor({ clinicId, canEdit, onSaved }) {
  const [days, setDays] = useState(() => DAY_NAMES.map(() => []));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    clinicService
      .workingHours(clinicId)
      .then((hours) => {
        if (!cancelled) {
          setDays(groupByDay(hours));
          setDirty(false);
        }
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  function mutate(updater) {
    setDays((current) => {
      const next = current.map((shifts) => shifts.map((shift) => ({ ...shift })));
      updater(next);
      return next;
    });
    setDirty(true);
    setResult(null);
  }

  const addShift = (day) => mutate((next) => next[day].push({ ...EMPTY_SHIFT }));
  const removeShift = (day, index) => mutate((next) => next[day].splice(index, 1));
  const updateShift = (day, index, field, value) =>
    mutate((next) => {
      next[day][index][field] = value;
    });

  /** Copy a day's shifts to every other day that currently has shifts, plus Mon-Sat. */
  const copyToWeekdays = (day) =>
    mutate((next) => {
      const source = next[day].map((shift) => ({ ...shift }));
      for (let target = 0; target <= 5; target += 1) {
        if (target !== day) next[target] = source.map((shift) => ({ ...shift }));
      }
    });

  const clearDay = (day) => mutate((next) => (next[day] = []));

  async function save() {
    setSaving(true);
    setError(null);
    setResult(null);
    const payload = days.flatMap((shifts, day) =>
      shifts.map((shift) => ({
        day_of_week: day,
        open_time: toApiTime(shift.open_time),
        close_time: toApiTime(shift.close_time),
        is_closed: false,
        label: shift.label?.trim() || null,
      }))
    );

    try {
      const response = await clinicService.replaceWorkingHours(clinicId, payload);
      setResult(response);
      setDirty(false);
      setDays(groupByDay(response.clinic.working_hours));
      onSaved?.(response);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="grid place-items-center py-16 text-brand-600">
        <Spinner size="lg" />
      </Card>
    );
  }

  const totalShifts = days.reduce((sum, shifts) => sum + shifts.length, 0);

  return (
    <Card>
      <CardHeader
        title="Working hours"
        description="Add a second shift on a day to model a split schedule, e.g. 09:00–13:00 and 16:00–20:00."
        action={
          canEdit && (
            <Button onClick={save} loading={saving} disabled={!dirty}>
              {dirty ? 'Save working hours' : 'Saved'}
            </Button>
          )
        }
      />

      <div className="space-y-3 px-5 py-4">
        {error && (
          <Alert tone="error" title="Could not save working hours">
            {error.message}
          </Alert>
        )}
        {result?.warnings?.length > 0 && (
          <Alert tone="warning" title="Saved, with notes">
            <ul className="list-disc space-y-0.5 pl-4">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Alert>
        )}
        {result && !result.warnings?.length && (
          <Alert tone="success">Working hours saved.</Alert>
        )}

        {DAY_NAMES.map((name, day) => (
          <div
            key={name}
            className="grid gap-3 rounded-lg border border-ink-200 px-4 py-3 sm:grid-cols-[8rem_1fr]"
          >
            <div>
              <p className="text-sm font-medium text-ink-900">{name}</p>
              {days[day].length === 0 ? (
                <Badge tone="neutral" className="mt-1">
                  Closed
                </Badge>
              ) : (
                <p className="mt-0.5 text-xs text-ink-500">
                  {days[day].length} shift{days[day].length > 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="space-y-2">
              {days[day].map((shift, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <Input
                    type="time"
                    value={shift.open_time}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateShift(day, index, 'open_time', event.target.value)
                    }
                    className="w-32"
                    aria-label={`${name} shift ${index + 1} opening time`}
                  />
                  <span className="text-ink-400">to</span>
                  <Input
                    type="time"
                    value={shift.close_time}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateShift(day, index, 'close_time', event.target.value)
                    }
                    className="w-32"
                    aria-label={`${name} shift ${index + 1} closing time`}
                  />
                  <Input
                    placeholder="Label (optional)"
                    value={shift.label}
                    disabled={!canEdit}
                    onChange={(event) => updateShift(day, index, 'label', event.target.value)}
                    className="w-40"
                    aria-label={`${name} shift ${index + 1} label`}
                  />
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeShift(day, index)}
                      className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${name} shift ${index + 1}`}
                    >
                      <Icon name="close" className="size-4" />
                    </button>
                  )}
                </div>
              ))}

              {canEdit && (
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <Button size="sm" variant="secondary" onClick={() => addShift(day)}>
                    + Add shift
                  </Button>
                  {days[day].length > 0 && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => copyToWeekdays(day)}>
                        Copy to Mon–Sat
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => clearDay(day)}>
                        Mark closed
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {totalShifts === 0 && (
          <Alert tone="warning">
            No working hours are configured, so this clinic produces no bookable slots.
          </Alert>
        )}
      </div>
    </Card>
  );
}
