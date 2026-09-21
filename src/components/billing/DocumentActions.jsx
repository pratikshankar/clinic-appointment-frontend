/**
 * View / download / send for a generated document (Section 19).
 *
 * The same three actions apply to an invoice, a receipt and a treatment
 * statement, so they live in one component rather than being retyped in three
 * places with three slightly different sets of bugs.
 */

import { useState } from 'react';

import { Icon } from '../Icon';
import { Alert, Button, Field, Input, Modal, Select } from '../ui';
import { openBlob, saveBlob } from '../../services';

const CHANNELS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'Email' },
];

/**
 * @param fetchPdf  () => Promise<{blob, filename}>
 * @param send      ({channel, recipient}) => Promise<DeliveryResult>
 */
export function DocumentActions({
  label = 'Invoice',
  fetchPdf,
  send,
  patientName,
  defaultChannel = 'WHATSAPP',
  size = 'sm',
  onSent,
}) {
  const [busy, setBusy] = useState(null);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState(defaultChannel);
  const [recipient, setRecipient] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function withBusy(key, action) {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function submitSend() {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const delivery = await send({
        channel,
        recipient: recipient.trim() || null,
      });
      setResult(delivery);
      // A provider failure comes back as a 200 with status FAILED, so success
      // here is not the same thing as the message having gone out.
      if (delivery.status === 'SENT') onSent?.(delivery);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <Button
          size={size}
          variant="secondary"
          loading={busy === 'view'}
          title={`Open the ${label.toLowerCase()} in a new tab`}
          onClick={() => withBusy('view', async () => openBlob(await fetchPdf()))}
        >
          <Icon name="receipt" className="size-4" />
          {label}
        </Button>
        <Button
          size={size}
          variant="ghost"
          loading={busy === 'save'}
          aria-label={`Download the ${label.toLowerCase()} PDF`}
          title="Download PDF"
          onClick={() => withBusy('save', async () => saveBlob(await fetchPdf()))}
        >
          ↓
        </Button>
        {send && (
          <Button
            size={size}
            variant="ghost"
            aria-label={`Send the ${label.toLowerCase()}`}
            title="Send by WhatsApp or email"
            onClick={() => {
              setResult(null);
              setError(null);
              setOpen(true);
            }}
          >
            <Icon name="bell" className="size-4" />
          </Button>
        )}
      </div>

      {error && !open && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Send ${label.toLowerCase()}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button loading={sending} onClick={submitSend}>
              Send {CHANNELS.find((c) => c.value === channel)?.label}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          {result && (
            <Alert tone={result.status === 'SENT' ? 'success' : 'error'}>
              {result.status === 'SENT' ? (
                <>
                  <strong>{result.filename}</strong> sent to {result.recipient} by{' '}
                  {result.channel.toLowerCase()}.
                </>
              ) : (
                <>
                  Could not send to {result.recipient}
                  {result.error_message ? `: ${result.error_message}` : '.'} The document
                  itself is fine — try the other channel, or download and send it
                  yourself.
                </>
              )}
            </Alert>
          )}

          <Alert tone="info">
            Provider integrations are mocked in this build, so the PDF is generated and
            the attempt is logged, but nothing reaches a real phone or inbox yet.
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Channel" htmlFor="send_channel" required>
              <Select
                id="send_channel"
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
              >
                {CHANNELS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={channel === 'EMAIL' ? 'Email address' : 'WhatsApp number'}
              htmlFor="send_recipient"
              hint={
                patientName
                  ? `Leave blank to use ${patientName}'s saved contact`
                  : 'Leave blank to use the saved contact'
              }
            >
              <Input
                id="send_recipient"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="Optional override"
              />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
