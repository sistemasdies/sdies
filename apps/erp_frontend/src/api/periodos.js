import API from './client';
export const getPeriodos   = ()          => API.get('/periodos/');
export const cerrarPeriodo = (id, data)  => API.post(`/periodos/${id}/cerrar/`, data);
