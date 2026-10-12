import API from './client';

export const getDatosGenerales  = ()     => API.get('/datos-generales/');
export const saveDatosGenerales = (data) => API.patch('/datos-generales/', data);
