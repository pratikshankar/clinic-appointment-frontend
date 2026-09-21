/**
 * Patient profile: the complete timeline from Section 21.
 *
 * Layout follows the spec's order — basic information, treatment package,
 * appointment history, session history, billing. Sections that are empty say so
 * rather than being hidden, because "no sessions recorded" is information.
 */

import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Icon } from '../../components/Icon';
import { ChargeForm } from '../../components/billing/ChargeForm';
import { DocumentActions } from '../../components/billing/DocumentActions';
import { RecordPaymentForm } from '../../components/billing/RecordPaymentForm';
import { PackageForm } from '../../components/session/PackageForm';
import { SessionForm } from '../../components/session/SessionForm';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
  Table,
  Td,
  Th,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { billingService, clinicService, patientService, sessionService } from '../../services';
import {
  formatCurrency,
  formatDate,
  formatMoney,
  formatNumber,
  formatTime,
} from '../../utils/format';

const APPOINTMENT_TONES = {
  BOOKED: 'info',
  CONFIRMED: 'brand',
  CHECKED_IN: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  RESCHEDULED: 'neutral',
  NO_SHOW: 'danger',
};

const PAYMENT_TONES = { PAID: 'success', PARTIAL: 'warning', UNPAID: 'danger' };

export default function PatientProfile() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const basePath = role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const [loggingSession, setLoggingSession] = useState(false);
  const [addingPackage, setAddingPackage] = useState(false);
  const [addingCharge, setAddingCharge] = useState(false);
  const [payingBill, setPayingBill] = useState(null);
  const [openBillId, setOpenBillId] = useState(null);
  const { data: clinics } = useApi(() => clinicService.list({ status: 'ACTIVE' }), []);

  const { data, loading, error, reload } = useApi(
    () => patientService.profile(patientId),
    [patientId]
  );

  // Fetched separately from the profile because the full bill -- its lines and
  // its payments -- is what makes a total explainable at the desk, and the
  // profile endpoint returns only the summary row.
  const {
    data: bills,
    loading: billsLoading,
    reload: reloadBills,
  } = useApi(() => billingService.forPatient(patientId), [patientId]);

  async function reloadAll() {
    await Promise.all([reload(), reloadBills()]);
  }

  async function toggleArchive() {
    setBusy(true);
    setBanner(null);
    try {
      const action = data.patient.is_active ? patientService.archive : patientService.restore;
      await action(patientId);
      await reload();
    } catch (err) {
      setBanner({ tone: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card className="grid place-items-center py-20 text-brand-600">
        <Spinner size="lg" />
      </Card>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader
          title="Patient"
          breadcrumb={[{ label: 'Patients', to: `${basePath}/patients` }]}
        />
        <Alert tone="error" title="Could not load this patient">
          {error.message}
        </Alert>
      </>
    );
  }

  const { patient } = data;
  const cancelled = data.cancelled_package_count ?? 0;
  const cancelledNote =
    cancelled > 0
      ? `Excludes ${cancelled} cancelled package${cancelled === 1 ? '' : 's'}`
      : undefined;

  return (
    <>
      <PageHeader
        title={patient.full_name}
        backTo={`${basePath}/patients`}
        backLabel="All patients"
        breadcrumb={[
          { label: 'Patients', to: `${basePath}/patients` },
          { label: patient.patient_code },
        ]}
        description={[
          patient.age ? `${patient.age} years` : null,
          patient.gender ? patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase() : null,
          patient.primary_clinic_name,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <div className="flex flex-wrap gap-2">
            {patient.is_active && (
              <>
                <Link
                  to={`${basePath}/appointments/new?patient_id=${patient.id}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  <Icon name="calendar" className="size-4" />
                  Book next appointment
                </Link>
                <Button variant="secondary" onClick={() => setLoggingSession(true)}>
                  <Icon name="activity" className="size-4" />
                  Log session
                </Button>
              </>
            )}
            <Link
              to={`${basePath}/patients/${patient.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-ink-800 ring-1 ring-inset ring-ink-300 hover:bg-ink-50"
            >
              <Icon name="sliders" className="size-4" />
              Edit
            </Link>
            <Button
              variant={patient.is_active ? 'danger' : 'primary'}
              loading={busy}
              onClick={toggleArchive}
            >
              {patient.is_active ? 'Archive' : 'Restore'}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="brand">{patient.patient_code}</Badge>
        {!patient.is_active && <Badge tone="danger">Archived</Badge>}
        {!patient.is_profile_complete && (
          <Badge tone="warning">Profile incomplete</Badge>
        )}
        {data.packages.filter((p) => p.status === 'ACTIVE' && p.sessions_remaining > 0)
          .length === 0 && <Badge tone="neutral">No active package</Badge>}
        {patient.source_name && <Badge tone="neutral">via {patient.source_name}</Badge>}
      </div>

      {banner && (
        <div className="mb-4">
          <Alert tone={banner.tone} onDismiss={() => setBanner(null)}>
            {banner.message}
          </Alert>
        </div>
      )}

      {!patient.is_profile_complete && (
        <div className="mb-4">
          <Alert tone="warning" title="This profile is incomplete">
            It was created from a booking with only the essentials. Add gender, address and
            source to complete it.{' '}
            <Link
              to={`${basePath}/patients/${patient.id}/edit`}
              className="font-medium underline"
            >
              Complete now
            </Link>
          </Alert>
        </div>
      )}

      {data.scoped_to_your_clinics && (
        <div className="mb-4">
          <Alert tone="info">
            Showing this patient's history at your clinic. Treatment given at other branches is
            not listed.
          </Alert>
        </div>
      )}

      {/* Roll-ups */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/*
          These count live packages only. Saying so on the card is what stops
          the difference between "10" in the table and "0" here from reading as
          a bug to whoever is looking at it next.
        */}
        <StatCard
          label="Sessions registered"
          value={formatNumber(data.total_sessions_registered)}
          hint={cancelledNote}
        />
        <StatCard label="Sessions taken" value={formatNumber(data.total_sessions_taken)} tone="brand" />
        <StatCard
          label="Sessions remaining"
          value={formatNumber(data.total_sessions_remaining)}
          tone="positive"
          hint={cancelledNote}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(data.total_outstanding)}
          tone={Number(data.total_outstanding) > 0 ? 'warning' : 'default'}
          hint={`${formatCurrency(data.total_paid)} paid of ${formatCurrency(data.total_billed)}`}
        />
      </div>

      <div className="space-y-4">
        {/* Basic information */}
        <Card>
          <CardHeader title="Basic information" />
          <dl className="grid gap-x-6 divide-y divide-ink-100 text-sm sm:grid-cols-2 sm:divide-y-0">
            {[
              ['Patient ID', patient.patient_code],
              ['Mobile', patient.mobile],
              [
                'WhatsApp',
                patient.whatsapp_number
                  ? patient.whatsapp_number
                  : patient.mobile
                    ? `${patient.mobile} (same as mobile)`
                    : null,
              ],
              ['Email', patient.email],
              [
                'Age',
                patient.age
                  ? `${patient.age}${
                      patient.age_as_of === 'date_of_birth' ? ' (from date of birth)' : ' (at registration)'
                    }`
                  : null,
              ],
              ['Date of birth', patient.date_of_birth ? formatDate(patient.date_of_birth) : null],
              ['Gender', patient.gender],
              ['Address', patient.address],
              ['Chief complaint', patient.chief_complaint],
              ['Diagnosis', patient.diagnosis],
              ['Source', patient.source_name],
              ['Source detail', patient.source_detail],
              ['Registered', formatDate(patient.registration_date)],
              ['Home clinic', patient.primary_clinic_name],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-4 px-5 py-2.5">
                <dt className="w-36 shrink-0 text-ink-500">{label}</dt>
                <dd className="min-w-0 break-words text-ink-900">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Treatment packages */}
        <Card>
          <CardHeader
            title="Treatment packages"
            description="Purchased session blocks. Sessions consume the oldest active package first."
            action={
              patient.is_active && (
                <Button size="sm" onClick={() => setAddingPackage(true)}>
                  Register package
                </Button>
              )
            }
          />
          {data.packages.length === 0 ? (
            <EmptyState
              title="No treatment package"
              description="No session package has been registered for this patient."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Package</Th>
                  <Th>Clinic</Th>
                  <Th align="right">Registered</Th>
                  <Th align="right">Taken</Th>
                  <Th align="right">Remaining</Th>
                  <Th align="right">Value</Th>
                  <Th>Status</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {data.packages.map((pkg) => {
                  // A cancelled package is kept as history, but nothing about it
                  // is still available -- so it is greyed out and its remaining
                  // count reads "—", not the number it was registered for.
                  const isCancelled = pkg.status === 'CANCELLED';
                  return (
                  <tr
                    key={pkg.id}
                    className={isCancelled ? 'text-ink-400' : 'hover:bg-ink-50/60'}
                  >
                    <Td className={isCancelled ? 'line-through' : 'font-medium text-ink-900'}>
                      {pkg.package_name ?? `${pkg.sessions_registered}-session package`}
                      {pkg.start_date && (
                        <div className="text-xs text-ink-500">
                          from {formatDate(pkg.start_date)}
                        </div>
                      )}
                    </Td>
                    <Td>{pkg.clinic_name ?? '—'}</Td>
                    <Td align="right">{pkg.sessions_registered}</Td>
                    <Td align="right">{pkg.sessions_taken}</Td>
                    <Td align="right">
                      {isCancelled ? (
                        <span title="Cancelled — no sessions available">—</span>
                      ) : (
                        <span className="font-medium text-emerald-700">
                          {pkg.sessions_remaining}
                        </span>
                      )}
                    </Td>
                    <Td align="right">{formatCurrency(pkg.total_amount)}</Td>
                    <Td>
                      <Badge
                        tone={
                          pkg.status === 'ACTIVE'
                            ? 'success'
                            : isCancelled
                              ? 'danger'
                              : 'neutral'
                        }
                      >
                        {pkg.status}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                      {/*
                        The insurance document: every session date with the amounts
                        billed against them. Available mid-course too, stamped
                        PROVISIONAL so it cannot pass as a final claim.
                      */}
                      <DocumentActions
                        label="Statement"
                        patientName={patient.full_name}
                        fetchPdf={() => billingService.statementPdf(pkg.id)}
                        send={(payload) => billingService.sendStatement(pkg.id, payload)}
                      />
                      {pkg.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await sessionService.cancelPackage(pkg.id, 'Cancelled from profile');
                              await reloadAll();
                              setBanner({
                                tone: 'success',
                                message:
                                  'Package cancelled. Its sessions no longer count towards this ' +
                                  'patient’s totals; the row is kept as history.',
                              });
                            } catch (err) {
                              setBanner({ tone: 'error', message: err.message });
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                      </div>
                    </Td>
                  </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Appointment history */}
        <Card>
          <CardHeader
            title="Appointment history"
            description="Every booking, reschedule and cancellation for this patient."
          />
          {data.appointments.length === 0 ? (
            <EmptyState
              title="No appointments"
              description="This patient has no appointment history yet."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Time</Th>
                  <Th>Clinic</Th>
                  <Th>Reference</Th>
                  <Th>Complaint</Th>
                  <Th align="right">Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {data.appointments.map((appointment) => (
                  <tr key={appointment.id} className="hover:bg-ink-50/60">
                    <Td className="font-medium text-ink-900">
                      {formatDate(appointment.appointment_date)}
                    </Td>
                    <Td className="numeric">{formatTime(appointment.start_time)}</Td>
                    <Td>{appointment.clinic_name ?? '—'}</Td>
                    <Td>
                      <span className="numeric text-xs text-ink-500">
                        {appointment.appointment_code}
                      </span>
                    </Td>
                    <Td>{appointment.chief_complaint ?? '—'}</Td>
                    <Td align="right">
                      <Badge tone={APPOINTMENT_TONES[appointment.status] ?? 'neutral'}>
                        {appointment.status}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Session history */}
        <Card>
          <CardHeader
            title="Session history"
            description="Physiotherapy sessions delivered. A wrong entry is voided, never deleted."
            action={
              patient.is_active && (
                <Button size="sm" variant="secondary" onClick={() => setLoggingSession(true)}>
                  Log session
                </Button>
              )
            }
          />
          {data.sessions.length === 0 ? (
            <EmptyState
              title="No sessions recorded"
              description="Log a session here, or complete one of this patient's appointments."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th align="right">#</Th>
                  <Th>Date</Th>
                  <Th>Therapist</Th>
                  <Th>Treatment</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {data.sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-ink-50/60">
                    <Td align="right" className="font-medium text-ink-900">
                      {session.session_number}
                    </Td>
                    <Td>{formatDate(session.session_date)}</Td>
                    <Td>{session.therapist_name ?? '—'}</Td>
                    <Td>{session.treatment_provided ?? '—'}</Td>
                    <Td className="text-ink-600">{session.notes ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Billing */}
        <Card>
          <CardHeader
            title="Billing"
            description="Bills and payments. Anything charged here is separate from the package — it does not use up a session."
            action={
              patient.is_active && (
                <Button size="sm" variant="secondary" onClick={() => setAddingCharge(true)}>
                  Add a charge
                </Button>
              )
            }
          />
          {billsLoading ? (
            <div className="grid place-items-center py-10 text-brand-600">
              <Spinner />
            </div>
          ) : (bills ?? []).length === 0 ? (
            <EmptyState
              title="No bills"
              description="Nothing has been billed to this patient. Registering a package or adding a charge creates one."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Bill</Th>
                  <Th>Date</Th>
                  <Th>Clinic</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Paid</Th>
                  <Th align="right">Balance</Th>
                  <Th align="right">Status</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {(bills ?? []).map((bill) => (
                  <Fragment key={bill.id}>
                    <tr className="hover:bg-ink-50/60">
                      <Td className="numeric font-medium text-ink-900">
                        <button
                          type="button"
                          className="underline decoration-dotted underline-offset-2"
                          onClick={() =>
                            setOpenBillId((current) => (current === bill.id ? null : bill.id))
                          }
                          aria-expanded={openBillId === bill.id}
                        >
                          {bill.bill_number}
                        </button>
                      </Td>
                      <Td>{formatDate(bill.bill_date)}</Td>
                      <Td>{bill.clinic_name ?? '—'}</Td>
                      <Td align="right" className="numeric">
                        {formatMoney(bill.total_amount)}
                      </Td>
                      <Td align="right" className="numeric">
                        {formatMoney(bill.amount_paid)}
                      </Td>
                      <Td align="right" className="numeric">
                        {Number(bill.balance_amount) > 0 ? (
                          <span className="font-medium text-amber-700">
                            {formatMoney(bill.balance_amount)}
                          </span>
                        ) : (
                          formatMoney(0)
                        )}
                      </Td>
                      <Td align="right">
                        <Badge tone={PAYMENT_TONES[bill.payment_status] ?? 'neutral'}>
                          {bill.payment_status}
                        </Badge>
                      </Td>
                      <Td align="right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <DocumentActions
                            label="Invoice"
                            patientName={patient.full_name}
                            fetchPdf={() => billingService.invoicePdf(bill.id)}
                            send={(payload) => billingService.sendInvoice(bill.id, payload)}
                          />
                          {Number(bill.balance_amount) > 0 && patient.is_active && (
                            <Button size="sm" onClick={() => setPayingBill(bill)}>
                              Record payment
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>

                    {openBillId === bill.id && (
                      <tr>
                        <Td className="bg-ink-50/60" colSpan={8}>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-600">
                                Charges
                              </p>
                              <ul className="space-y-1 text-sm">
                                {bill.items.map((item) => (
                                  <li key={item.id} className="flex justify-between gap-4">
                                    <span className="text-ink-700">
                                      {item.description}
                                      {item.quantity > 1 && (
                                        <span className="text-ink-500">
                                          {' '}
                                          × {item.quantity} @ {formatMoney(item.unit_price)}
                                        </span>
                                      )}
                                    </span>
                                    <span className="numeric shrink-0">
                                      {formatMoney(item.amount)}
                                    </span>
                                  </li>
                                ))}
                                {Number(bill.discount_amount) > 0 && (
                                  <li className="flex justify-between gap-4 text-emerald-700">
                                    <span>Discount</span>
                                    <span className="numeric">
                                      −{formatMoney(bill.discount_amount)}
                                    </span>
                                  </li>
                                )}
                              </ul>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-600">
                                Payments
                              </p>
                              {bill.payments.length === 0 ? (
                                <p className="text-sm text-ink-500">Nothing received yet.</p>
                              ) : (
                                <ul className="space-y-1 text-sm">
                                  {bill.payments.map((payment) => (
                                    <li
                                      key={payment.id}
                                      className="flex flex-wrap items-center justify-between gap-2"
                                    >
                                      <span className="text-ink-700">
                                        {formatDate(payment.payment_date)} ·{' '}
                                        {payment.payment_method.replace('_', ' ').toLowerCase()}
                                        {payment.reference_number && (
                                          <span className="numeric text-ink-500">
                                            {' '}
                                            · {payment.reference_number}
                                          </span>
                                        )}
                                      </span>
                                      <span className="flex items-center gap-2">
                                        <span className="numeric shrink-0 font-medium">
                                          {formatMoney(payment.amount)}
                                        </span>
                                        {/*
                                          One receipt per payment: what the patient
                                          is handed for the amount they paid today,
                                          separate from the invoice for the bill.
                                        */}
                                        <DocumentActions
                                          label="Receipt"
                                          patientName={patient.full_name}
                                          fetchPdf={() => billingService.receiptPdf(payment.id)}
                                          send={(payload) =>
                                            billingService.sendReceipt(payment.id, payload)
                                          }
                                        />
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {bill.notes && (
                                <p className="mt-2 text-xs text-ink-500">{bill.notes}</p>
                              )}
                            </div>
                          </div>
                        </Td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <SessionForm
        open={loggingSession}
        patientId={patient.id}
        title={`Record session — ${patient.full_name}`}
        onClose={() => setLoggingSession(false)}
        onSaved={async (result) => {
          setLoggingSession(false);
          setBanner({
            tone: 'success',
            message: [
              `Session ${result.session.session_number} recorded.`,
              result.package
                ? `${result.package.sessions_remaining} of ${result.package.sessions_registered} remaining.`
                : 'Logged without consuming a package.',
              ...(result.warnings ?? []),
            ].join(' '),
          });
          await reloadAll();
        }}
      />

      <PackageForm
        open={addingPackage}
        patientId={patient.id}
        clinics={clinics}
        defaultClinicId={patient.primary_clinic_id}
        onClose={() => setAddingPackage(false)}
        onSaved={async (created) => {
          setAddingPackage(false);
          setBanner({
            tone: 'success',
            message: [
              `Registered ${created.sessions_registered} sessions at ${formatMoney(
                created.price_per_session,
              )} each.`,
              created.bill
                ? `Bill ${created.bill.bill_number} for ${formatMoney(
                    created.bill.total_amount,
                  )}${
                    Number(created.bill.balance_amount) > 0
                      ? ` — ${formatMoney(created.bill.balance_amount)} outstanding.`
                      : ', paid in full.'
                  }`
                : null,
            ]
              .filter(Boolean)
              .join(' '),
          });
          await reloadAll();
        }}
      />

      <ChargeForm
        open={addingCharge}
        patientId={patient.id}
        patientName={patient.full_name}
        clinics={clinics}
        defaultClinicId={patient.primary_clinic_id}
        onClose={() => setAddingCharge(false)}
        onSaved={async (bill) => {
          setAddingCharge(false);
          setBanner({
            tone: 'success',
            message: `Bill ${bill.bill_number} raised for ${formatMoney(bill.total_amount)}${
              Number(bill.balance_amount) > 0
                ? ` — ${formatMoney(bill.balance_amount)} outstanding.`
                : ', paid in full.'
            } No package session was used.`,
          });
          await reloadAll();
        }}
      />

      <RecordPaymentForm
        open={Boolean(payingBill)}
        bill={payingBill}
        onClose={() => setPayingBill(null)}
        onSaved={async (bill) => {
          setPayingBill(null);
          setBanner({
            tone: 'success',
            message: `Payment recorded on ${bill.bill_number}. ${
              Number(bill.balance_amount) > 0
                ? `${formatMoney(bill.balance_amount)} still outstanding.`
                : 'Paid in full.'
            }`,
          });
          await reloadAll();
        }}
      />

      <div className="mt-6 flex justify-center">
        <Link
          to={`${basePath}/patients`}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-ink-700 ring-1 ring-inset ring-ink-300 hover:bg-ink-50"
        >
          <Icon name="users" className="size-4" />
          Back to all patients
        </Link>
      </div>
    </>
  );
}
