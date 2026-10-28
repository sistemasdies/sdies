import { useState } from 'react';
import Sidebar from './Sidebar';
import BannerRolActivo from './BannerRolActivo';

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="d-flex">
      {sidebarOpen && <Sidebar onToggle={() => setSidebarOpen(false)} />}
      {!sidebarOpen && (
        <button
          type="button"
          className="btn btn-dark position-fixed"
          style={{ top: 12, left: 12, zIndex: 1050 }}
          onClick={() => setSidebarOpen(true)}
          title="Mostrar menú">
          <i className="bi bi-list"></i>
        </button>
      )}
      <div className="flex-grow-1" style={{ marginLeft: sidebarOpen ? 240 : 0, minHeight: '100vh',
                                             backgroundColor: '#f8f9fa', transition: 'margin-left .2s' }}>
        <BannerRolActivo />
        {children}
      </div>
    </div>
  );
}
