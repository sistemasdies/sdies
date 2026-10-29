import API from './client';

export const getCategorias   = (params) => API.get('/activos/categorias/', { params });
export const getCategoria   = (id)     => API.get(`/activos/categorias/${id}/`);
export const createCategoria = (data)  => API.post('/activos/categorias/', data);
export const updateCategoria = (id, d) => API.put(`/activos/categorias/${id}/`, d);
export const deleteCategoria = (id)    => API.delete(`/activos/categorias/${id}/`);

export const getUbicaciones   = (params) => API.get('/activos/ubicaciones/', { params });
export const getUbicacion     = (id)     => API.get(`/activos/ubicaciones/${id}/`);
export const createUbicacion = (data)   => API.post('/activos/ubicaciones/', data);
export const updateUbicacion = (id, d)  => API.put(`/activos/ubicaciones/${id}/`, d);
export const deleteUbicacion = (id)     => API.delete(`/activos/ubicaciones/${id}/`);

export const getEstadosActivo   = (params) => API.get('/activos/estados-activos/', { params });
export const getEstadoActivo     = (id)     => API.get(`/activos/estados-activos/${id}/`);
export const createEstadoActivo = (data)   => API.post('/activos/estados-activos/', data);
export const updateEstadoActivo = (id, d)  => API.put(`/activos/estados-activos/${id}/`, d);
export const deleteEstadoActivo = (id)     => API.delete(`/activos/estados-activos/${id}/`);

export const getActivos   = (params) => API.get('/activos/activos/', { params });
export const getActivo     = (id)     => API.get(`/activos/activos/${id}/`);
export const createActivo = (data)   => API.post('/activos/activos/', data);
export const updateActivo = (id, d)  => API.put(`/activos/activos/${id}/`, d);
export const deleteActivo = (id)     => API.delete(`/activos/activos/${id}/`);

export const getFotosActivo   = (params) => API.get('/activos/fotos-activos/', { params });
export const createFotoActivo = (data)   => API.post('/activos/fotos-activos/', data);
export const updateFotoActivo = (id, d)  => API.put(`/activos/fotos-activos/${id}/`, d);
export const deleteFotoActivo = (id)     => API.delete(`/activos/fotos-activos/${id}/`);

export const subirFotoActivo   = (id, file, descripcion = '') => {
  const fd = new FormData();
  fd.append('imagen', file);
  if (descripcion) fd.append('descripcion', descripcion);
  return API.post(`/activos/activos/${id}/foto/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const eliminarFotoActivoCloud = (id, fotoId) =>
  API.delete(`/activos/activos/${id}/foto/?foto_id=${fotoId}`);