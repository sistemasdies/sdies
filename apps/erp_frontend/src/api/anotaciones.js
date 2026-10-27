import API from './client';

export const getAnotacionesPastor   = (params) => API.get('/anotaciones-pastor/', { params });
export const createAnotacionPastor  = (data)   => API.post('/anotaciones-pastor/', data);
export const updateAnotacionPastor  = (id, d) => API.put(`/anotaciones-pastor/${id}/`, d);
export const deleteAnotacionPastor  = (id)     => API.delete(`/anotaciones-pastor/${id}/`);

export const getAnotacionesMisionero   = (params) => API.get('/anotaciones-misionero/', { params });
export const createAnotacionMisionero  = (data)   => API.post('/anotaciones-misionero/', data);
export const updateAnotacionMisionero  = (id, d) => API.put(`/anotaciones-misionero/${id}/`, d);
export const deleteAnotacionMisionero  = (id)     => API.delete(`/anotaciones-misionero/${id}/`);