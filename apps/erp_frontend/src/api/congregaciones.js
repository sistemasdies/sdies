import API from './client';

export const getCongregaciones   = (params) => API.get('/congregaciones/', { params });
export const getCongregacion     = (id)     => API.get(`/congregaciones/${id}/`);
export const createCongregacion = (data)   => API.post('/congregaciones/', data);
export const updateCongregacion = (id, d)  => API.put(`/congregaciones/${id}/`, d);
export const patchCongregacion  = (id, d)  => API.patch(`/congregaciones/${id}/`, d);
export const deleteCongregacion = (id)     => API.delete(`/congregaciones/${id}/`);
