export const formatMoney = (value) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP',
    minimumFractionDigits: 2 }).format(value || 0);

export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date + 'T00:00:00').toLocaleDateString('es-CO',
    { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatDatetime = (dt) => {
  if (!dt) return '';
  return new Date(dt).toLocaleString('es-CO');
};

export const estadoBadge = (estado) => {
  const map = {
    B: 'warning', C: 'success', A: 'danger', R: 'secondary',
    A: 'success', X: 'danger',
  };
  const labels = {
    B: 'Borrador', C: 'Contabilizado', A: 'Anulado', R: 'Revertido',
  };
  return { color: map[estado] || 'secondary', label: labels[estado] || estado };
};
