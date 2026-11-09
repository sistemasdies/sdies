import API from './client';

// Asistencia
export const getAsistencias   = (params)  => API.get('/actividades/asistencias/', { params });
export const getAsistencia    = (id)      => API.get(`/actividades/asistencias/${id}/`);
export const createAsistencia = (data)    => API.post('/actividades/asistencias/', data);
export const updateAsistencia = (id, data) => API.put(`/actividades/asistencias/${id}/`, data);
export const deleteAsistencia = (id)      => API.delete(`/actividades/asistencias/${id}/`);

// Acontecimientos
export const getAcontecimientos   = (params)  => API.get('/actividades/acontecimientos/', { params });
export const getAcontecimiento    = (id)      => API.get(`/actividades/acontecimientos/${id}/`);
export const createAcontecimiento = (data)    => API.post('/actividades/acontecimientos/', data);
export const updateAcontecimiento = (id, data) => API.put(`/actividades/acontecimientos/${id}/`, data);
export const deleteAcontecimiento = (id)      => API.delete(`/actividades/acontecimientos/${id}/`);
export const subirFotosAcontecimiento = (id, files) => {
  const data = new FormData();
  files.forEach(f => data.append('imagen', f));
  return API.post(`/actividades/acontecimientos/${id}/fotos/`, data);
};
export const eliminarFotoAcontecimiento = (id, fotoId) =>
  API.delete(`/actividades/acontecimientos/${id}/fotos/${fotoId}/`);
