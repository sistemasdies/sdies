import API from './client';
export const getMembresias   = (params)  => API.get('/membresias/', { params });
export const getMembresia    = (id)      => API.get(`/membresias/${id}/`);
export const createMembresia = (data)    => API.post('/membresias/', data);
export const updateMembresia = (id, data) => API.put(`/membresias/${id}/`, data);
export const deleteMembresia = (id)      => API.delete(`/membresias/${id}/`);
export const buscarTerceroPorCedula = (cedula) =>
  API.get('/membresias/tercero-por-cedula/', { params: { cedula } });
export const getCedulasConMembresia = () =>
  API.get('/membresias/cedulas-con-membresia/');
export const importarMembresias = (data) =>
  API.post('/membresias/importar/', data);

export const subirFotoMembresia = (id, file) => {
  const data = new FormData();
  data.append('imagen', file);
  return API.post(`/membresias/${id}/foto/`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const eliminarFotoMembresia = (id) => API.delete(`/membresias/${id}/foto/`);
