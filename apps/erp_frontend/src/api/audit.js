import API from './client';

export const getAuditLogs       = (params) => API.get('/audit/logs/', { params });
export const getAuditResources  = ()       => API.get('/audit/logs/resources/');
export const getAuditUsers      = ()       => API.get('/audit/logs/users/');