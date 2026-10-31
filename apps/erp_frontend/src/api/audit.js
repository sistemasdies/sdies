import API from './client';

export const getAuditLogs = (params) => API.get('/audit/logs/', { params });