import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Icon } from '../../components/Icon';
import {
  Alert,
  Badge,
  Button,
  Card,
  PageHeader,
  Spinner,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { refundService, saveBlob } from '../../services';
import { formatDate, formatMoney } from '../../utils/format';

const STATUS_TONES = {
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  COMPLETED: 'success',
};

const STATUS_LABELS = {
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed',
};

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between py-1.5 text-sm border-b border-ink-100 last:border-0">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-800 max-w-[60%]">{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <Card className="mb-4">
      <div className="border-b border-ink-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-ink-700 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-5 py-3">{children}</div>
    </Card>
  );
}

export default function RefundDetail() {
  const { role } = useAuth();
  const { refundId } = useParams();
  const navigate = useNavigate();
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';

  const basePath =
    role === 'SUPERADMIN' ? '/superadmin' : role === 'ADMIN' ? '/admin' : '/clinic';

  const { data: refund, loading, error, reload } = useApi(
    () => refundService.get(refundId),
    [refundId],
  );

  const [reviewNotes, setReviewNotes] = useState('');
  const [completing, setCompleting] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const fileRef = useRef(null);
  const [attachmentType, setAttachmentType] = useState('CANCELLATION_DOCUMENT');

  async function handleReview(approved) {
    setActionError('');
    setActionSuccess('');
    try {
      await refundService.review(refundId, { approved, review_notes: reviewNotes || undefined });
      setActionSuccess(approved ? 'Refund approved.' : 'Refund rejected.');
      reload();
    } catch (err) {
      setActionError(err.message ?? 'Action failed');
    }
  }

  async function handleComplete() {
    if (!paymentRef.trim()) {
      setActionError('Enter a payment reference before marking complete.');
      return;
    }
    setActionError('');
    setCompleting(true);
    try {
      await refundService.complete(refundId, { payment_reference: paymentRef });
      setActionSuccess('Refund marked as completed.');
      reload();
    } catch (err) {
      setActionError(err.message ?? 'Action failed');
    } finally {
      setCompleting(false);
    }
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      await refundService.uploadAttachment(refundId, file, attachmentType);
      fileRef.current.value = '';
      reload();
    } catch (err) {
      setUploadError(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(attachmentId) {
    setDownloadingId(attachmentId);
    try {
      const result = await refundService.downloadAttachment(refundId, attachmentId);
      saveBlob(result);
    } catch (err) {
      setActionError(err.message ?? 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error.message}
      </div>
    );
  }

  if (!refund) return null;

  const isPending = refund.status === 'PENDING_APPROVAL';
  const isApproved = refund.status === 'APPROVED';
  const isCompleted = refund.status === 'COMPLETED';

  return (
    <>
      <PageHeader
        title={`Refund #${refund.id}`}
        description={
          refund.patient_name
            ? `For ${refund.patient_name}${refund.patient_code ? ` (${refund.patient_code})` : ''}`
            : ''
        }
        action={
          <div className="flex gap-2">
            <Button variant="secondary" as={Link} to={`${basePath}/refunds`}>
              <Icon name="chevron-left" className="mr-1 size-4" />
              All refunds
            </Button>
            <Button variant="secondary" onClick={reload}>
              <Icon name="refresh" className="size-4" />
            </Button>
          </div>
        }
      />

      {actionSuccess && (
        <Alert tone="success" onDismiss={() => setActionSuccess('')} className="mb-4">
          {actionSuccess}
        </Alert>
      )}
      {actionError && (
        <Alert tone="danger" onDismiss={() => setActionError('')} className="mb-4">
          {actionError}
        </Alert>
      )}

      <div className="max-w-2xl space-y-0">
        {/* Status + summary */}
        <Section title="Overview">
          <div className="mb-3 flex items-center gap-2">
            <Badge tone={STATUS_TONES[refund.status]} size="lg">
              {STATUS_LABELS[refund.status]}
            </Badge>
          </div>
          <InfoRow label="Patient" value={
            refund.patient_id
              ? <Link to={`${basePath}/patients/${refund.patient_id}`} className="text-brand-600 hover:underline">
                  {refund.patient_name}
                </Link>
              : refund.patient_name
          } />
          <InfoRow label="Clinic" value={refund.clinic_name} />
          <InfoRow label="Initiated by" value={refund.initiated_by_name} />
          <InfoRow label="Initiated on" value={formatDate(refund.created_at)} />
        </Section>

        {/* Reason */}
        <Section title="Cancellation reason">
          <p className="whitespace-pre-wrap text-sm text-ink-800">{refund.reason}</p>
        </Section>

        {/* Calculation */}
        <Section title="Refund calculation">
          <div className="mb-3 grid grid-cols-3 gap-3 rounded-lg bg-ink-50 px-4 py-3 text-center text-sm">
            <div>
              <div className="text-xs text-ink-500">Sessions consumed</div>
              <div className="font-semibold">{refund.sessions_consumed}</div>
            </div>
            <div>
              <div className="text-xs text-ink-500">Sessions registered</div>
              <div className="font-semibold">{refund.sessions_registered}</div>
            </div>
            <div>
              <div className="text-xs text-ink-500">Total paid</div>
              <div className="font-semibold">{formatMoney(refund.total_paid)}</div>
            </div>
          </div>

          <InfoRow label="Single session rate" value={formatMoney(refund.single_session_rate)} />
          <InfoRow label="Package session rate" value={formatMoney(refund.package_session_rate)} />
          <InfoRow label="Consultation fee (non-refundable)" value={formatMoney(refund.consultation_fee)} />
          <InfoRow label="Total deduction" value={formatMoney(refund.deduction_amount)} />
          <div className="mt-2 flex justify-between border-t border-ink-200 pt-2 text-sm font-bold">
            <span>Refund amount</span>
            <span className="text-brand-700">{formatMoney(refund.refund_amount)}</span>
          </div>
          {refund.calculation_notes && (
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
              {refund.calculation_notes}
            </pre>
          )}
        </Section>

        {/* Payment details */}
        <Section title="Payment details">
          <InfoRow label="Method" value={refund.payment_method === 'BANK_TRANSFER' ? 'Bank transfer' : 'UPI'} />
          {refund.payment_method === 'BANK_TRANSFER' && (
            <>
              <InfoRow label="Account name" value={refund.bank_account_name} />
              <InfoRow label="Account number" value={refund.bank_account_number} />
              <InfoRow label="IFSC" value={refund.bank_ifsc} />
            </>
          )}
          {refund.payment_method === 'UPI' && (
            <InfoRow label="UPI ID" value={refund.upi_id} />
          )}
        </Section>

        {/* Review details */}
        {(refund.reviewed_by_name || refund.reviewed_at) && (
          <Section title="Review">
            <InfoRow label="Reviewed by" value={refund.reviewed_by_name} />
            <InfoRow label="Reviewed at" value={formatDate(refund.reviewed_at)} />
            <InfoRow label="Notes" value={refund.review_notes} />
          </Section>
        )}

        {/* Completion details */}
        {isCompleted && (
          <Section title="Completion">
            <InfoRow label="Completed by" value={refund.completed_by_name} />
            <InfoRow label="Completed at" value={formatDate(refund.completed_at)} />
            <InfoRow label="Payment reference" value={refund.payment_reference} />
          </Section>
        )}

        {/* Attachments */}
        <Section title="Attachments">
          {refund.attachments.length === 0 && (
            <p className="text-sm text-ink-400">No attachments yet.</p>
          )}
          {refund.attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between py-2 border-b border-ink-100 last:border-0"
            >
              <div>
                <div className="text-sm font-medium text-ink-800">{a.file_name}</div>
                <div className="text-xs text-ink-400">
                  {a.attachment_type === 'PAYMENT_PROOF' ? 'Payment proof' : 'Cancellation document'}
                  {' · '}
                  {formatDate(a.uploaded_at)}
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                loading={downloadingId === a.id}
                onClick={() => handleDownload(a.id)}
              >
                <Icon name="download" className="size-4" />
              </Button>
            </div>
          ))}

          {/* Upload form — shown when not completed */}
          {!isCompleted && (
            <div className="mt-4 space-y-2 border-t border-ink-100 pt-4">
              <h4 className="text-sm font-medium text-ink-700">Upload attachment</h4>
              {uploadError && (
                <p className="text-xs text-red-600">{uploadError}</p>
              )}
              <select
                className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
                value={attachmentType}
                onChange={(e) => setAttachmentType(e.target.value)}
              >
                <option value="CANCELLATION_DOCUMENT">Cancellation document</option>
                <option value="PAYMENT_PROOF">Payment proof</option>
              </select>
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileRef}
                  accept="application/pdf,image/*"
                  className="flex-1 rounded-lg border border-ink-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-2 file:py-1 file:text-xs"
                />
                <Button size="sm" loading={uploading} onClick={handleUpload}>
                  Upload
                </Button>
              </div>
              <p className="text-xs text-ink-400">PDF or image, max 10 MB</p>
            </div>
          )}
        </Section>

        {/* Admin: approve / reject */}
        {isAdmin && isPending && (
          <Card className="mb-4 border-amber-200 bg-amber-50">
            <div className="px-5 py-4 space-y-3">
              <h3 className="font-semibold text-amber-800">Review this request</h3>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700">
                  Review notes (optional)
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => handleReview(true)}
                >
                  <Icon name="check" className="mr-1 size-4" />
                  Approve
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => handleReview(false)}
                >
                  <Icon name="x" className="mr-1 size-4" />
                  Reject
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Admin: mark complete */}
        {isAdmin && isApproved && (
          <Card className="mb-4 border-brand-200 bg-brand-50">
            <div className="px-5 py-4 space-y-3">
              <h3 className="font-semibold text-brand-800">Mark transfer complete</h3>
              <p className="text-sm text-ink-600">
                Enter the UTR / transaction reference after transferring{' '}
                <strong>{formatMoney(refund.refund_amount)}</strong> to the patient.
              </p>
              <input
                className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
                placeholder="UTR number / transaction reference"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
              <Button
                className="w-full"
                loading={completing}
                onClick={handleComplete}
              >
                <Icon name="check-circle" className="mr-1 size-4" />
                Mark as Completed
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
