export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="d-flex align-items-center justify-content-between mb-4">
      <div>
        <h4 className="mb-0 fw-bold">{title}</h4>
        {subtitle && <p className="text-muted small mb-0 mt-1">{subtitle}</p>}
      </div>
      <div className="d-flex gap-2">{children}</div>
    </div>
  );
}
