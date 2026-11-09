import API from './client';

export const getAsistencias   = (params)  => API.get('/actividades/asistencias/', { params });
export const getAsistencia    = (id)      => API.get(`/actividades/asistencias/${id}/`);
export const createAsistencia = (data)    => API.post('/actividades/asistencias/', data);
export const updateAsistencia = (id, data) => API.put(`/actividades/asistencias/${id}/`, data);
export const deleteAsistencia = (id)      => API.delete(`/actividades/asistencias/${id}/`);
