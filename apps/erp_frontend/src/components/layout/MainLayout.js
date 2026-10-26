import Sidebar from './Sidebar';

export default function MainLayout({ children }) {
  return (
    <div className="d-flex">
      <Sidebar />
      <div className="flex-grow-1" style={{ marginLeft: 240, minHeight: '100vh',
                                             backgroundColor: '#f8f9fa' }}>
        {children}
      </div>
    </div>
  );
}
