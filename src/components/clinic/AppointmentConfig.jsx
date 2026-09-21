/**
 * Appointment configuration: slot duration, capacity, and a live preview.
 *
 * The preview calls the backend rather than recomputing slots in the browser,
 * so what is shown is exactly what the server's generator produces. Phase 4's
 * booking endpoint uses the same generator, which is the point: the Superadmin
 * sees the real thing before any patient is booked into it.
 */

import { useState } from 'react';

import { Icon } from '../Icon';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Spinner,
} from '../ui';
import { useApi } from '../../hooks/useApi';
import { clinicService } from '../../services';
import { DAY_NAMES, formatTime } from '../../utils/format';

export function AppointmentConfig({ clinic, canEdit, onSaved }) {
  const [form, setForm] = useState({
    slot_duration_minutes: clinic.slot_duration_minutes,
    capacity_per_slot: clinic.capacity_per_slot,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [previewDate, setPreviewDate] = useState(() => new Date().toISOString().slice(0, 10));

  const {
    data: preview,
    loading: previewLoading,
    reload: reloadPreview,
  } = useApi(() => clinicService.schedulePreview(clinic.id, previewDate), [clinic.id, previewDate]);

  const dirty =
    Number(form.slot_duration_minutes) !== clinic.slot_duration_minutes ||
    Number(form.capacity_per_slot) !== clinic.capacity_per_slot;

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const response = await clinicService.update(clinic.id, {
        slot_duration_minutes: Number(form.slot_duration_minutes),
        capacity_per_slot: Number(form.capacity_per_slot),
      });
      setResult(response);
      onSaved?.(response);
      await reloadPreview();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Appointment configuration"
          description="How long each appointment lasts, and how many patients can share one slot."
        />
        <form onSubmit={save} className="space-y-4 px-5 py-4">
          {error && (
            <Alert tone="error" title="Could not save">
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
          {result && !result.warnings?.length && <Alert tone="success">Configuration saved.</Alert>}

          {result?.overbooked_slots?.length > 0 && (
            <Alert tone="warning" title="Slots already above the new capacity">
              <p className="mb-1.5">
                These appointments are kept — a patient is never told a confirmed slot has
                vanished. No new bookings will be accepted there until they fall below the new
                capacity.
              </p>
              <ul className="list-disc space-y-0.5 pl-4">
                {result.overbooked_slots.map((slot) => (
                  <li key={`${slot.date}-${slot.time}`}>
                    {slot.date} at {slot.time} — {slot.booked} booked, capacity {slot.capacity}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Appointment duration"
              htmlFor="slot-duration"
              hint="Minutes per slot"
              required
            >
              <Input
                id="slot-duration"
                type="number"
                min={5}
                max={240}
                step={5}
                value={form.slot_duration_minutes}
                disabled={!canEdit}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, slot_duration_minutes: event.target.value }))
                }
                required
              />
            </Field>
            <Field
              label="Capacity per slot"
              htmlFor="capacity"
              hint="Patients treated in parallel"
              required
            >
              <Input
                id="capacity"
                type="number"
                min={1}
                max={100}
                value={form.capacity_per_slot}
                disabled={!canEdit}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, capacity_per_slot: event.target.value }))
                }
                required
              />
            </Field>
            {canEdit && (
              <div className="flex items-end">
                <Button type="submit" loading={saving} disabled={!dirty}>
                  {dirty ? 'Save configuration' : 'Saved'}
                </Button>
              </div>
            )}
          </div>

          {clinic.configuration_warnings?.length > 0 && (
            <Alert tone="warning" title="Configuration notes">
              <ul className="list-disc space-y-0.5 pl-4">
                {clinic.configuration_warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Alert>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
              Slots per weekday with the saved configuration
            </p>
            <div className="flex flex-wrap gap-2">
              {DAY_NAMES.map((name, day) => {
                const count = clinic.weekly_slot_counts?.[String(day)] ?? 0;
                return (
                  <div
                    key={name}
                    className="rounded-lg border border-ink-200 px-3 py-1.5 text-center"
                  >
                    <p className="text-[11px] text-ink-500">{name.slice(0, 3)}</p>
                    <p className="numeric text-sm font-semibold text-ink-900">{count}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Slot preview"
          description="Exactly what the backend's generator produces for a chosen date. Bookings are not counted here."
          action={
            <div className="flex items-end gap-2">
              <Input
                type="date"
                value={previewDate}
                onChange={(event) => setPreviewDate(event.target.value)}
                className="w-40"
                aria-label="Preview date"
              />
              <Button variant="secondary" onClick={reloadPreview} loading={previewLoading}>
                <Icon name="refresh" className="size-4" />
              </Button>
            </div>
          }
        />
        <div className="px-5 py-4">
          {previewLoading ? (
            <div className="grid place-items-center py-8 text-brand-600">
              <Spinner />
            </div>
          ) : !preview ? (
            <Alert tone="info">Pick a date to preview.</Alert>
          ) : !preview.is_open ? (
            <Alert tone="warning" title={`${preview.day_name} — closed`}>
              {preview.closed_reason}
            </Alert>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-600">
                <Badge tone="brand">{preview.day_name}</Badge>
                <span>
                  <strong className="numeric">{preview.total_slots}</strong> slots ·
                </span>
                <span>
                  <strong className="numeric">{preview.total_capacity}</strong> total
                  appointment capacity
                </span>
                <span className="text-ink-400">
                  ({preview.slot_duration_minutes} min × {preview.capacity_per_slot} patients)
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {preview.slots.map((slot) => (
                  <span
                    key={slot.start_time}
                    title={slot.shift_label ?? undefined}
                    className="numeric rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200"
                  >
                    {formatTime(slot.start_time)}
                  </span>
                ))}
              </div>

              {preview.warnings?.length > 0 && (
                <div className="mt-3">
                  <Alert tone="warning" title="Unusable time">
                    <ul className="list-disc space-y-0.5 pl-4">
                      {preview.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </Alert>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
