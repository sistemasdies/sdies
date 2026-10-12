import API from './client';

export const previewCorreccion = (data) => API.post('/correccion-datos/preview/', data);
export const aplicarCorreccion = (data) => API.post('/correccion-datos/aplicar/', data);
