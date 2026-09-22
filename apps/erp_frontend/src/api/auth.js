import API from './client';
export const login  = (username, password) => API.post('/auth/login/', { username, password });
export const logout = (refresh)         => API.post('/auth/logout/', { refresh });
export const getMe  = ()                => API.get('/users/me/');
export const recuperarPaso1 = (login)                 => API.post('/auth/recuperar/paso1/', { login });
export const recuperarPaso2 = (login, fecha_nacimiento) => API.post('/auth/recuperar/paso2/', { login, fecha_nacimiento });
export const recuperarPaso3 = (login, frase)          => API.post('/auth/recuperar/paso3/', { login, frase });
export const recuperarPaso4 = (token, nueva_clave, confirmar) =>
  API.post('/auth/recuperar/paso4/', { token, nueva_clave, confirmar });
export const configurarVerificacion = (fecha_nacimiento, frase, frase2) =>
  API.post('/auth/configurar-verificacion/', { fecha_nacimiento, frase, frase2 });
