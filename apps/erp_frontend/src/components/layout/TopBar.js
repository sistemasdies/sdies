export default function TopBar({ title, children }) {
  return (
    <div className="d-flex align-items-center justify-content-between px-4 py-3
                    bg-white border-bottom shadow-sm">
      <div className="d-flex align-items-center gap-3">
        <h5 className="mb-0 fw-semibold text-dark">{title}</h5>
        {children}
      </div>
      <span className="text-muted small">
        {new Date().toLocaleDateString('es-CO', {
          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        })}
      </span>
    </div>
  );
}
