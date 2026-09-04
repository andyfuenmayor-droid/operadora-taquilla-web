import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { Header } from './components/Header';
import { CashierTerminal } from './components/CashierTerminal/CashierTerminal';
import { SupervisorBoard } from './components/SupervisorBoard/SupervisorBoard';
import { CollectorPortal } from './components/CollectorPortal/CollectorPortal';
import { AuditPanel } from './components/AuditPanel/AuditPanel';

const MainLayout: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('ventas');

  // Set default tab once user is loaded
  useEffect(() => {
    if (user) {
      if (user.rol === 'cobrador') {
        setCurrentTab('escaner');
      } else if (user.rol === 'supervisor' || user.rol === 'admin') {
        setCurrentTab('pizarra');
      } else {
        setCurrentTab('ventas');
      }
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#071217] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-400">Cargando Taquilla Web...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#071217] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      <Header currentTab={currentTab} onTabChange={setCurrentTab} />

      <div className="flex-1">
        {/* Cashier views */}
        {['ventas', 'gastos', 'pagos', 'banco', 'cierre'].includes(currentTab) && (
          <CashierTerminal currentTab={currentTab} />
        )}

        {/* Supervisor views */}
        {currentTab === 'pizarra' && <SupervisorBoard />}
        {currentTab === 'auditoria' && <AuditPanel />}

        {/* Collector views */}
        {['escaner', 'historial_cobros'].includes(currentTab) && <CollectorPortal />}
      </div>

      <footer className="py-4 border-t border-slate-900 text-center text-xs text-slate-500">
        Taquilla Web POS &bull; taq.multibancaexpress.com &bull; &copy; {new Date().getFullYear()} Multibanca Express
      </footer>

      {/* Hidden print container for thermal receipt 58mm roll printing */}
      <div id="thermal-printable-area" className="hidden" />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

export default App;
