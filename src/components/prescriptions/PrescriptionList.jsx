import { useState } from 'react';
import { Alert, Badge, Button, EmptyState } from '../ui';
import { prescriptionService } from '../../services/prescriptionService.js';
import { api } from '../../services/api.js';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function SendDialog({ prescription, channel, onClose }) {
  const isWhatsApp = channel === 'whatsapp';
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function send() {
    setLoading(true);
    setResult(null);
    try {
      const r = isWhatsApp
        ? await prescriptionService.sendWhatsapp(prescription.id, value || null)
        : await prescriptionService.send(prescription.id, value || null);
      setResult(r);
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-5">
        <h3 className="font-semibold text-ink-900 mb-3">
          {isWhatsApp ? 'Send via WhatsApp' : 'Email Prescription'}
        </h3>
        {result ? (
          <>
            <Alert tone={result.success ? 'success' : 'error'}>
              {result.success ? 'Prescription sent successfully.' : result.error || 'Send failed.'}
            </Alert>
            <div className="mt-3 flex justify-end">
              <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-600 mb-3">
              {isWhatsApp
                ? "Enter a WhatsApp number to override, or leave blank to use the patient's number on file."
                : "Enter an email address to override, or leave blank to send to the patient's email on file."}
            </p>
            <input
              type={isWhatsApp ? 'tel' : 'email'}
              className="block w-full rounded-md border border-ink-300 px-3 py-2 text-sm mb-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
              placeholder={isWhatsApp ? '+91 98765 43210' : 'patient@email.com'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" loading={loading} onClick={send}>
                {isWhatsApp ? 'Send on WhatsApp' : 'Send Email'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function PrescriptionList({ prescriptions, loading, onNew }) {
  const [pdfBusy, setPdfBusy] = useState(null);
  const [sending, setSending] = useState(null);
  const [sendChannel, setSendChannel] = useState('email');

  async function openPdf(id) {
    setPdfBusy(id);
    try {
      await prescriptionService.openPdf(id);
    } catch {
      // ignore
    } finally {
      setPdfBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-ink-500">Loading prescriptions…</div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink-700">Prescriptions</h3>
        <Button size="sm" onClick={onNew}>+ New Prescription</Button>
      </div>

      {prescriptions.length === 0 ? (
        <EmptyState
          title="No prescriptions yet"
          description="Create a prescription to give the patient a PDF they can take home."
        />
      ) : (
        <div className="divide-y divide-ink-100 rounded-lg border border-ink-200 bg-white">
          {prescriptions.map((prx) => (
            <div key={prx.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">
                    Rx #{prx.id}
                    {prx.prescribed_by?.full_name && (
                      <span className="ml-2 font-normal text-ink-500">
                        · {prx.prescribed_by.full_name}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-400 mt-0.5">{formatDate(prx.created_at)}</p>
                  {prx.chief_complaint && (
                    <p className="mt-1 text-xs text-ink-600 line-clamp-1">{prx.chief_complaint}</p>
                  )}
                  {prx.diagnosis && (
                    <p className="text-xs text-ink-500 line-clamp-1">{prx.diagnosis}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={pdfBusy === prx.id}
                    onClick={() => openPdf(prx.id)}
                  >
                    PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => { setSendChannel('email'); setSending(prx); }}
                  >
                    Email
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => { setSendChannel('whatsapp'); setSending(prx); }}
                  >
                    WhatsApp
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sending && (
        <SendDialog
          prescription={sending}
          channel={sendChannel}
          onClose={() => setSending(null)}
        />
      )}
    </div>
  );
}
