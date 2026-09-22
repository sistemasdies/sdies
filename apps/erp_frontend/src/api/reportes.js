import API from './client';
export const getBalanceGeneral      = (params) => API.get('/reports/balance-general/', { params });
export const getEstadoResultados    = (params) => API.get('/reports/estado-resultados/', { params });
export const getBalanceComprobacion = (params) => API.get('/reports/balance-comprobacion/', { params });
export const exportarReporte        = (data)   => API.post('/reports/exportar/', data);
