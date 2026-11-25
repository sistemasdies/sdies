import API from './client';

export const getPresupuestos = (params) => API.get('/presupuestos/', { params });
export const getPresupuesto = (id) => API.get(`/presupuestos/${id}/`);
export const createPresupuesto = (data) => API.post('/presupuestos/', data);
export const updatePresupuesto = (id, data) => API.put(`/presupuestos/${id}/`, data);
export const deletePresupuesto = (id) => API.delete(`/presupuestos/${id}/`);
export const generarPresupuesto = (data) => API.post('/presupuestos/generar/', data);
export const reiniciarPresupuesto = (data) => API.post('/presupuestos/reiniciar/', data);
export const controlPresupuestal = (params) => API.get('/presupuestos/control/', { params });
