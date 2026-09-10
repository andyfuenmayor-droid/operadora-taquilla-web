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
  ShieldCheck,
  Home,
  BarChart3,
  Award
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onTabChange }) => {
  const { user, agency, logout, systemCycle } = useAuth();

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
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  TAQUILLA POS
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
                  isSupervisor
                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                    : isAgencia
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                    : isCobrador
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  {user?.rol || 'cajero'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-medium text-slate-300 truncate max-w-[150px] sm:max-w-[220px]">
                  {agency?.nombre_agencia || 'Agencia General'}
                </span>
                {systemCycle?.desde && systemCycle?.hasta && (
                  <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-slate-400 font-mono pl-2 border-l border-slate-700">
                    📅 Ciclo: {systemCycle.desde} al {systemCycle.hasta}
                  </span>
                )}
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
                  onClick={() => onTabChange('ventas')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'ventas'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Ventas</span>
                </button>

                <button
                  onClick={() => onTabChange('premios')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'premios'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Premios</span>
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

                <button
                  onClick={() => onTabChange('cierre')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'cierre'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Cierre</span>
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
                  onClick={() => onTabChange('auditoria')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'auditoria'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Auditoría</span>
                </button>

                <button
                  onClick={() => onTabChange('cierre')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === 'cierre'
                      ? 'bg-emerald-500 text-black shadow-sm font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Cierre Maestro</span>
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
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#071217] border border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="text-left hidden sm:block">
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
                onClick={() => onTabChange('ventas')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'ventas' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Ventas
              </button>
              <button
                onClick={() => onTabChange('premios')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'premios' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Premios
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
              <button
                onClick={() => onTabChange('cierre')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'cierre' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cierre
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
                onClick={() => onTabChange('reporte')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'reporte' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Reporte
              </button>
              <button
                onClick={() => onTabChange('auditoria')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'auditoria' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Auditoría
              </button>
              <button
                onClick={() => onTabChange('cierre')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  currentTab === 'cierre' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cierre Maestro
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
