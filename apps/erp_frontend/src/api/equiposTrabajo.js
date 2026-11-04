import API from './client';

export const getEquiposTrabajo   = (params) => API.get('/equipos-trabajo/', { params });
export const getEquipoTrabajo     = (id)     => API.get(`/equipos-trabajo/${id}/`);
export const createEquipoTrabajo = (data)   => API.post('/equipos-trabajo/', data);
export const updateEquipoTrabajo = (id, d)  => API.put(`/equipos-trabajo/${id}/`, d);
export const deleteEquipoTrabajo = (id)     => API.delete(`/equipos-trabajo/${id}/`);
