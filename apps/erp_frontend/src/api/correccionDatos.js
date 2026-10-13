import API from './client';

export const previewCorreccion = (data) => API.post('/correccion-datos/preview/', data);
export const aplicarCorreccion = (data) => API.post('/correccion-datos/aplicar/', data);
export const getBorradoDuro    = ()     => API.get('/correccion-datos/borrado-duro/');
export const ejecutarBorradoDuro = (confirmacion) =>
  API.post('/correccion-datos/borrado-duro/', { confirmacion });