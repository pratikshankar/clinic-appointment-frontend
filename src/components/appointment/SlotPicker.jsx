/**
 * Slot picker: a date, a clinic, and the day's slots with remaining capacity.
 *
 * Shared by both booking paths (new lead and existing patient) so the two can
 * never disagree about what is available. Full and past slots are shown greyed
 * out rather than hidden — reception wants to see the shape of the whole day,
 * not a list with holes in it.
 */

import { useEffect, useState } from 'react';

import { Icon } from '../Icon';
import { Alert, Badge, Card, CardHeader, Field, Input, Select, Spinner } from '../ui';
import { appointmentService } from '../../services';
import { formatTime } from '../../utils/format';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function SlotPicker({
  clinics,
  clinicId,
  onClinicChange,
  onDate,
  onDateChange,
  selected,
  onSelect,
  clinicLocked = false,
}) {
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clinicId || !onDate) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    appointmentService
      .availableSlots(clinicId, onDate)
      .then((data) => !cancelled && setAvailability(data))
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [clinicId, onDate]);

  // A slot that stops being bookable (someone else took the last place) must
  // not stay selected silently.
  useEffect(() => {
    if (!selected || !availability) return;
    const match = availability.slots.find((slot) => slot.time === selected);
    if (!match || !match.is_bookable) onSelect(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability]);

  return (
    <Card>
      <CardHeader
        title="Choose a slot"
        description="Slots come from the clinic's working hours, breaks and holidays."
      />

      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Clinic" htmlFor="slot-clinic" required>
            <Select
              id="slot-clinic"
              value={clinicId ?? ''}
              onChange={(event) => onClinicChange(Number(event.target.value) || null)}
              disabled={clinicLocked}
              required
            >
              <option value="">Select a clinic…</option>
              {(clinics ?? []).map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Date" htmlFor="slot-date" required>
            <Input
              id="slot-date"
              type="date"
              min={todayISO()}
              value={onDate ?? ''}
              onChange={(event) => onDateChange(event.target.value)}
              required
            />
          </Field>
        </div>

        {error && (
          <Alert tone="error" title="Could not load slots">
            {error.message}
          </Alert>
        )}

        {loading ? (
          <div className="grid place-items-center py-10 text-brand-600">
            <Spinner />
          </div>
        ) : !clinicId || !onDate ? (
          <Alert tone="info">Pick a clinic and a date to see available slots.</Alert>
        ) : !availability ? null : !availability.is_open ? (
          <Alert tone="warning" title={`${availability.day_name} — closed`}>
            {availability.closed_reason}
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
              <Badge tone="brand">{availability.day_name}</Badge>
              <span>
                <strong className="numeric">{availability.total_available}</strong> place
                {availability.total_available === 1 ? '' : 's'} free of{' '}
                <strong className="numeric">{availability.total_capacity}</strong>
              </span>
              <span className="text-ink-400">
                ({availability.slot_duration_minutes} min × {availability.capacity_per_slot}{' '}
                per slot)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {availability.slots.map((slot) => {
                const isSelected = selected === slot.time;
                const disabled = !slot.is_bookable;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={disabled}
                    title={slot.unavailable_reason ?? `${slot.available} of ${slot.capacity} free`}
                    onClick={() => onSelect(slot.time)}
                    className={[
                      'rounded-lg border px-2 py-2 text-center transition-colors',
                      disabled
                        ? 'cursor-not-allowed border-ink-200 bg-ink-50 text-ink-400'
                        : isSelected
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-ink-300 bg-white text-ink-800 hover:border-brand-400 hover:bg-brand-50',
                    ].join(' ')}
                  >
                    <span className="numeric block text-sm font-semibold">
                      {formatTime(`${slot.time}:00`)}
                    </span>
                    <span
                      className={[
                        'numeric block text-[11px]',
                        disabled
                          ? 'text-ink-400'
                          : isSelected
                            ? 'text-brand-50'
                            : 'text-ink-500',
                      ].join(' ')}
                    >
                      {!slot.is_bookable
                        ? slot.unavailable_reason === 'Fully booked'
                          ? 'full'
                          : 'past'
                        : `${slot.available} free`}
                    </span>
                  </button>
                );
              })}
            </div>

            {availability.total_available === 0 && (
              <Alert tone="warning">
                Every slot on this date is full or already past. Try another date.
              </Alert>
            )}

            {selected && (
              <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900 ring-1 ring-inset ring-brand-200">
                <Icon name="check" className="size-4" />
                Selected: <strong>{formatTime(`${selected}:00`)}</strong> on{' '}
                {availability.day_name}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
