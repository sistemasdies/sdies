import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';

export default function MainLayout({ children }) {
  const { marca } = useAuth();
  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1" style={{ marginLeft: 240, minHeight: '100vh',
                                             backgroundColor: '#f8f9fa',
                                             backgroundImage: marca?.FondoDeLaApp
                                               ? `url(${marca.FondoDeLaApp})` : undefined,
                                             backgroundSize: 'cover',
                                             backgroundPosition: 'center',
                                             backgroundAttachment: 'fixed' }}>
        {children}
      </div>
    </div>
  );
}
