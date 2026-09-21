/**
 * Find-or-create patient picker.
 *
 * Built as a standalone component because Phase 4's booking form needs exactly
 * this: search the patients you can browse, fall back to a chain-wide exact
 * lookup by Patient ID or mobile, and only then offer to register someone new.
 *
 * Props:
 *   onSelect(patient)  — called with the chosen patient
 *   onCreateNew(term)  — optional; renders a "register new patient" action
 */

import { useState } from 'react';

import { Icon } from '../Icon';
import { Alert, Button, Field, Input, Spinner } from '../ui';
import { patientService } from '../../services';
import { lookupParamsFor } from '../../utils/patientLookup';
import { CandidateRow } from './DuplicateWarning';

export function PatientPicker({ onSelect, onCreateNew, autoFocus = false }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [lookedUp, setLookedUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function search(event) {
    event?.preventDefault();
    const query = term.trim();
    if (!query) return;

    setLoading(true);
    setError(null);
    setLookedUp(false);
    try {
      // Browse first: this is the scoped list the user is entitled to.
      const page = await patientService.list({ search: query, page_size: 10 });
      let found = page.items;

      // Nothing locally? Fall back to the chain-wide lookup automatically --
      // this is the whole reason a duplicate does not get created at a second
      // branch. Accepts an exact mobile, an exact Patient ID, or a partial name.
      if (found.length === 0) {
        const params = lookupParamsFor(query);
        if (params) {
          found = await patientService.lookup(params);
          setLookedUp(true);
        }
      }
      setResults(found);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/*
        Deliberately not a <form>. This component is embedded inside the booking
        form, and a nested <form> is invalid HTML: the browser resolves the inner
        submit button against the *outer* form, so pressing Search submitted the
        booking instead of running the search. Enter is handled on the input.
      */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field
            label="Find patient"
            htmlFor="patient-picker"
            hint="Name, mobile number or Patient ID. Your clinic first, then every clinic."
          >
            <Input
              id="patient-picker"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  // Stop Enter from submitting whatever form encloses us.
                  event.preventDefault();
                  search();
                }
              }}
              placeholder="Search…"
              autoFocus={autoFocus}
            />
          </Field>
        </div>
        <Button onClick={search} loading={loading} disabled={!term.trim()}>
          <Icon name="user" className="size-4" />
          Search
        </Button>
      </div>

      {error && (
        <Alert tone="error" onDismiss={() => setError(null)}>
          {error.message}
        </Alert>
      )}

      {loading && (
        <div className="grid place-items-center py-6 text-brand-600">
          <Spinner />
        </div>
      )}

      {!loading && results !== null && (
        <>
          {lookedUp && results.length > 0 && (
            <Alert tone="info">
              Found at another clinic in the chain. Link this patient rather than registering
              them again — their Patient ID stays the same.
            </Alert>
          )}

          {results.length > 0 ? (
            <ul className="space-y-1.5">
              {results.map((patient) => (
                <CandidateRow
                  key={patient.id}
                  patient={patient}
                  onSelect={onSelect}
                  actionLabel="Select"
                />
              ))}
            </ul>
          ) : (
            <div className="rounded-lg bg-ink-50 px-4 py-4 text-center">
              <p className="text-sm text-ink-700">No patient matches “{term.trim()}”.</p>
              <p className="mt-1 text-xs text-ink-500">
                Your clinic and every other clinic were both checked, so it is safe to
                register a new patient.
              </p>
              {onCreateNew && (
                <Button className="mt-3" onClick={() => onCreateNew(term.trim())}>
                  Register a new patient
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
