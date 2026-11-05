import API from './client';

const BASE = '/actas';

export const getActas = (params = {}) => API.get(`${BASE}/actas/`, { params });
export const getActa = (id) => API.get(`${BASE}/actas/${id}/`);
export const createActa = (data) => API.post(`${BASE}/actas/`, data);
export const updateActa = (id, data) => API.put(`${BASE}/actas/${id}/`, data);
export const deleteActa = (id) => API.delete(`${BASE}/actas/${id}/`);

export const getSiguienteCodigo = (congregacion) =>
  API.get(`${BASE}/actas/siguiente-codigo/`, { params: { congregacion } });

export const firmarActa = (id, password, confirmacionDoc = '') =>
  API.post(`${BASE}/actas/${id}/firmar/`, { password, confirmacion_doc: confirmacionDoc });

export const enviarFirmas = (id, { miembros = [], usuarios = [] }) =>
  API.post(`${BASE}/actas/${id}/enviar-firmas/`, { miembros, usuarios });

export const cambiarEstadoActa = (id, estado) =>
  API.post(`${BASE}/actas/${id}/cambiar-estado/`, { estado });

export const getActaPorToken = (token) =>
  API.get(`${BASE}/firmar/${token}/`);

export const firmarConToken = (token, confirmacionDoc = '') =>
  API.post(`${BASE}/firmar/${token}/`, { confirmacion_doc: confirmacionDoc });
