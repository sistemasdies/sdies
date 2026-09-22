import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginPage         from './pages/Login/LoginPage';
import RecuperarContrasena from './pages/RecuperarContrasena/RecuperarContrasena';
import ConfigurarVerificacion from './pages/ConfigurarVerificacion/ConfigurarVerificacion';
import DashboardPage     from './pages/Dashboard/DashboardPage';
import CuentasPage       from './pages/Cuentas/CuentasPage';
import AsientosPage      from './pages/Asientos/AsientosPage';
import NuevoAsientoPage  from './pages/Asientos/NuevoAsientoPage';
import TercerosPage      from './pages/Terceros/TercerosPage';
import CentroCostosPage  from './pages/CentroCostos/CentroCostosPage';
import ReportesPage      from './pages/Reportes/ReportesPage';
import PeriodosPage      from './pages/Periodos/PeriodosPage';
import UsuariosPage      from './pages/Usuarios/UsuariosPage';
import RolesPage         from './pages/Roles/RolesPage';
import ImportarPage        from './pages/Importar/ImportarPage';
import ComprobantesPage  from './pages/Comprobantes/ComprobantesPage';
import PlantillasPage     from './pages/Plantillas/PlantillasPage';
import AsientoConPlantilla from './pages/Asientos/AsientoConPlantilla';
import ModuloEnProceso   from './pages/ModuloEnProceso/ModuloEnProceso';
import AuxiliaresPage    from './pages/Informes/AuxiliaresPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center">
      <div className="spinner-border text-success" role="status"></div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (user.verificacion_pendiente && location.pathname !== '/configurar-verificacion')
    return <Navigate to="/configurar-verificacion" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login"          element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
      <Route path="/configurar-verificacion"
        element={<PrivateRoute><ConfigurarVerificacion /></PrivateRoute>} />
      <Route path="/dashboard"      element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/cuentas"        element={<PrivateRoute><CuentasPage /></PrivateRoute>} />
      <Route path="/asientos"       element={<PrivateRoute><AsientosPage /></PrivateRoute>} />
      <Route path="/asientos/nuevo" element={<PrivateRoute><NuevoAsientoPage /></PrivateRoute>} />
      <Route path="/terceros"       element={<PrivateRoute><TercerosPage /></PrivateRoute>} />
      <Route path="/centros-costo"  element={<PrivateRoute><CentroCostosPage /></PrivateRoute>} />
      <Route path="/reportes"       element={<PrivateRoute><ReportesPage /></PrivateRoute>} />
      <Route path="/periodos"       element={<PrivateRoute><PeriodosPage /></PrivateRoute>} />
      <Route path="/usuarios"       element={<PrivateRoute><UsuariosPage /></PrivateRoute>} />
      <Route path="/roles"          element={<PrivateRoute><RolesPage /></PrivateRoute>} />
      <Route path="/comprobantes"      element={<PrivateRoute><ComprobantesPage /></PrivateRoute>} />
      <Route path="/plantillas"        element={<PrivateRoute><PlantillasPage /></PrivateRoute>} />
      <Route path="/asientos/plantilla" element={<PrivateRoute><AsientoConPlantilla /></PrivateRoute>} />
      <Route path="/importar"       element={<PrivateRoute><ImportarPage /></PrivateRoute>} />
      <Route path="/procesos/bloquear-fecha"      element={<PrivateRoute><ModuloEnProceso /></PrivateRoute>} />
      <Route path="/procesos/cierre-periodo"      element={<PrivateRoute><ModuloEnProceso /></PrivateRoute>} />
      <Route path="/procesos/generar-balance"     element={<PrivateRoute><ModuloEnProceso /></PrivateRoute>} />
      <Route path="/procesos/generar-presupuesto" element={<PrivateRoute><ModuloEnProceso /></PrivateRoute>} />
      <Route path="/procesos/correccion-datos"    element={<PrivateRoute><ModuloEnProceso /></PrivateRoute>} />
      <Route path="/procesos/copia-seguridad"     element={<PrivateRoute><ModuloEnProceso /></PrivateRoute>} />
      <Route path="/informes/auxiliares"          element={<PrivateRoute><AuxiliaresPage /></PrivateRoute>} />
      <Route path="/informes/saldos"              element={<PrivateRoute><ModuloEnProceso /></PrivateRoute>} />
      <Route path="/informes/balances"            element={<PrivateRoute><ModuloEnProceso /></PrivateRoute>} />
      <Route path="/informes/estado-presupuestal" element={<PrivateRoute><ModuloEnProceso /></PrivateRoute>} />
      <Route path="/"               element={<Navigate to="/dashboard" replace />} />
      <Route path="*"               element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        const form = document.querySelector('form:not([style*="display: none"])');
        if (form) { form.requestSubmit(); return; }
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.includes('Guardar') && !b.disabled);
        if (btn) btn.click();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{
          success: { style: { background: '#198754', color: '#fff' } },
          error:   { style: { background: '#dc3545', color: '#fff' } },
          duration: 4000,
        }} />
      </BrowserRouter>
    </AuthProvider>
  );
}