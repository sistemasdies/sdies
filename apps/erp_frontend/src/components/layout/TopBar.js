export default function TopBar({ title }) {
  return (
    <div className="d-flex align-items-center justify-content-between px-4 py-3
                    bg-white border-bottom shadow-sm">
      <h5 className="mb-0 fw-semibold text-dark">{title}</h5>
      <span className="text-muted small">
        {new Date().toLocaleDateString('es-CO', {
          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        })}
      </span>
    </div>
  );
}
