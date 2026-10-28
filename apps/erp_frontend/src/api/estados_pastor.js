import API from './client';

export const getEstadosPastor   = (params) => API.get('/estados-pastor/', { params });
export const getEstadoPastor     = (id)     => API.get(`/estados-pastor/${id}/`);
export const createEstadoPastor = (data)   => API.post('/estados-pastor/', data);
export const updateEstadoPastor = (id, d)  => API.put(`/estados-pastor/${id}/`, d);
export const patchEstadoPastor  = (id, d)  => API.patch(`/estados-pastor/${id}/`, d);
export const deleteEstadoPastor = (id)     => API.delete(`/estados-pastor/${id}/`);