import API from './client';

export const getPastores   = (params) => API.get('/pastores/', { params });
export const getPastor     = (id)     => API.get(`/pastores/${id}/`);
export const createPastor = (data)   => API.post('/pastores/', data);
export const updatePastor = (id, d)  => API.put(`/pastores/${id}/`, d);
export const patchPastor  = (id, d)  => API.patch(`/pastores/${id}/`, d);
export const deletePastor = (id)     => API.delete(`/pastores/${id}/`);