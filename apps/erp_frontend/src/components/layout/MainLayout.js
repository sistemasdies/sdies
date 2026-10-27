import Sidebar from './Sidebar';
import BannerRolActivo from './BannerRolActivo';

export default function MainLayout({ children }) {
  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1" style={{ marginLeft: 240, minHeight: '100vh',
                                             backgroundColor: '#f8f9fa' }}>
        <BannerRolActivo />
        {children}
      </div>
    </div>
  );
}
