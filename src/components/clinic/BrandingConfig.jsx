/**
 * Per-clinic branding and invoice series (Section 19).
 *
 * Almost every clinic leaves all of this blank and inherits the chain brand.
 * It exists because one branch may trade under its own name and file under its
 * own registration — and a document is issued *by a clinic*, so the brand
 * belongs to the clinic rather than to the deployment. That is what makes
 * adding a second brand a data change instead of a code change.
 */

import { useState } from 'react';

import { Alert, Button, Card, CardHeader, Field, Input } from '../ui';
import { clinicService } from '../../services';

const FIELDS = ['brand_name', 'brand_tagline', 'logo_filename', 'document_footer', 'bill_number_prefix'];

function initial(clinic) {
  return Object.fromEntries(FIELDS.map((key) => [key, clinic?.[key] ?? '']));
}

export function BrandingConfig({ clinic, canEdit, onSaved }) {
  const [form, setForm] = useState(() => initial(clinic));
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const usesOwnBrand = Boolean(form.brand_name.trim());
  const ownSeries = form.bill_number_prefix.trim().toUpperCase();
  const dirty = FIELDS.some((key) => (form[key] ?? '') !== (clinic?.[key] ?? ''));

  async function save() {
    setSaving(true);
    setBanner(null);
    setFieldErrors({});
    try {
      // Blank means "inherit"; the API stores that as NULL rather than "".
      const payload = Object.fromEntries(
        FIELDS.map((key) => [key, form[key].trim() || null]),
      );
      const updated = await clinicService.update(clinic.id, payload);
      setForm(initial(updated.clinic ?? updated));
      setBanner({ tone: 'success', message: 'Branding saved.' });
      onSaved?.(updated);
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
      setFieldErrors(err.fieldErrors ?? {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Branding and invoicing"
        description="Leave blank to use the chain brand. Fill this in only for a clinic that trades under its own name."
        action={
          canEdit && (
            <Button size="sm" loading={saving} disabled={!dirty} onClick={save}>
              Save
            </Button>
          )
        }
      />

      <div className="space-y-4 px-5 py-4">
        {banner && (
          <Alert tone={banner.tone} onDismiss={() => setBanner(null)}>
            {banner.message}
          </Alert>
        )}

        {!usesOwnBrand && (
          <Alert tone="info">
            This clinic uses the chain brand on its invoices, receipts and treatment
            statements. Nothing below needs filling in.
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Trading name"
            htmlFor="brand_name"
            hint="Replaces the chain name on documents"
            error={fieldErrors.brand_name}
          >
            <Input
              id="brand_name"
              value={form.brand_name}
              onChange={update('brand_name')}
              disabled={!canEdit}
              placeholder="e.g. Physiocare by Dr Swati"
            />
          </Field>

          <Field label="Tagline" htmlFor="brand_tagline" error={fieldErrors.brand_tagline}>
            <Input
              id="brand_tagline"
              value={form.brand_tagline}
              onChange={update('brand_tagline')}
              disabled={!canEdit}
              placeholder="e.g. Bellandur"
            />
          </Field>

          <Field
            label="Logo file"
            htmlFor="logo_filename"
            hint="Filename in backend/app/assets/. A missing file falls back to the chain logo rather than failing."
            error={fieldErrors.logo_filename}
          >
            <Input
              id="logo_filename"
              value={form.logo_filename}
              onChange={update('logo_filename')}
              disabled={!canEdit}
              placeholder="physiocare-logo.png"
            />
          </Field>

          <Field
            label="Invoice series"
            htmlFor="bill_number_prefix"
            hint="Blank uses the chain series (INV)"
            error={fieldErrors.bill_number_prefix}
          >
            <Input
              id="bill_number_prefix"
              value={form.bill_number_prefix}
              onChange={update('bill_number_prefix')}
              disabled={!canEdit}
              placeholder="PC"
              maxLength={10}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Document footer"
              htmlFor="document_footer"
              hint="Registration or GST lines at the foot of invoices and treatment statements"
              error={fieldErrors.document_footer}
            >
              <Input
                id="document_footer"
                value={form.document_footer}
                onChange={update('document_footer')}
                disabled={!canEdit}
                placeholder="Physiocare Pvt Ltd · GSTIN 29ABCDE1234F1Z5"
              />
            </Field>
          </div>
        </div>

        {ownSeries && (
          <Alert tone="warning">
            Invoices from this clinic will be numbered{' '}
            <strong>
              {ownSeries}-{new Date().getFullYear()}-000001
            </strong>{' '}
            onwards, in a sequence of its own. Set this only for a separate legal entity:
            changing it later leaves a gap in whichever series you move away from, which
            is the first thing an auditor asks about.
          </Alert>
        )}
      </div>
    </Card>
  );
}
