import API from './client';

export const getEstados   = (params) => API.get('/estados/', { params });
export const getEstado     = (id)     => API.get(`/estados/${id}/`);
export const createEstado = (data)   => API.post('/estados/', data);
export const updateEstado = (id, d)  => API.put(`/estados/${id}/`, d);
export const patchEstado  = (id, d)  => API.patch(`/estados/${id}/`, d);
export const deleteEstado = (id)     => API.delete(`/estados/${id}/`);