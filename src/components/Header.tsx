import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  LogOut, 
  User as UserIcon, 
  DollarSign, 
  Receipt, 
  CreditCard, 
  Calculator, 
  LayoutDashboard, 
  QrCode, 
  ShieldCheck 
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onTabChange }) => {
  const { user, agency, logout } = useAuth();

  const isSupervisorOrAdmin = user?.rol === 'supervisor' || user?.rol === 'admin';
  const isCobrador = user?.rol === 'cobrador';
  const isCashier = !isCobrador && !isSupervisorOrAdmin;

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0D1B22]/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Agency Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-black font-extrabold shadow-md shadow-emerald-500/20">
              POS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white tracking-tight text-base">
                  Taquilla Web
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {user?.rol || 'cajero'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-medium text-slate-300">
                  {agency?.nombre_agencia || 'Agencia General'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1.5 bg-[#071217] p-1 rounded-xl border border-slate-800">
            {isCashier && (
              <>
                <button
                  onClick={() => onTabChange('ventas')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currentTab === 'ventas'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Ventas
                </button>
                <button
                  onClick={() => onTabChange('gastos')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currentTab === 'gastos'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Gastos
                </button>
                <button
                  onClick={() => onTabChange('pagos')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currentTab === 'pagos'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Pagos / Tickets
                </button>
                <button
                  onClick={() => onTabChange('banco')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currentTab === 'banco'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Depósitos
                </button>
                <button
                  onClick={() => onTabChange('cierre')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currentTab === 'cierre'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  Cierre de Caja
                </button>
              </>
            )}

            {isSupervisorOrAdmin && (
              <>
                <button
                  onClick={() => onTabChange('pizarra')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currentTab === 'pizarra'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Pizarra en Vivo
                </button>
                <button
                  onClick={() => onTabChange('banco')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currentTab === 'banco'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Confirmación Bancaria
                </button>
                <button
                  onClick={() => onTabChange('auditoria')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currentTab === 'auditoria'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Auditoría General
                </button>
              </>
            )}

            {isCobrador && (
              <>
                <button
                  onClick={() => onTabChange('escaner')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currentTab === 'escaner'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Escanear Tickets QR
                </button>
                <button
                  onClick={() => onTabChange('historial_cobros')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currentTab === 'historial_cobros'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Historial de Ruta
                </button>
              </>
            )}
          </nav>

          {/* User profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#071217] border border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-200 leading-tight">
                  {user?.nombre || user?.usuario}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {user?.usuario}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Cerrar Sesión"
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-800/80 overflow-x-auto gap-1">
          {isCashier && (
            <>
              <button
                onClick={() => onTabChange('ventas')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${currentTab === 'ventas' ? 'bg-emerald-500 text-black' : 'text-slate-400'}`}
              >
                Ventas
              </button>
              <button
                onClick={() => onTabChange('gastos')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${currentTab === 'gastos' ? 'bg-emerald-500 text-black' : 'text-slate-400'}`}
              >
                Gastos
              </button>
              <button
                onClick={() => onTabChange('pagos')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${currentTab === 'pagos' ? 'bg-emerald-500 text-black' : 'text-slate-400'}`}
              >
                Pagos
              </button>
              <button
                onClick={() => onTabChange('banco')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${currentTab === 'banco' ? 'bg-emerald-500 text-black' : 'text-slate-400'}`}
              >
                Depósitos
              </button>
              <button
                onClick={() => onTabChange('cierre')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${currentTab === 'cierre' ? 'bg-emerald-500 text-black' : 'text-slate-400'}`}
              >
                Cierre
              </button>
            </>
          )}

          {isSupervisorOrAdmin && (
            <>
              <button
                onClick={() => onTabChange('pizarra')}
                className={`text-[11px] font-bold px-3 py-1 rounded-md ${currentTab === 'pizarra' ? 'bg-emerald-500 text-black' : 'text-slate-400'}`}
              >
                Pizarra
              </button>
              <button
                onClick={() => onTabChange('banco')}
                className={`text-[11px] font-bold px-3 py-1 rounded-md ${currentTab === 'banco' ? 'bg-emerald-500 text-black' : 'text-slate-400'}`}
              >
                Banco
              </button>
              <button
                onClick={() => onTabChange('auditoria')}
                className={`text-[11px] font-bold px-3 py-1 rounded-md ${currentTab === 'auditoria' ? 'bg-emerald-500 text-black' : 'text-slate-400'}`}
              >
                Auditoría
              </button>
            </>
          )}

          {isCobrador && (
            <>
              <button
                onClick={() => onTabChange('escaner')}
                className={`text-[11px] font-bold px-3 py-1 rounded-md ${currentTab === 'escaner' ? 'bg-emerald-500 text-black' : 'text-slate-400'}`}
              >
                Escáner QR
              </button>
              <button
                onClick={() => onTabChange('historial_cobros')}
                className={`text-[11px] font-bold px-3 py-1 rounded-md ${currentTab === 'historial_cobros' ? 'bg-emerald-500 text-black' : 'text-slate-400'}`}
              >
                Historial
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
