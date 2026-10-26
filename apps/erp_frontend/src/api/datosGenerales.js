import API from './client';

export const getDatosGenerales  = ()     => API.get('/datos-generales/');
export const saveDatosGenerales = (data) => API.patch('/datos-generales/', data);
export const listarImagenesCloudinary = (tipo) =>
  API.get('/datos-generales/imagenes-cloudinary/', { params: { tipo } });
