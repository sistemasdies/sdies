import API from './client';

export const getUsers = (params = {}) => API.get('/users/', { params });
