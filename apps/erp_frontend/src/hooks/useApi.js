import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export function useApi(apiFn) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFn(...args);
      setData(res.data);
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.detail
               || err.response?.data?.error
               || 'Error al conectar con el servidor';
      setError(msg);
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFn]);

  return { data, loading, error, execute };
}
