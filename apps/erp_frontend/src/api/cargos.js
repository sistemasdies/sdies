import API from './client';

export const getCargos   = (params) => API.get('/cargos/', { params });
export const getCargo     = (id)     => API.get(`/cargos/${id}/`);
export const createCargo = (data)   => API.post('/cargos/', data);
export const updateCargo = (id, d)  => API.put(`/cargos/${id}/`, d);
export const deleteCargo = (id)     => API.delete(`/cargos/${id}/`);
export const siguienteCodigoCargo = () => API.get('/cargos/siguiente-codigo/');
export const importarCargos = (data) => API.post('/cargos/importar/', data);
