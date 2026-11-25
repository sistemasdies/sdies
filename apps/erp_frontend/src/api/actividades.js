import API from './client';

// Asistencia
function buildParams(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) sp.append(key, value.join(','));
    } else if (value !== '' && value !== null && value !== undefined) {
      sp.append(key, value);
    }
  });
  return sp.toString();
}

export const getAsistencias = (params) => {
  const query = buildParams(params);
  return API.get(`/actividades/asistencias/${query ? `?${query}` : ''}`);
};
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

// Visitación
export const getVisitaciones   = (params)  => API.get('/actividades/visitaciones/', { params });
export const getVisitacion     = (id)      => API.get(`/actividades/visitaciones/${id}/`);
export const createVisitacion  = (data)    => API.post('/actividades/visitaciones/', data);
export const updateVisitacion  = (id, data) => API.put(`/actividades/visitaciones/${id}/`, data);
export const deleteVisitacion  = (id)      => API.delete(`/actividades/visitaciones/${id}/`);
