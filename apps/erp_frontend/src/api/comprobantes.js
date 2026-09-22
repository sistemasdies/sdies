import API from './client';
export const getComprobantes   = ()        => API.get('/comprobantes/?page_size=1000');
export const createComprobante = (data)    => API.post('/comprobantes/', data);
export const updateComprobante = (id, d)   => API.put(`/comprobantes/${id}/`, d);
export const getSiguienteNumero = (codigo) => API.get('/comprobantes/siguiente-numero/', { params: { codigo } });