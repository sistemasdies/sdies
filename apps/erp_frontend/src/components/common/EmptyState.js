export default function EmptyState({ icon = 'bi-inbox', title = 'Sin datos',
                                      subtitle = '', action }) {
  return (
    <div className="text-center py-5 text-muted">
      <i className={`bi ${icon} display-4 d-block mb-3`}></i>
      <h6>{title}</h6>
      {subtitle && <p className="small">{subtitle}</p>}
      {action}
    </div>
  );
}
