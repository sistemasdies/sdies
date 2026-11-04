import API from './client';

export const getAreasTrabajo   = (params) => API.get('/areas-trabajo/', { params });
export const getAreaTrabajo     = (id)     => API.get(`/areas-trabajo/${id}/`);
export const createAreaTrabajo = (data)   => API.post('/areas-trabajo/', data);
export const updateAreaTrabajo = (id, d)  => API.put(`/areas-trabajo/${id}/`, d);
export const deleteAreaTrabajo = (id)     => API.delete(`/areas-trabajo/${id}/`);
