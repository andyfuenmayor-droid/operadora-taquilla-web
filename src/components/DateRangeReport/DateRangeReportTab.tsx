import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
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

  const fetchReportData = useCallback(async (force = false) => {
    if (!agencyName) return;
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
    fetchReportData();
  }, [fetchReportData]);

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
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              📅 Desde:
            </label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              📅 Hasta:
            </label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
            />
          </div>

          {/* Selector de cajero para Supervisor */}
          {isSupervisor && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <select
                value={selectedCashier}
                onChange={(e) => setSelectedCashier(e.target.value)}
                className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer"
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
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-400 font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              <span>Consolidado General (Agencia)</span>
            </div>
          )}

          {/* Badge para Cajero */}
          {isCajero && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-semibold">
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
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {assignedCurrencies.map((curr) => {
          const isActive = selectedCurrency === curr;
          return (
            <button
              key={curr}
              onClick={() => setSelectedCurrency(curr)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
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
        <div className="flex items-center gap-2 text-sm font-extrabold text-white tracking-wide">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>📈 Resumen General ({selectedCurrency})</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Ventas */}
          <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl shadow-md">
            <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center justify-between">
              <span>Ventas</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono">
              {formatMoney(activeMetrics?.ventas ?? 0, selectedCurrency)}
            </div>
          </div>

          {/* Comisión */}
          <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl shadow-md">
            <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center justify-between">
              <span>Comisión</span>
              <Receipt className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-sky-400 font-mono">
              {formatMoney(activeMetrics?.comisiones ?? 0, selectedCurrency)}
            </div>
          </div>

          {/* Premios */}
          <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl shadow-md">
            <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center justify-between">
              <span>Premios</span>
              <Award className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-400 font-mono">
              {formatMoney(activeMetrics?.premios ?? 0, selectedCurrency)}
            </div>
          </div>

          {/* Saldo Operativo */}
          <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl shadow-md">
            <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center justify-between">
              <span>Saldo Operativo</span>
              <CreditCard className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className={`text-lg sm:text-xl font-black font-mono ${
              (activeMetrics?.resultadoOp ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {formatMoney(activeMetrics?.resultadoOp ?? 0, selectedCurrency)}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Barra de Fórmula de Balance Acumulado */}
      <div className="bg-[#0D1B22]/60 border border-slate-800/80 rounded-2xl p-3.5 text-xs text-center shadow-inner overflow-x-auto whitespace-nowrap">
        <span className="text-slate-400 font-medium">Saldo Anterior ({selectedCurrency}):</span>{' '}
        <b className="text-white font-mono">{formatMoney(activeMetrics?.saldoAnterior ?? 0, selectedCurrency)}</b>
        <span className="mx-2 text-slate-500 font-bold">+</span>
        <span className="text-slate-400 font-medium">Resultado Hoy / Periodo:</span>{' '}
        <b className={`font-mono ${(activeMetrics?.resultadoOp ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {formatMoney(activeMetrics?.resultadoOp ?? 0, selectedCurrency)}
        </b>
        <span className="mx-2 text-slate-500 font-bold">-</span>
        <span className="text-slate-400 font-medium">Gastos:</span>{' '}
        <b className="text-white font-mono">{formatMoney(activeMetrics?.gastos ?? 0, selectedCurrency)}</b>
        <span className="mx-2 text-slate-500 font-bold">-</span>
        <span className="text-slate-400 font-medium">Pagos Bancos:</span>{' '}
        <b className="text-white font-mono">{formatMoney(activeMetrics?.pagoBanco ?? 0, selectedCurrency)}</b>
        <span className="mx-2 text-slate-500 font-bold">-</span>
        <span className="text-slate-400 font-medium">Pago Efectivo:</span>{' '}
        <b className="text-white font-mono">{formatMoney(activeMetrics?.pagoEfectivo ?? 0, selectedCurrency)}</b>
        <span className="mx-2 text-slate-500 font-bold">+</span>
        <span className="text-slate-400 font-medium">Pago Pérdidas / Premios:</span>{' '}
        <b className="text-emerald-400 font-mono">{formatMoney(activeMetrics?.pagoPremios ?? 0, selectedCurrency)}</b>
        <span className="mx-2 text-slate-500 font-bold">=</span>
        <span className="text-slate-400 font-medium">Saldo Actual ({selectedCurrency}):</span>{' '}
        <b className={`text-sm font-black font-mono ml-1 ${
          (activeMetrics?.saldoActual ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
        }`}>
          {formatMoney(activeMetrics?.saldoActual ?? 0, selectedCurrency)}
        </b>
      </div>

      {/* 5. Tabla: Detalle por Día */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-wider uppercase">
              📋 Detalle por Día ({selectedCurrency})
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {activeMetrics?.ventasDetalle?.length || 0} registros
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#071217] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
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
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {!activeMetrics?.ventasDetalle || activeMetrics.ventasDetalle.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    Sin ventas registradas en {selectedCurrency} para este rango.
                  </td>
                </tr>
              ) : (
                <>
                  {activeMetrics.ventasDetalle.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-4 text-slate-300 font-sans font-medium">{row.fecha || desde}</td>
                      <td className="py-2.5 px-4 font-bold text-sky-400">{row.sistema}</td>
                      <td className="py-2.5 px-4 text-slate-400">{row.moneda}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                        {formatMoney(row.venta, selectedCurrency)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-300">
                        {formatMoney(row.comision, selectedCurrency)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-amber-400">
                        {formatMoney(row.premios, selectedCurrency)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-white">
                        {formatMoney(row.neto, selectedCurrency)}
                      </td>
                    </tr>
                  ))}
                  {/* Fila de Totales */}
                  <tr className="bg-[#071217]/90 font-bold border-t-2 border-slate-700">
                    <td colSpan={3} className="py-3 px-4 text-white font-sans uppercase">
                      Total Ciclo ({selectedCurrency})
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-black">
                      {formatMoney(activeMetrics.ventas, selectedCurrency)}
                    </td>
                    <td className="py-3 px-4 text-right text-sky-400 font-black">
                      {formatMoney(activeMetrics.comisiones, selectedCurrency)}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-400 font-black">
                      {formatMoney(activeMetrics.premios, selectedCurrency)}
                    </td>
                    <td className="py-3 px-4 text-right text-purple-400 font-black">
                      {formatMoney(activeMetrics.resultadoOp, selectedCurrency)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Acordeones Desplegables de Actividad del Periodo (solo si hay registros) */}
      {((activeMetrics?.gastosDetalle?.length || 0) > 0 ||
        (activeMetrics?.pagosOrdinariosDetalle?.length || 0) > 0 ||
        (activeMetrics?.pagosPremiosDetalle?.length || 0) > 0) && (
        <div className="space-y-3">
          {/* Acordeón: Gastos */}
          {(activeMetrics?.gastosDetalle?.length || 0) > 0 && (
            <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <button
                onClick={() => setOpenGastos(!openGastos)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-bold text-white tracking-wide">
                    💸 Gastos ({selectedCurrency})
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono font-bold">
                    {activeMetrics?.gastosDetalle?.length || 0}
                  </span>
                </div>
                {openGastos ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openGastos && (
                <div className="border-t border-slate-800/80 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#071217] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">Fecha</th>
                        <th className="py-2.5 px-4">Agencia</th>
                        <th className="py-2.5 px-4">Cajero</th>
                        <th className="py-2.5 px-4">Concepto</th>
                        <th className="py-2.5 px-4 text-right">Monto</th>
                        <th className="py-2.5 px-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {activeMetrics.gastosDetalle.map((g, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20">
                          <td className="py-2.5 px-4 text-slate-300 font-sans">{g.fecha}</td>
                          <td className="py-2.5 px-4 text-slate-400 font-sans">{g.agencia}</td>
                          <td className="py-2.5 px-4 text-slate-300 font-sans">{g.cajero}</td>
                          <td className="py-2.5 px-4 text-white font-sans font-medium">{g.concepto}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-rose-400">{formatMoney(g.monto, selectedCurrency)}</td>
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
            <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <button
                onClick={() => setOpenPagosOrdinarios(!openPagosOrdinarios)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-white tracking-wide">
                    🏦 Pagos a la Operadora (Bancos / Efectivo) ({selectedCurrency})
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono font-bold">
                    {activeMetrics?.pagosOrdinariosDetalle?.length || 0}
                  </span>
                </div>
                {openPagosOrdinarios ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openPagosOrdinarios && (
                <div className="border-t border-slate-800/80 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#071217] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
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
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {activeMetrics.pagosOrdinariosDetalle.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20">
                          <td className="py-2.5 px-4 text-slate-300 font-sans">{p.fecha}</td>
                          <td className="py-2.5 px-4 text-slate-400 font-sans">{p.agencia}</td>
                          <td className="py-2.5 px-4 text-slate-300 font-sans">{p.cajero}</td>
                          <td className="py-2.5 px-4 text-white font-sans font-medium">{p.tipo_pago}</td>
                          <td className="py-2.5 px-4 text-sky-400 font-sans">{p.referencia}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-400">{formatMoney(p.monto, selectedCurrency)}</td>
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
            <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <button
                onClick={() => setOpenPagosPremios(!openPagosPremios)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white tracking-wide">
                    🏆 Pagos de Premios / Reposición de Pérdidas ({selectedCurrency})
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono font-bold">
                    {activeMetrics?.pagosPremiosDetalle?.length || 0}
                  </span>
                </div>
                {openPagosPremios ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {openPagosPremios && (
                <div className="border-t border-slate-800/80 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#071217] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
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
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {activeMetrics.pagosPremiosDetalle.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20">
                          <td className="py-2.5 px-4 text-slate-300 font-sans">{p.fecha}</td>
                          <td className="py-2.5 px-4 text-slate-400 font-sans">{p.agencia}</td>
                          <td className="py-2.5 px-4 text-slate-300 font-sans">{p.cajero}</td>
                          <td className="py-2.5 px-4 text-white font-sans font-medium">{p.tipo_pago}</td>
                          <td className="py-2.5 px-4 text-amber-400 font-sans">{p.referencia}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-amber-400">{formatMoney(p.monto, selectedCurrency)}</td>
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
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-wide">
              📄 Vista previa Reporte ({selectedCurrency})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyTicket}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
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
          className="w-full bg-[#071217] border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 focus:outline-none resize-y leading-relaxed select-all"
        />
      </div>
    </div>
  );
};
