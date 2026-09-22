import API from './client';
export const getAsientos    = (params) => API.get('/movicont/', { params });
export const getMovimiento  = (params) => API.get('/movicont/detalle/', { params });
export const editarLineaMovimiento = (data) => API.post('/movicont/editar-linea/', data);
export const editarLineasMovimientos = (data) => API.post('/movicont/editar-lineas/', data);
export const createAsiento  = (data)     => API.post('/movicont/', data);
export const eliminarMovimiento = (cod_comprob, num_comprob) =>
  API.post('/movicont/eliminar/', { cod_comprob, num_comprob });
export const anularMovimiento = (cod_comprob, num_comprob) =>
  API.post('/movicont/anular/', { cod_comprob, num_comprob });
export const importarMovimientos = (data) => API.post('/movicont/importar/', data);
