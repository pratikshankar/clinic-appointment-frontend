import { api, saveBlob } from './api.js';

export const prescriptionService = {
  list: (patientId) =>
    api.get('/prescriptions', { patient_id: patientId }),

  create: (payload) =>
    api.post('/prescriptions', payload),

  downloadPdf: async (id) => {
    const result = await api.blob(`/prescriptions/${id}/prescription.pdf`);
    saveBlob(result);
  },

  openPdf: async (id) => {
    const { blob } = await api.blob(`/prescriptions/${id}/prescription.pdf`);
    const href = URL.createObjectURL(blob);
    const w = window.open(href, '_blank');
    if (!w) {
      const a = document.createElement('a');
      a.href = href;
      a.download = `prescription-${id}.pdf`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(href), 60000);
  },

  send: (id, email) =>
    api.post(`/prescriptions/${id}/send`, { channel: 'email', email: email || null }),

  sendWhatsapp: (id, phone) =>
    api.post(`/prescriptions/${id}/send`, { channel: 'whatsapp', phone: phone || null }),
};
