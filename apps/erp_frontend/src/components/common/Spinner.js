export default function Spinner({ text = 'Cargando...' }) {
  return (
    <div className="d-flex align-items-center justify-content-center py-5">
      <div className="spinner-border text-success me-2" role="status"></div>
      <span className="text-muted">{text}</span>
    </div>
  );
}
