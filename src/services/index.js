/**
 * Typed-ish wrappers around the REST endpoints.
 *
 * Pages import these instead of building URLs, so an endpoint change touches
 * one line rather than every component that used it.
 */

import { api, tokenStore, saveBlob, openBlob } from './api';

export const authService = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }, { auth: false }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (current_password, new_password) =>
    api.post('/auth/change-password', { current_password, new_password }),
};

export const clinicService = {
  list: (params) => api.get('/clinics', params),
  get: (clinicId) => api.get(`/clinics/${clinicId}`),

  // --- Phase 2 writes (Superadmin only; the API enforces it) ---
  create: (payload) => api.post('/clinics', payload),
  update: (clinicId, payload) => api.put(`/clinics/${clinicId}`, payload),
  activate: (clinicId) => api.post(`/clinics/${clinicId}/activate`),
  deactivate: (clinicId) => api.post(`/clinics/${clinicId}/deactivate`),

  workingHours: (clinicId) => api.get(`/clinics/${clinicId}/working-hours`),
  replaceWorkingHours: (clinicId, working_hours) =>
    api.put(`/clinics/${clinicId}/working-hours`, { working_hours }),

  breaks: (clinicId) => api.get(`/clinics/${clinicId}/breaks`),
  addBreak: (clinicId, payload) => api.post(`/clinics/${clinicId}/breaks`, payload),
  removeBreak: (clinicId, breakId) => api.delete(`/clinics/${clinicId}/breaks/${breakId}`),

  staff: (clinicId) => api.get(`/clinics/${clinicId}/users`),
  assignStaff: (clinicId, payload) => api.post(`/clinics/${clinicId}/users`, payload),
  unassignStaff: (clinicId, userId) => api.delete(`/clinics/${clinicId}/users/${userId}`),

  schedulePreview: (clinicId, date) =>
    api.get(`/clinics/${clinicId}/schedule-preview`, date ? { date } : undefined),
};

export const holidayService = {
  list: (params) => api.get('/holidays', params),
  add: (payload) => api.post('/holidays', payload),
  remove: (holidayId) => api.delete(`/holidays/${holidayId}`),
};

export const patientService = {
  list: (params) => api.get('/patients', params),
  get: (patientId) => api.get(`/patients/${patientId}`),
  profile: (patientId) => api.get(`/patients/${patientId}/profile`),
  create: (payload) => api.post('/patients', payload),
  quickCreate: (payload) => api.post('/patients/quick', payload),
  update: (patientId, payload) => api.put(`/patients/${patientId}`, payload),
  archive: (patientId) => api.post(`/patients/${patientId}/archive`),
  restore: (patientId) => api.post(`/patients/${patientId}/restore`),

  /** Exact match across every clinic — used to link, not to browse. */
  lookup: (params) => api.get('/patients/lookup', params),
  /** Candidates to review before creating, so staff link instead of duplicating. */
  duplicateCheck: (payload) => api.post('/patients/duplicate-check', payload),
};

export const appointmentService = {
  availableSlots: (clinicId, date) =>
    api.get('/appointments/available-slots', { clinic_id: clinicId, date }),
  list: (params) => api.get('/appointments', params),
  counters: (clinicId) => api.get('/appointments/counters', { clinic_id: clinicId }),
  get: (id) => api.get(`/appointments/${id}`),
  history: (id) => api.get(`/appointments/${id}/history`),

  /** Book a patient who already has a Patient ID. */
  book: (payload) => api.post('/appointments', payload),
  /** Register a first-time caller and book them in one request. */
  bookNewPatient: (payload) => api.post('/appointments/book-new-patient', payload),

  confirm: (id) => api.post(`/appointments/${id}/confirm`, {}),
  checkIn: (id) => api.post(`/appointments/${id}/check-in`, {}),
  complete: (id) => api.post(`/appointments/${id}/complete`, {}),
  noShow: (id) => api.post(`/appointments/${id}/no-show`, {}),
  cancel: (id, reason) => api.post(`/appointments/${id}/cancel`, { reason }),
  reschedule: (id, payload) => api.post(`/appointments/${id}/reschedule`, payload),
};

export const sessionService = {
  /** Everything the session form needs, pre-resolved in one call. */
  context: (patientId) => api.get(`/patients/${patientId}/session-context`),

  list: (params) => api.get('/sessions', params),
  counters: (clinicId) => api.get('/sessions/counters', { clinic_id: clinicId }),
  forPatient: (patientId, params) => api.get(`/patients/${patientId}/sessions`, params),
  /** Logs a session and, with appointment_id, completes that appointment too. */
  log: (patientId, payload) => api.post(`/patients/${patientId}/sessions`, payload),
  update: (sessionId, payload) => api.put(`/sessions/${sessionId}`, payload),
  void: (sessionId, reason) => api.post(`/sessions/${sessionId}/void`, { reason }),

  packages: (patientId, params) => api.get(`/patients/${patientId}/packages`, params),
  createPackage: (patientId, payload) => api.post(`/patients/${patientId}/packages`, payload),
  updatePackage: (packageId, payload) => api.put(`/packages/${packageId}`, payload),
  cancelPackage: (packageId, reason) => api.post(`/packages/${packageId}/cancel`, { reason }),
};

export const notificationService = {
  list: (params) => api.get('/notifications', params),
  /** Small payload, polled every ~15s for the unread badge. */
  counters: () => api.get('/notifications/counters'),
  acknowledge: (id) => api.post(`/notifications/${id}/acknowledge`, {}),
  acknowledgeAll: () => api.post('/notifications/acknowledge-all', {}),
};

export const billingService = {
  /** Chargeable services. Passing a clinic also returns the chain-wide ones. */
  serviceItems: (params) => api.get('/service-items', params),
  createServiceItem: (payload) => api.post('/service-items', payload),
  updateServiceItem: (id, payload) => api.put(`/service-items/${id}`, payload),

  list: (params) => api.get('/bills', params),
  counters: (clinicId) => api.get('/bills/counters', { clinic_id: clinicId }),
  get: (billId) => api.get(`/bills/${billId}`),
  forPatient: (patientId) => api.get(`/patients/${patientId}/bills`),
  /** A charge outside a package: consultation, add-on therapy, product. */
  charge: (patientId, payload) => api.post(`/patients/${patientId}/bills`, payload),
  addPayment: (billId, payload) => api.post(`/bills/${billId}/payments`, payload),

  // --- Documents (Phase 7b) ---
  /** Invoice for a whole bill: every charge, and what is still owed. */
  invoicePdf: (billId) => api.blob(`/bills/${billId}/invoice.pdf`),
  /** Receipt for one payment: the amount the patient handed over. */
  receiptPdf: (paymentId) => api.blob(`/payments/${paymentId}/receipt.pdf`),
  /** Session-by-session treatment record, for an insurance claim. */
  statementPdf: (packageId) => api.blob(`/packages/${packageId}/statement.pdf`),

  sendInvoice: (billId, payload) => api.post(`/bills/${billId}/send`, payload),
  sendReceipt: (paymentId, payload) => api.post(`/payments/${paymentId}/send`, payload),
  sendStatement: (packageId, payload) =>
    api.post(`/packages/${packageId}/send-statement`, payload),
};

export const reportService = {
  /** name: clinics | appointments | patient-sources | revenue | sessions */
  run: (name, params) => api.get(`/reports/${name}`, params),
  /** Same report as a spreadsheet. Returns { blob, filename }. */
  csv: (name, params) => {
    const query = new URLSearchParams({ ...params, format: 'csv' }).toString();
    return api.blob(`/reports/${name}?${query}`);
  },

  /** This month to a day, against the same span in previous months. */
  monthComparison: (params) => api.get('/reports/month-comparison', params),
  monthComparisonCsv: (params) => {
    const query = new URLSearchParams({ ...params, format: 'csv' }).toString();
    return api.blob(`/reports/month-comparison?${query}`);
  },
};

export const auditService = {
  list: (params) => api.get('/audit-logs', params),
  actions: () => api.get('/audit-logs/actions'),
};

export const patientSourceService = {
  list: (params) => api.get('/patient-sources', params),
  create: (payload) => api.post('/patient-sources', payload),
  update: (sourceId, payload) => api.put(`/patient-sources/${sourceId}`, payload),
};

export const userService = {
  list: (params) => api.get('/users', params),
  get: (userId) => api.get(`/users/${userId}`),
  create: (payload) => api.post('/users', payload),
  update: (userId, payload) => api.put(`/users/${userId}`, payload),
  enable: (userId) => api.post(`/users/${userId}/enable`),
  disable: (userId) => api.post(`/users/${userId}/disable`),
  /**
   * Remove an account outright. The API refuses once the person has treated a
   * patient or handled money — deleting them would blank the actor out of those
   * records, so Disable is the right action there.
   */
  remove: (userId) => api.delete(`/users/${userId}`),
  resetPassword: (userId, new_password) =>
    api.post(`/users/${userId}/reset-password`, { new_password }),
  roles: () => api.get('/roles'),
};

export const dashboardService = {
  summary: (params) => api.get('/dashboard/summary', params),
};

export const metaService = {
  health: () => api.get('/health'),
  meta: () => api.get('/meta'),
};

export { api, tokenStore, saveBlob, openBlob };
