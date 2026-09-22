import API from './client';

export const getPreferencias = () => API.get('/users/preferencias/');
export const savePreferencias = (data) => API.put('/users/preferencias/', { data });
