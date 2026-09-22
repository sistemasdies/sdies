export default function ConfirmModal({ show, title, message, onConfirm, onCancel,
                                        variant = 'danger' }) {
  if (!show) return null;
  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button className="btn-close" onClick={onCancel}></button>
          </div>
          <div className="modal-body">{message}</div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
            <button className={`btn btn-${variant}`} onClick={onConfirm}>Confirmar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
