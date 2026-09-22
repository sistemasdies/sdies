import API from './client';
export const getCuentasArbol   = ()           => API.get('/accounts/arbol/');
export const getCuentas        = (params)     => API.get('/accounts/', { params });
export const getCuenta         = (id)         => API.get(`/accounts/${id}/`);
export const createCuenta      = (data)       => API.post('/accounts/', data);
export const updateCuenta      = (id, data)   => API.put(`/accounts/${id}/`, data);
export const deleteCuenta      = (id)         => API.delete(`/accounts/${id}/`);
export const getSaldoCuenta    = (id, params) => API.get(`/accounts/${id}/saldo/`, { params });
