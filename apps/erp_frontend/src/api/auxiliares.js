import API from './client';
export const getAuxiliares = (params) => API.get('/reports/auxiliares/', { params });