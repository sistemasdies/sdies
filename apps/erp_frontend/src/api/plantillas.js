import API from './client';
export const getPlantillas  = ()   => API.get('/plantillas/?page_size=1000');
export const getPlantilla   = (id) => API.get(`/plantillas/${id}/`);