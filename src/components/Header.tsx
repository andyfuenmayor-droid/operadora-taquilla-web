import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  LogOut, 
  User as UserIcon, 
  Receipt, 
  CreditCard, 
  LayoutDashboard, 
  QrCode, 
  ShieldCheck, 
  Home, 
  BarChart3, 
  History 
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onTabChange }) => {
  const { user, agency, logout } = useAuth();

  const role = (user?.rol || 'cajero').toLowerCase();
  const isCajero = role === 'cajero';
  const isSupervisor = role === 'supervisor' || role === 'admin';
  const isAgencia = role === 'agencia';
  const isCobrador = role === 'cobrador';

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0D1B22]/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Agency Info */}
          <div className="flex items-center gap-3 shrink-0">
            <img 
              src="/logo.svg" 
              alt="Multibanca Express" 
              className="h-8 sm:h-9 w-auto filter drop-shadow-[0_0_8px_rgba(0,229,255,0.35)]" 
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  TAQUILLA POS
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                <span className="font-semibold text-slate-200 truncate max-w-[170px] sm:max-w-[260px]">
                  {agency?.nombre_agencia || 'Agencia General'}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Pills */}
          <nav className="hidden xl:flex items-center gap-1 bg-[#071217] p-1 rounded-xl border border-slate-800">
            {/* 1. ROL CAJERO */}
            {isCajero && (
              <>
                <button
                  onClick={() => onTabChange('inicio')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'inicio'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Inicio</span>
                </button>

                <button
                  onClick={() => onTabChange('reporte')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'reporte'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Reporte</span>
                </button>

                <button
                  onClick={() => onTabChange('historial')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'historial'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Historial</span>
                </button>

                <button
                  onClick={() => onTabChange('gastos')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'gastos'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Gastos</span>
                </button>

                <button
                  onClick={() => onTabChange('pagos')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'pagos'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Pagos</span>
                </button>

                <button
                  onClick={() => onTabChange('banco')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'banco'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Banco / POS</span>
                </button>
              </>
            )}

            {/* 2. ROL SUPERVISOR */}
            {isSupervisor && (
              <>
                <button
                  onClick={() => onTabChange('inicio')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'inicio'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Inicio</span>
                </button>

                <button
                  onClick={() => onTabChange('pizarra')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'pizarra'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Pizarra</span>
                </button>

                <button
                  onClick={() => onTabChange('historial')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'historial'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Historial</span>
                </button>

                <button
                  onClick={() => onTabChange('pagos')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'pagos'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Entrega Efectivo</span>
                </button>

                <button
                  onClick={() => onTabChange('reporte')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'reporte'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Reporte</span>
                </button>
              </>
            )}

            {/* 3. ROL AGENCIA */}
            {isAgencia && (
              <>
                <button
                  onClick={() => onTabChange('inicio')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'inicio'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Inicio</span>
                </button>

                <button
                  onClick={() => onTabChange('reporte')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'reporte'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Reporte</span>
                </button>

                <button
                  onClick={() => onTabChange('historial')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'historial'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Historial</span>
                </button>

                <button
                  onClick={() => onTabChange('pagos')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'pagos'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Pago Efectivo</span>
                </button>

                <button
                  onClick={() => onTabChange('banco')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'banco'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Gestión Bancaria</span>
                </button>
              </>
            )}

            {/* 4. ROL COBRADOR */}
            {isCobrador && (
              <button
                onClick={() => onTabChange('escaner')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currentTab === 'escaner'
                    ? 'bg-emerald-500 text-black shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Portal Cobrador</span>
              </button>
            )}
          </nav>

          {/* User profile & Logout */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#071217] border border-slate-800 shadow-sm">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                isSupervisor
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                  : isAgencia
                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                  : isCobrador
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}>
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-black text-white leading-tight">
                  {user?.nombre || user?.usuario}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[9px] uppercase font-black tracking-wider px-1.5 py-0.2 rounded border ${
                    isSupervisor
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : isAgencia
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                      : isCobrador
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {user?.rol || 'cajero'}
                  </span>
                  {user?.nombre && user?.usuario && user.nombre.toLowerCase().trim() !== user.usuario.toLowerCase().trim() && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      @{user.usuario}
                    </span>
                  )}
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

        {/* Medium/Mobile Navigation Bar with horizontal scrolling */}
        <div className="xl:hidden flex items-center py-2.5 border-t border-slate-800/80 overflow-x-auto gap-1 scrollbar-none">
          {/* Mobile Cajero */}
          {isCajero && (
            <>
              <button
                onClick={() => onTabChange('inicio')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'inicio' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Inicio
              </button>
              <button
                onClick={() => onTabChange('reporte')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'reporte' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Reporte
              </button>
              <button
                onClick={() => onTabChange('historial')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'historial' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Historial
              </button>
              <button
                onClick={() => onTabChange('gastos')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'gastos' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Gastos
              </button>
              <button
                onClick={() => onTabChange('pagos')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'pagos' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Pagos
              </button>
              <button
                onClick={() => onTabChange('banco')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'banco' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Banco
              </button>
            </>
          )}

          {/* Mobile Supervisor */}
          {isSupervisor && (
            <>
              <button
                onClick={() => onTabChange('inicio')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'inicio' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Inicio
              </button>
              <button
                onClick={() => onTabChange('pizarra')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'pizarra' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Pizarra
              </button>
              <button
                onClick={() => onTabChange('historial')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'historial' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Historial
              </button>
              <button
                onClick={() => onTabChange('pagos')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'pagos' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Entrega Efectivo
              </button>
              <button
                onClick={() => onTabChange('reporte')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'reporte' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Reporte
              </button>
            </>
          )}

          {/* Mobile Agencia */}
          {isAgencia && (
            <>
              <button
                onClick={() => onTabChange('inicio')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'inicio' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Inicio
              </button>
              <button
                onClick={() => onTabChange('reporte')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'reporte' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Reporte
              </button>
              <button
                onClick={() => onTabChange('historial')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'historial' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Historial
              </button>
              <button
                onClick={() => onTabChange('pagos')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'pagos' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Pago Efectivo
              </button>
              <button
                onClick={() => onTabChange('banco')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'banco' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Gestión Bancaria
              </button>
            </>
          )}

          {/* Mobile Cobrador */}
          {isCobrador && (
            <button
              onClick={() => onTabChange('escaner')}
              className={`text-xs font-bold px-4 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                currentTab === 'escaner' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Portal Cobranza
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
