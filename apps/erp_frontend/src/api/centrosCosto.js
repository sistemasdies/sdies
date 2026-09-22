import API from './client';
export const getCentrosCosto   = ()       => API.get('/centros-costo/');
export const createCentroCosto = (data)   => API.post('/centros-costo/', data);
export const updateCentroCosto = (id, d)  => API.put(`/centros-costo/${id}/`, d);
export const deleteCentroCosto = (id)     => API.delete(`/centros-costo/${id}/`);
