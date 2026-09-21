/**
 * Duplicate candidates shown while registering a patient.
 *
 * The whole point of Section 38 is that one person keeps one Patient ID. This
 * component makes linking the existing patient the easy path, and creating a
 * second record the deliberate one.
 */

import { Alert, Badge, Button } from '../ui';

function CandidateRow({ patient, onSelect, actionLabel = 'Use this patient' }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 px-3 py-2 ring-1 ring-inset ring-ink-200">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900">
          {patient.full_name}{' '}
          <span className="numeric text-xs font-normal text-ink-500">
            {patient.patient_code}
          </span>
        </p>
        <p className="text-xs text-ink-500">
          {patient.mobile}
          {patient.primary_clinic_name ? ` · ${patient.primary_clinic_name}` : ''}
          {!patient.is_profile_complete && ' · profile incomplete'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {!patient.in_your_scope && <Badge tone="warning">Another clinic</Badge>}
        {onSelect && (
          <Button size="sm" variant="secondary" onClick={() => onSelect(patient)}>
            {actionLabel}
          </Button>
        )}
      </div>
    </li>
  );
}

export function DuplicateWarning({ result, onSelect }) {
  if (!result) return null;

  const { exact_match: exact, same_mobile: sameMobile = [], similar_name: similarName = [] } =
    result;

  if (!exact && sameMobile.length === 0 && similarName.length === 0) return null;

  if (exact) {
    return (
      <Alert tone="error" title="This patient is already registered">
        <p className="mb-2">
          Saving will be refused — the same name and mobile number already exist. Open the
          existing record instead so their history stays in one place.
        </p>
        <ul className="space-y-1.5">
          <CandidateRow patient={exact} onSelect={onSelect} actionLabel="Open patient" />
        </ul>
      </Alert>
    );
  }

  return (
    <Alert tone="warning" title="Possible match found">
      {sameMobile.length > 0 && (
        <>
          <p className="mb-2">
            {sameMobile.length === 1 ? 'A patient' : 'Patients'} already registered with this
            mobile number. Families often share a number, so continue only if this is a
            different person.
          </p>
          <ul className="space-y-1.5">
            {sameMobile.map((patient) => (
              <CandidateRow key={patient.id} patient={patient} onSelect={onSelect} />
            ))}
          </ul>
        </>
      )}

      {similarName.length > 0 && (
        <>
          <p className="mb-2 mt-3">
            Same name, different mobile number — check whether the number simply changed.
          </p>
          <ul className="space-y-1.5">
            {similarName.map((patient) => (
              <CandidateRow key={patient.id} patient={patient} onSelect={onSelect} />
            ))}
          </ul>
        </>
      )}
    </Alert>
  );
}

export { CandidateRow };
