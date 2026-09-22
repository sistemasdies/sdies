import API from './client';
export const getTerceros    = (params)   => API.get('/terceros/', { params });
export const getTercero     = (id)       => API.get(`/terceros/${id}/`);
export const createTercero  = (data)     => API.post('/terceros/', data);
export const updateTercero  = (id, data) => API.put(`/terceros/${id}/`, data);
export const deleteTercero  = (id)       => API.delete(`/terceros/${id}/`);
export const exportarTerceros = (params) => API.get('/terceros/exportar/', { params, responseType: 'blob' });
export const importarTerceros = (data) => API.post('/terceros/importar/', data);
export const siguienteCedula  = () => API.get('/terceros/siguiente-cedula/');
