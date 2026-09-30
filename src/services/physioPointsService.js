import { api } from './api.js';

export const physioPointsService = {
  get: (patientId) =>
    api.get(`/patients/${patientId}/physio-points`),

  adjust: (patientId, points, reason) =>
    api.post(`/patients/${patientId}/physio-points/adjust?points=${points}&reason=${encodeURIComponent(reason)}`),
};
