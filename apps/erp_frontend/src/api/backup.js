import API from './client';

export const exportarBackup = (params) => API.get('/reports/backup-export/', { params, responseType: 'blob' });
export const importarBackup = (formData) => API.post('/reports/backup-import/', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

