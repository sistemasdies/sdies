import API from './client';

export const exportarEntidad = (entidad) =>
  API.get(`/reports/exportar-datos/${entidad}/`, { responseType: 'blob' });

export const exportarTodo = () =>
  API.get('/reports/exportar-datos/', { responseType: 'blob' });
