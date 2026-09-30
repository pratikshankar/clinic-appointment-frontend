/**
 * View / download / send for a generated document (Section 19).
 *
 * Mobile (< 640 px): the send dialog slides up as a BottomSheet.
 * Desktop (≥ 640 px): the same content appears in a centred Modal.
 */

import { useEffect, useState } from 'react';

import { Icon } from '../Icon';
import { Alert, BottomSheet, Button, Field, Input, Modal, Select } from '../ui';
import { openBlob, saveBlob } from '../../services';

const CHANNELS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'Email' },
];

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

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
  const isMobile = useIsMobile();
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
      const delivery = await send({ channel, recipient: recipient.trim() || null });
      setResult(delivery);
      if (delivery.status === 'SENT') onSent?.(delivery);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function openSend() {
    setResult(null);
    setError(null);
    setOpen(true);
  }

  const sendBody = (
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
              {result.error_message ? `: ${result.error_message}` : '.'} The document itself
              is fine — try the other channel, or download and send it yourself.
            </>
          )}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Channel" htmlFor="da_channel" required>
          <Select
            id="da_channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            {CHANNELS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </Field>
        <Field
          label={channel === 'EMAIL' ? 'Email address' : 'WhatsApp number'}
          htmlFor="da_recipient"
          hint={
            patientName
              ? `Leave blank to use ${patientName}'s saved contact`
              : 'Leave blank to use the saved contact'
          }
        >
          <Input
            id="da_recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Optional override"
          />
        </Field>
      </div>
    </div>
  );

  const sendLabel = `Send ${CHANNELS.find((c) => c.value === channel)?.label}`;

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
            onClick={openSend}
          >
            <Icon name="bell" className="size-4" />
          </Button>
        )}
      </div>

      {error && !open && (
        <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>
      )}

      {/* Mobile: bottom sheet */}
      {isMobile ? (
        <BottomSheet open={open} onClose={() => setOpen(false)} title={`Send ${label.toLowerCase()}`}>
          <div className="space-y-4 pb-2">
            {sendBody}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button loading={sending} className="flex-1" onClick={submitSend}>
                {sendLabel}
              </Button>
            </div>
          </div>
        </BottomSheet>
      ) : (
        /* Desktop: centred modal */
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={`Send ${label.toLowerCase()}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
              <Button loading={sending} onClick={submitSend}>{sendLabel}</Button>
            </>
          }
        >
          {sendBody}
        </Modal>
      )}
    </>
  );
}
