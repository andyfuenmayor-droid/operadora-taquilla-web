import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { 
  fetchFullCycleMetrics, 
  type CurrencyOperationalMetrics 
} from '../../utils/operationalDashboard';
import { formatMoney, getTodayDateString } from '../../utils/formatters';
import { 
  RefreshCw, 
  DollarSign, 
  Award, 
  Receipt, 
  Building2, 
  TrendingUp, 
  Users, 
  Share2, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CreditCard, 
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CashierOption {
  id: string;
  nombre: string;
}

export const DateRangeReportTab: React.FC = () => {
  const { user, agency, systemCycle, assignedCurrencies, assignedSystems } = useAuth();
  const { isLight } = useTheme();
  const [desde, setDesde] = useState(systemCycle?.desde || getTodayDateString());
  const [hasta, setHasta] = useState(systemCycle?.hasta || getTodayDateString());

  const [loading, setLoading] = useState(false);
  const [metricsByCurrency, setMetricsByCurrency] = useState<Record<string, CurrencyOperationalMetrics>>({});
  const [selectedCurrency, setSelectedCurrency] = useState<string>(assignedCurrencies[0] || 'BS');
  
  // Supervisor cashier filter
  const [cashiersList, setCashiersList] = useState<CashierOption[]>([]);
  const [selectedCashier, setSelectedCashier] = useState<string>('all');

  // Accordion open/close states
  const [openGastos, setOpenGastos] = useState(false);
  const [openPagosOrdinarios, setOpenPagosOrdinarios] = useState(false);
  const [openPagosPremios, setOpenPagosPremios] = useState(false);
  const [copied, setCopied] = useState(false);

  const agencyName = agency?.nombre_agencia || '';
  const isSupervisor = user?.rol === 'supervisor' || user?.rol === 'admin';
  const isCajero = user?.rol === 'cajero';
  const isAgencia = user?.rol === 'agencia';

  // Mantener moneda seleccionada dentro de las asignadas
  useEffect(() => {
    if (assignedCurrencies.length > 0 && !assignedCurrencies.includes(selectedCurrency)) {
      setSelectedCurrency(assignedCurrencies[0]);
    }
  }, [assignedCurrencies, selectedCurrency]);

  // Cargar lista de cajeros si es supervisor
  useEffect(() => {
    if (isSupervisor) {
      const fetchCashiers = async () => {
        try {
          let q = supabase
            .table('taquilla_usuarios')
            .select('id, usuario, nombre_cajero, rol')
            .eq('rol', 'cajero');

          if (agency?.id) {
            q = q.eq('agencia_id', agency.id);
          }

          const { data } = await q;

          const cajeros = (data || []).map((u: any) => ({
            id: String(u.id),
            nombre: u.nombre_cajero || u.usuario,
          }));
          setCashiersList(cajeros);
        } catch (err) {
          console.error('Error fetching cashiers:', err);
        }
      };
      fetchCashiers();
    }
  }, [isSupervisor, agency?.id]);

  // Sincronizar fechas iniciales con el ciclo administrativo
  useEffect(() => {
    if (systemCycle?.desde && systemCycle?.hasta) {
      setDesde(systemCycle.desde);
      setHasta(systemCycle.hasta);
    }
  }, [systemCycle?.desde, systemCycle?.hasta]);

  const fetchReportData = useCallback(async (force = false) => {
    if (!agencyName || !desde || !hasta) return;
    setLoading(true);

    try {
      const filterCajero = isSupervisor ? selectedCashier : (isCajero ? String(user?.id) : null);
      const data = await fetchFullCycleMetrics(
        agencyName,
        systemCycle,
        assignedCurrencies,
        assignedSystems,
        user,
        agency,
        {
          customDesde: desde,
          customHasta: hasta,
          filterCajeroId: filterCajero,
          forceRefresh: force
        }
      );
      setMetricsByCurrency(data);
    } catch (err) {
      console.error('Error fetching date range report:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyName, desde, hasta, isSupervisor, isCajero, selectedCashier, user, agency, systemCycle, assignedCurrencies, assignedSystems]);

  useEffect(() => {
    if (agencyName && desde && hasta) {
      fetchReportData();
    }
  }, [fetchReportData, agencyName, desde, hasta]);

  const activeMetrics = metricsByCurrency[selectedCurrency];

  const handleCopyTicket = () => {
    if (!activeMetrics?.rawTicketText) return;
    navigator.clipboard.writeText(activeMetrics.rawTicketText);
    setCopied(true);
    confetti({ particleCount: 25, spread: 50, origin: { y: 0.8 } });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!activeMetrics?.rawTicketText) return;
    const url = `https://wa.me/?text=${encodeURIComponent(activeMetrics.rawTicketText)}`;
    window.open(url, '_blank');
  };

  const renderStatusBadge = (confirmado?: boolean, rechazado?: boolean) => {
    if (rechazado) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <XCircle className="w-3 h-3" />
          Rechazado
        </span>
      );
    }
    if (confirmado) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" />
          Confirmado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <Clock className="w-3 h-3" />
        Pendiente
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header de Filtros: Fechas y Rol */}
      <div className={`flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0D1B22] border-slate-800 shadow-xl'
      }`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              📅 Desde:
            </label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className={`rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-mono font-bold border ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#071217] border-slate-700 text-white'
              }`}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              📅 Hasta:
            </label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className={`rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-mono font-bold border ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#071217] border-slate-700 text-white'
              }`}
            />
          </div>

          {/* Selector de cajero para Supervisor */}
          {isSupervisor && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-500" />
              <select
                value={selectedCashier}
                onChange={(e) => setSelectedCashier(e.target.value)}
                className={`rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer border ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#071217] border-slate-700 text-white'
                }`}
              >
                <option value="all">👥 TODOS LOS CAJEROS</option>
                {cashiersList.map((c) => (
                  <option key={c.id} value={c.id}>
                    👤 {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Badge para Agencia */}
          {isAgencia && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-600 font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              <span>Consolidado General (Agencia)</span>
            </div>
          )}

          {/* Badge para Cajero */}
          {isCajero && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 font-semibold">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Mi Caja ({user?.nombre || user?.usuario})</span>
            </div>
          )}
        </div>

        <button
          onClick={() => fetchReportData(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-md shadow-emerald-500/10 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* 2. Selector de Pestañas Multimoneda */}
      <div className={`flex items-center gap-2 border-b pb-2 overflow-x-auto ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        {assignedCurrencies.map((curr) => {
          const isActive = selectedCurrency === curr;
          return (
            <button
              key={curr}
              onClick={() => setSelectedCurrency(curr)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : isLight
                  ? 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
                  : 'bg-[#0D1B22] text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800/80'
              }`}
            >
              <span>💱 REPORTES {curr}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Métricas Principales (Resumen General) */}
      <div className="space-y-3">
        <div className={`flex items-center gap-2 text-sm font-extrabold tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <span>📈 Resumen General ({selectedCurrency})</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Ventas */}
          <div className={`border p-4 rounded-2xl shadow-sm ${isLight ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-[#0D1B22] border-slate-800 shadow-md'}`}>
            <div className={`text-xs font-semibold mb-1 flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <span>Ventas</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className={`text-lg sm:text-xl font-black font-mono ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
              {formatMoney(activeMetrics?.ventas ?? 0, selectedCurrency)}
            </div>
          </div>

          {/* Comisión */}
          <div className={`border p-4 rounded-2xl shadow-sm ${isLight ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-[#0D1B22] border-slate-800 shadow-md'}`}>
            <div className={`text-xs font-semibold mb-1 flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <span>Comisión</span>
              <Receipt className="w-3.5 h-3.5 text-sky-500" />
            </div>
            <div className={`text-lg sm:text-xl font-black font-mono ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
              {formatMoney(activeMetrics?.comisiones ?? 0, selectedCurrency)}
            </div>
          </div>

          {/* Premios */}
          <div className={`border p-4 rounded-2xl shadow-sm ${isLight ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-[#0D1B22] border-slate-800 shadow-md'}`}>
            <div className={`text-xs font-semibold mb-1 flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <span>Premios</span>
              <Award className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className={`text-lg sm:text-xl font-black font-mono ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
              {formatMoney(activeMetrics?.premios ?? 0, selectedCurrency)}
            </div>
          </div>

          {/* Saldo Operativo */}
          <div className={`border p-4 rounded-2xl shadow-sm ${isLight ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-[#0D1B22] border-slate-800 shadow-md'}`}>
            <div className={`text-xs font-semibold mb-1 flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <span>Saldo Operativo</span>
              <CreditCard className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className={`text-lg sm:text-xl font-black font-mono ${
              (activeMetrics?.resultadoOp ?? 0) >= 0 
                ? (isLight ? 'text-emerald-700' : 'text-emerald-400') 
                : (isLight ? 'text-rose-700' : 'text-rose-400')
            }`}>
              {formatMoney(activeMetrics?.resultadoOp ?? 0, selectedCurrency)}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Barra de Fórmula de Balance Acumulado (Flecha 1 Screenshot 2) */}
      <div className={`border rounded-2xl p-3.5 text-xs text-center overflow-x-auto whitespace-nowrap ${
        isLight ? 'bg-slate-50/90 border-slate-200 text-slate-700 shadow-xs' : 'bg-[#0D1B22]/60 border-slate-800/80 shadow-inner'
      }`}>
        <span className={isLight ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium'}>Saldo Anterior ({selectedCurrency}):</span>{' '}
        <b className={`font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>{formatMoney(activeMetrics?.saldoAnterior ?? 0, selectedCurrency)}</b>
        <span className={`mx-2 font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>+</span>
        <span className={isLight ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium'}>Resultado Hoy / Periodo:</span>{' '}
        <b className={`font-mono ${(activeMetrics?.resultadoOp ?? 0) >= 0 ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : (isLight ? 'text-rose-700' : 'text-rose-400')}`}>
          {formatMoney(activeMetrics?.resultadoOp ?? 0, selectedCurrency)}
        </b>
        <span className={`mx-2 font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>-</span>
        <span className={isLight ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium'}>Gastos:</span>{' '}
        <b className={`font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>{formatMoney(activeMetrics?.gastos ?? 0, selectedCurrency)}</b>
        <span className={`mx-2 font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>-</span>
        <span className={isLight ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium'}>Pagos Bancos:</span>{' '}
        <b className={`font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>{formatMoney(activeMetrics?.pagoBanco ?? 0, selectedCurrency)}</b>
        <span className={`mx-2 font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>-</span>
        <span className={isLight ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium'}>Pago Efectivo:</span>{' '}
        <b className={`font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>{formatMoney(activeMetrics?.pagoEfectivo ?? 0, selectedCurrency)}</b>
        <span className={`mx-2 font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>+</span>
        <span className={isLight ? 'text-slate-600 font-medium' : 'text-slate-400 font-medium'}>Pago Pérdidas / Premios:</span>{' '}
        <b className={`font-mono ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>{formatMoney(activeMetrics?.pagoPremios ?? 0, selectedCurrency)}</b>
        <span className={`mx-2 font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>=</span>
        <span className={isLight ? 'text-slate-700 font-medium' : 'text-slate-400 font-medium'}>Saldo Actual ({selectedCurrency}):</span>{' '}
        <b className={`text-sm font-black font-mono ml-1 ${
          (activeMetrics?.saldoActual ?? 0) > 0.005 
            ? (isLight ? 'text-rose-700' : 'text-rose-400') 
            : (activeMetrics?.saldoActual ?? 0) < -0.005 
            ? (isLight ? 'text-emerald-700' : 'text-emerald-400') 
            : (isLight ? 'text-slate-800' : 'text-slate-300')
        }`}>
          {(activeMetrics?.saldoActual ?? 0) < -0.005 
            ? `+${formatMoney(Math.abs(activeMetrics?.saldoActual ?? 0), selectedCurrency)} (A favor)` 
            : (activeMetrics?.saldoActual ?? 0) > 0.005 
            ? `${formatMoney(activeMetrics?.saldoActual ?? 0, selectedCurrency)} (Deuda)` 
            : formatMoney(0, selectedCurrency)}
        </b>
      </div>

      {/* 5. Tabla: Detalle por Día */}
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0D1B22] border-slate-800 shadow-lg'}`}>
        <div className={`p-4 border-b flex items-center justify-between ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold tracking-wider uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
              📋 Detalle por Día ({selectedCurrency})
            </span>
          </div>
          <span className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {activeMetrics?.ventasDetalle?.length || 0} registros
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`font-bold uppercase tracking-wider border-b text-[10px] ${isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-[#071217] text-slate-400 border-slate-800'}`}>
              <tr>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Sistema</th>
                <th className="py-3 px-4">Moneda</th>
                <th className="py-3 px-4 text-right">Ventas</th>
                <th className="py-3 px-4 text-right">Comisión</th>
                <th className="py-3 px-4 text-right">Premios</th>
                <th className="py-3 px-4 text-right">Neto</th>
              </tr>
            </thead>
            <tbody className={`divide-y font-mono ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
              {!activeMetrics?.ventasDetalle || activeMetrics.ventasDetalle.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    Sin ventas registradas en {selectedCurrency} para este rango.
                  </td>
                </tr>
              ) : (
                <>
                  {activeMetrics.ventasDetalle.map((row, idx) => (
                    <tr key={idx} className={`transition-colors ${isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-800/30'}`}>
                      <td className={`py-2.5 px-4 font-sans font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{row.fecha || desde}</td>
                      <td className="py-2.5 px-4 font-bold text-sky-500">{row.sistema}</td>
                      <td className={`py-2.5 px-4 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{row.moneda}</td>
                      <td className={`py-2.5 px-4 text-right font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                        {formatMoney(row.venta, selectedCurrency)}
                      </td>
                      <td className={`py-2.5 px-4 text-right ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {formatMoney(row.comision, selectedCurrency)}
                      </td>
                      <td className={`py-2.5 px-4 text-right ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                        {formatMoney(row.premios, selectedCurrency)}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {formatMoney(row.neto, selectedCurrency)}
                      </td>
                    </tr>
                  ))}
                  {/* Fila de Totales (Flecha 2 Screenshot 2) */}
                  <tr className={`font-bold border-t-2 ${isLight ? 'bg-slate-100/90 border-slate-300' : 'bg-[#071217]/90 border-slate-700'}`}>
                    <td colSpan={3} className={`py-3 px-4 font-sans uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Total Ciclo ({selectedCurrency})
                    </td>
                    <td className={`py-3 px-4 text-right font-black ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                      {formatMoney(activeMetrics.ventas, selectedCurrency)}
                    </td>
                    <td className={`py-3 px-4 text-right font-black ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                      {formatMoney(activeMetrics.comisiones, selectedCurrency)}
                    </td>
                    <td className={`py-3 px-4 text-right font-black ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                      {formatMoney(activeMetrics.premios, selectedCurrency)}
                    </td>
                    <td className={`py-3 px-4 text-right font-black ${
                      activeMetrics.resultadoOp >= 0 
                        ? (isLight ? 'text-emerald-700' : 'text-emerald-400') 
                        : (isLight ? 'text-rose-700' : 'text-rose-400')
                    }`}>
                      {formatMoney(activeMetrics.resultadoOp, selectedCurrency)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Acordeones Desplegables de Actividad del Periodo */}
      {((activeMetrics?.gastosDetalle?.length || 0) > 0 ||
        (activeMetrics?.pagosOrdinariosDetalle?.length || 0) > 0 ||
        (activeMetrics?.pagosPremiosDetalle?.length || 0) > 0) && (
        <div className="space-y-3">
          {/* Acordeón: Gastos */}
          {(activeMetrics?.gastosDetalle?.length || 0) > 0 && (
            <div className={`border rounded-2xl overflow-hidden shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0D1B22] border-slate-800 shadow-md'}`}>
              <button
                onClick={() => setOpenGastos(!openGastos)}
                className={`w-full p-4 flex items-center justify-between text-left transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-rose-500" />
                  <span className={`text-xs font-bold tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    💸 Gastos ({selectedCurrency})
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {activeMetrics?.gastosDetalle?.length || 0}
                  </span>
                </div>
                {openGastos ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openGastos && (
                <div className={`border-t overflow-x-auto ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
                  <table className="w-full text-left text-xs">
                    <thead className={`font-bold uppercase tracking-wider border-b text-[10px] ${isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-[#071217] text-slate-400 border-slate-800'}`}>
                      <tr>
                        <th className="py-2.5 px-4">Fecha</th>
                        <th className="py-2.5 px-4">Agencia</th>
                        <th className="py-2.5 px-4">Cajero</th>
                        <th className="py-2.5 px-4">Concepto</th>
                        <th className="py-2.5 px-4 text-right">Monto</th>
                        <th className="py-2.5 px-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-mono ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
                      {activeMetrics.gastosDetalle.map((g, idx) => (
                        <tr key={idx} className={`transition-colors ${isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-800/20'}`}>
                          <td className={`py-2.5 px-4 font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{g.fecha}</td>
                          <td className={`py-2.5 px-4 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{g.agencia}</td>
                          <td className={`py-2.5 px-4 font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{g.cajero}</td>
                          <td className={`py-2.5 px-4 font-sans font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>{g.concepto}</td>
                          <td className={`py-2.5 px-4 text-right font-bold ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>{formatMoney(g.monto, selectedCurrency)}</td>
                          <td className="py-2.5 px-4 text-center">{renderStatusBadge(g.confirmado, g.rechazado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Acordeón: Pagos a la Operadora (Bancos / Efectivo) */}
          {(activeMetrics?.pagosOrdinariosDetalle?.length || 0) > 0 && (
            <div className={`border rounded-2xl overflow-hidden shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0D1B22] border-slate-800 shadow-md'}`}>
              <button
                onClick={() => setOpenPagosOrdinarios(!openPagosOrdinarios)}
                className={`w-full p-4 flex items-center justify-between text-left transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-500" />
                  <span className={`text-xs font-bold tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    🏦 Pagos a la Operadora (Bancos / Efectivo) ({selectedCurrency})
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {activeMetrics?.pagosOrdinariosDetalle?.length || 0}
                  </span>
                </div>
                {openPagosOrdinarios ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openPagosOrdinarios && (
                <div className={`border-t overflow-x-auto ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
                  <table className="w-full text-left text-xs">
                    <thead className={`font-bold uppercase tracking-wider border-b text-[10px] ${isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-[#071217] text-slate-400 border-slate-800'}`}>
                      <tr>
                        <th className="py-2.5 px-4">Fecha</th>
                        <th className="py-2.5 px-4">Agencia</th>
                        <th className="py-2.5 px-4">Cajero</th>
                        <th className="py-2.5 px-4">Pagos Registrados</th>
                        <th className="py-2.5 px-4">Referencia / Banco</th>
                        <th className="py-2.5 px-4 text-right">Monto</th>
                        <th className="py-2.5 px-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-mono ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
                      {activeMetrics.pagosOrdinariosDetalle.map((p, idx) => (
                        <tr key={idx} className={`transition-colors ${isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-800/20'}`}>
                          <td className={`py-2.5 px-4 font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{p.fecha}</td>
                          <td className={`py-2.5 px-4 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{p.agencia}</td>
                          <td className={`py-2.5 px-4 font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{p.cajero}</td>
                          <td className={`py-2.5 px-4 font-sans font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>{p.tipo_pago}</td>
                          <td className="py-2.5 px-4 text-sky-500 font-sans">{p.referencia}</td>
                          <td className={`py-2.5 px-4 text-right font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>{formatMoney(p.monto, selectedCurrency)}</td>
                          <td className="py-2.5 px-4 text-center">{renderStatusBadge(p.confirmado, p.rechazado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Acordeón: Pagos de Premios / Reposición de Pérdidas */}
          {(activeMetrics?.pagosPremiosDetalle?.length || 0) > 0 && (
            <div className={`border rounded-2xl overflow-hidden shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0D1B22] border-slate-800 shadow-md'}`}>
              <button
                onClick={() => setOpenPagosPremios(!openPagosPremios)}
                className={`w-full p-4 flex items-center justify-between text-left transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span className={`text-xs font-bold tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    🏆 Pagos de Premios / Reposición de Pérdidas ({selectedCurrency})
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {activeMetrics?.pagosPremiosDetalle?.length || 0}
                  </span>
                </div>
                {openPagosPremios ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openPagosPremios && (
                <div className={`border-t overflow-x-auto ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
                  <table className="w-full text-left text-xs">
                    <thead className={`font-bold uppercase tracking-wider border-b text-[10px] ${isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-[#071217] text-slate-400 border-slate-800'}`}>
                      <tr>
                        <th className="py-2.5 px-4">Fecha</th>
                        <th className="py-2.5 px-4">Agencia</th>
                        <th className="py-2.5 px-4">Cajero</th>
                        <th className="py-2.5 px-4">Detalle / Concepto</th>
                        <th className="py-2.5 px-4">Referencia / Cuenta</th>
                        <th className="py-2.5 px-4 text-right">Monto</th>
                        <th className="py-2.5 px-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-mono ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
                      {activeMetrics.pagosPremiosDetalle.map((p, idx) => (
                        <tr key={idx} className={`transition-colors ${isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-800/20'}`}>
                          <td className={`py-2.5 px-4 font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{p.fecha}</td>
                          <td className={`py-2.5 px-4 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{p.agencia}</td>
                          <td className={`py-2.5 px-4 font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{p.cajero}</td>
                          <td className={`py-2.5 px-4 font-sans font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>{p.tipo_pago}</td>
                          <td className="py-2.5 px-4 text-amber-500 font-sans">{p.referencia}</td>
                          <td className={`py-2.5 px-4 text-right font-bold ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>{formatMoney(p.monto, selectedCurrency)}</td>
                          <td className="py-2.5 px-4 text-center">{renderStatusBadge(p.confirmado, p.rechazado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 7. Vista Previa de Reporte en Ticket Monoespaciado y WhatsApp */}
      <div className={`border rounded-2xl p-4 shadow-sm space-y-3 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0D1B22] border-slate-800 shadow-xl'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
              📄 Vista previa Reporte ({selectedCurrency})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyTicket}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>📲 Compartir por WhatsApp</span>
            </button>
          </div>
        </div>

        <textarea
          readOnly
          value={activeMetrics?.rawTicketText || 'Generando reporte...'}
          rows={14}
          className={`w-full rounded-xl p-3 text-xs font-mono focus:outline-none resize-y leading-relaxed select-all border ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#071217] border-slate-800 text-slate-300'
          }`}
        />
      </div>
    </div>
  );
};
