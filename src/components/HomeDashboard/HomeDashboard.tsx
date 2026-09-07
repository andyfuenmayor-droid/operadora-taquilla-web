import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, formatDate, getTodayDateString } from '../../utils/formatters';
import { 
  fetchFullCycleMetrics, 
  type CurrencyOperationalMetrics 
} from '../../utils/operationalDashboard';
import { 
  Building2, 
  Calendar, 
  Phone, 
  DollarSign, 
  Calculator, 
  Award, 
  TrendingUp, 
  Lock, 
  Unlock,
  RefreshCw,
  Percent,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react';

interface HomeDashboardProps {
  onNavigate?: (tab: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = () => {
  const { user, agency, systemCycle, assignedCurrencies, assignedSystems, isDayClosed } = useAuth();
  const [metricsByCurrency, setMetricsByCurrency] = useState<Record<string, CurrencyOperationalMetrics>>({});
  const [selectedCurrency, setSelectedCurrency] = useState<string>(assignedCurrencies[0] || 'BS');
  const [loading, setLoading] = useState(false);

  const agencyName = agency?.nombre_agencia || '';
  const waNumber = agency?.telefono_whatsapp || agency?.telefono || '';

  // Actualizar selectedCurrency si assignedCurrencies cambia
  useEffect(() => {
    if (assignedCurrencies.length > 0 && !assignedCurrencies.includes(selectedCurrency)) {
      setSelectedCurrency(assignedCurrencies[0]);
    }
  }, [assignedCurrencies, selectedCurrency]);

  const loadData = useCallback(async (force = false) => {
    if (!agencyName) return;
    setLoading(true);
    try {
      const data = await fetchFullCycleMetrics(
        agencyName,
        systemCycle,
        assignedCurrencies,
        assignedSystems,
        user,
        agency,
        { forceRefresh: force }
      );
      setMetricsByCurrency(data);
    } catch (err) {
      console.error('Error fetching full operational metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyName, systemCycle, assignedCurrencies, assignedSystems, user, agency]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const todayStr = getTodayDateString();
  const cycleDesde = systemCycle?.desde || todayStr;
  const cycleHasta = systemCycle?.hasta || todayStr;
  const cycleRangeStr = `${cycleDesde} al ${cycleHasta}`;
  const cycleSemana = systemCycle?.semana ? `(Sem. ${systemCycle.semana})` : '';

  const activeMetrics = metricsByCurrency[selectedCurrency];

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fadeIn">
      {/* 1. Welcome Banner */}
      <div className="bg-gradient-to-br from-[#0B1325]/95 via-[#0D1B2A]/95 to-[#071217]/95 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>👋 ¡Bienvenido, {user?.nombre || user?.usuario}!</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 font-semibold text-slate-200">
                <Building2 className="w-4 h-4 text-emerald-400" />
                {agencyName}
              </span>
              <span>&bull;</span>
              <span>Rol: <strong className="text-emerald-400 uppercase">{user?.rol || 'cajero'}</strong></span>
              {waNumber && (
                <>
                  <span>&bull;</span>
                  <a
                    href={`https://wa.me/${waNumber.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 transition-colors"
                  >
                    <Phone className="w-3 h-3" />
                    WhatsApp: {waNumber}
                  </a>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2 text-right">
            <div className="flex items-center gap-2">
              {isDayClosed ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Lock className="w-3.5 h-3.5" />
                  🔒 DÍA OPERATIVO CERRADO
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Unlock className="w-3.5 h-3.5" />
                  🟢 DÍA OPERATIVO ABIERTO
                </span>
              )}

              <button
                onClick={() => loadData(true)}
                disabled={loading}
                title="Actualizar datos operativos"
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>

            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-end gap-1.5 flex-wrap">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                📅 Día Operativo: <strong className="text-white font-mono">{formatDate(todayStr)}</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                Ciclo Admin {cycleSemana}: <strong className="text-slate-200 font-mono">{cycleRangeStr}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Estado de Saldo / Deuda por Moneda Asignada */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Estado de Saldo / Deuda por Moneda Asignada
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Monedas asignadas a esta agencia por el administrador
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignedCurrencies.map((curr) => {
            const m = metricsByCurrency[curr];
            const bal = m?.saldoActual ?? 0;
            const isSelected = selectedCurrency === curr;
            const isPositive = bal >= 0;

            return (
              <div
                key={curr}
                onClick={() => setSelectedCurrency(curr)}
                className={`bg-[#071217] border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-emerald-500/50 bg-[#0a1820] shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/40' 
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    Moneda: <strong className="text-white">{curr}</strong>
                  </div>
                  <div className={`text-2xl font-black font-mono tracking-tight ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {loading ? 'Calculando...' : formatMoney(bal, curr)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {isPositive ? 'Saldo a favor / en caja' : 'Deuda pendiente'}
                  </div>
                </div>
                <div className={`p-3 rounded-xl border transition-all ${
                  isPositive 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Pestañas de Áreas Operativas por Moneda */}
      {assignedCurrencies.length > 1 && (
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          {assignedCurrencies.map((curr) => {
            const isSelected = selectedCurrency === curr;
            return (
              <button
                key={curr}
                onClick={() => setSelectedCurrency(curr)}
                className={`px-5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                    : 'bg-[#0D1B22] text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>💱 ÁREA OPERATIVA: <strong>{curr}</strong></span>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. Resumen Operativo de la Moneda Seleccionada */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              📊
            </span>
            <span>Resumen Operativo ({selectedCurrency}) - Ciclo Admin: {cycleRangeStr}</span>
          </h3>
          {activeMetrics && (
            <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
              Moneda: <strong className="text-emerald-400">{selectedCurrency}</strong>
            </span>
          )}
        </div>

        {/* 4 Tarjetas de Métricas Operativas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Ventas */}
          <div className="bg-[#0D1B22] border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition-all shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ventas</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
              {loading ? '...' : formatMoney(activeMetrics?.ventas ?? 0, selectedCurrency)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Total ventas del ciclo</div>
          </div>

          {/* Comision */}
          <div className="bg-[#0D1B22] border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition-all shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comisión</span>
              <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-sky-400">
              {loading ? '...' : formatMoney(activeMetrics?.comisiones ?? 0, selectedCurrency)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Retención de comisiones</div>
          </div>

          {/* Premios */}
          <div className="bg-[#0D1B22] border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition-all shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Premios</span>
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-purple-400">
              {loading ? '...' : formatMoney(activeMetrics?.premios ?? 0, selectedCurrency)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Premios validados / en lotes</div>
          </div>

          {/* Saldo / Resultado Operativo */}
          <div className="bg-[#0D1B22] border border-slate-800/80 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition-all shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saldo</span>
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <Calculator className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${
              (activeMetrics?.resultadoOp ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {loading ? '...' : formatMoney(activeMetrics?.resultadoOp ?? 0, selectedCurrency)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Ventas - Com. - Premios</div>
          </div>
        </div>

        {/* 5. Barra de Balance Acumulado con la Fórmula Matemática */}
        {activeMetrics && (
          <div className="bg-gradient-to-r from-[#0D1B22] via-[#0A161C] to-[#0D1B22] border border-slate-800 rounded-2xl p-4 text-xs shadow-lg">
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-center leading-relaxed font-mono">
              <span className="text-slate-400">Saldo Anterior ({selectedCurrency}):</span>
              <strong className="text-white">{formatMoney(activeMetrics.saldoAnterior, selectedCurrency)}</strong>

              <span className="text-slate-600 font-bold px-0.5">+</span>

              <span className="text-slate-400">Resultado Hoy / Periodo:</span>
              <strong className={activeMetrics.resultadoOp >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {formatMoney(activeMetrics.resultadoOp, selectedCurrency)}
              </strong>

              <span className="text-slate-600 font-bold px-0.5">-</span>

              <span className="text-slate-400">Gastos:</span>
              <strong className="text-white">{formatMoney(activeMetrics.gastos, selectedCurrency)}</strong>

              <span className="text-slate-600 font-bold px-0.5">-</span>

              <span className="text-slate-400">Pagos Bancos:</span>
              <strong className="text-white">{formatMoney(activeMetrics.pagoBanco, selectedCurrency)}</strong>

              <span className="text-slate-600 font-bold px-0.5">-</span>

              <span className="text-slate-400">Pago Efectivo:</span>
              <strong className="text-white">{formatMoney(activeMetrics.pagoEfectivo, selectedCurrency)}</strong>

              <span className="text-slate-600 font-bold px-0.5">+</span>

              <span className="text-slate-400">Pago Pérdidas / Premios:</span>
              <strong className="text-emerald-400">{formatMoney(activeMetrics.pagoPremios, selectedCurrency)}</strong>

              <span className="text-slate-600 font-bold px-0.5">=</span>

              <span className="text-slate-300 font-bold">Saldo Actual ({selectedCurrency}):</span>
              <strong className={`text-sm sm:text-base px-2.5 py-0.5 rounded-lg border ${
                activeMetrics.saldoActual >= 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {formatMoney(activeMetrics.saldoActual, selectedCurrency)}
              </strong>
            </div>
          </div>
        )}

        {/* 6. TABLAS DE ACTIVIDAD DE LA MONEDA */}
        <div className="space-y-6 pt-2">
          {/* TABLA 1: Ventas del Ciclo */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>📋</span>
                <span>Ventas del Ciclo - {selectedCurrency} ({cycleRangeStr})</span>
              </h4>
            </div>

            {(!activeMetrics || activeMetrics.ventasDetalle.length === 0) ? (
              <div className="bg-[#071217] border border-slate-800/80 rounded-2xl p-6 text-center text-xs text-slate-400">
                ℹ️ Sin registros de ventas cargados en {selectedCurrency} para este ciclo.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="py-2.5 px-3">Sistema</th>
                      <th className="py-2.5 px-3">Moneda</th>
                      <th className="py-2.5 px-3 text-right">Venta</th>
                      <th className="py-2.5 px-3 text-right">Comisión</th>
                      <th className="py-2.5 px-3 text-right">Premios</th>
                      <th className="py-2.5 px-3 text-right">Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {activeMetrics.ventasDetalle.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-bold text-white flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {row.sistema}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-sans">{row.moneda}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          {formatMoney(row.venta, selectedCurrency)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sky-400">
                          {formatMoney(row.comision, selectedCurrency)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-purple-400">
                          {formatMoney(row.premios, selectedCurrency)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${
                          row.neto >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {formatMoney(row.neto, selectedCurrency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-700 bg-slate-900/50 font-mono font-bold text-white text-xs">
                      <td className="py-2.5 px-3 font-sans">TOTAL</td>
                      <td className="py-2.5 px-3 font-sans">{selectedCurrency}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400">
                        {formatMoney(activeMetrics.ventas, selectedCurrency)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-sky-400">
                        {formatMoney(activeMetrics.comisiones, selectedCurrency)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-purple-400">
                        {formatMoney(activeMetrics.premios, selectedCurrency)}
                      </td>
                      <td className={`py-2.5 px-3 text-right ${
                        activeMetrics.resultadoOp >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {formatMoney(activeMetrics.resultadoOp, selectedCurrency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* TABLA 2: Gastos del Ciclo (si tiene) */}
          {activeMetrics && activeMetrics.gastosDetalle.length > 0 && (
            <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span>💸</span>
                  <span>Gastos del Ciclo - {selectedCurrency}</span>
                </h4>
                <span className="text-xs font-mono font-bold text-rose-400">
                  Total: {formatMoney(activeMetrics.gastos, selectedCurrency)}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Agencia</th>
                      <th className="py-2.5 px-3">Cajero</th>
                      <th className="py-2.5 px-3">Concepto</th>
                      <th className="py-2.5 px-3">Moneda</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                      <th className="py-2.5 px-3 text-center">Conf.</th>
                      <th className="py-2.5 px-3">Motivo Rechazo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeMetrics.gastosDetalle.map((g, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-300">{formatDate(g.fecha)}</td>
                        <td className="py-2.5 px-3 font-semibold text-white">{g.agencia}</td>
                        <td className="py-2.5 px-3 text-slate-400">{g.cajero}</td>
                        <td className="py-2.5 px-3 text-slate-200">{g.concepto}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{g.moneda}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-400">
                          {formatMoney(g.monto, selectedCurrency)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderStatusBadge(g.confirmado, g.rechazado)}
                        </td>
                        <td className="py-2.5 px-3 text-rose-400/80 text-[11px]">
                          {g.motivo_rechazo || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABLA 3: Pagos a Operadora (Bancos / Efectivo) */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>🏦</span>
                <span>Pagos a Operadora (Bancos / Efectivo) - {selectedCurrency}</span>
              </h4>
              {activeMetrics && (
                <span className="text-xs font-mono font-bold text-sky-400">
                  Total: {formatMoney(activeMetrics.pagoBanco + activeMetrics.pagoEfectivo, selectedCurrency)}
                </span>
              )}
            </div>

            {(!activeMetrics || activeMetrics.pagosOrdinariosDetalle.length === 0) ? (
              <div className="bg-[#071217] border border-slate-800/80 rounded-2xl p-6 text-center text-xs text-slate-400">
                ℹ️ Sin pagos ordinarios a la operadora en {selectedCurrency}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Agencia</th>
                      <th className="py-2.5 px-3">Cajero</th>
                      <th className="py-2.5 px-3">Pagos Registrados</th>
                      <th className="py-2.5 px-3">Referencia / Banco</th>
                      <th className="py-2.5 px-3">Moneda</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                      <th className="py-2.5 px-3 text-center">Conf.</th>
                      <th className="py-2.5 px-3">Motivo Rechazo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeMetrics.pagosOrdinariosDetalle.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-300">{formatDate(p.fecha)}</td>
                        <td className="py-2.5 px-3 font-semibold text-white">{p.agencia}</td>
                        <td className="py-2.5 px-3 text-slate-400">{p.cajero}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">{p.tipo_pago}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] max-w-[200px] truncate" title={p.referencia}>
                          {p.referencia}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{p.moneda}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-400">
                          {formatMoney(p.monto, selectedCurrency)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderStatusBadge(p.confirmado, p.rechazado)}
                        </td>
                        <td className="py-2.5 px-3 text-rose-400/80 text-[11px]">
                          {p.motivo_rechazo || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-700 bg-slate-900/50 font-mono font-bold text-white text-xs">
                      <td colSpan={6} className="py-2.5 px-3 font-sans">TOTAL PAGOS ORDINARIOS</td>
                      <td className="py-2.5 px-3 text-right text-sky-400">
                        {formatMoney(activeMetrics.pagoBanco + activeMetrics.pagoEfectivo, selectedCurrency)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* TABLA 4: Pagos de Premios / Reposición de Pérdidas */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>🏆</span>
                <span>Pagos de Premios / Reposición de Pérdidas - {selectedCurrency}</span>
              </h4>
              {activeMetrics && activeMetrics.pagosPremiosDetalle.length > 0 && (
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Total: {formatMoney(activeMetrics.pagoPremios, selectedCurrency)}
                </span>
              )}
            </div>

            {(!activeMetrics || activeMetrics.pagosPremiosDetalle.length === 0) ? (
              <div className="bg-[#071217] border border-slate-800/80 rounded-2xl p-6 text-center text-xs text-slate-500">
                ℹ️ No hay reposiciones ni pagos de premios registrados en {selectedCurrency} para este ciclo.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Agencia</th>
                      <th className="py-2.5 px-3">Cajero</th>
                      <th className="py-2.5 px-3">Detalle / Concepto</th>
                      <th className="py-2.5 px-3">Referencia / Cuenta</th>
                      <th className="py-2.5 px-3">Moneda</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                      <th className="py-2.5 px-3 text-center">Conf.</th>
                      <th className="py-2.5 px-3">Motivo Rechazo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeMetrics.pagosPremiosDetalle.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-300">{formatDate(p.fecha)}</td>
                        <td className="py-2.5 px-3 font-semibold text-white">{p.agencia}</td>
                        <td className="py-2.5 px-3 text-slate-400">{p.cajero}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">{p.tipo_pago}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] max-w-[200px] truncate" title={p.referencia}>
                          {p.referencia}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{p.moneda}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                          {formatMoney(p.monto, selectedCurrency)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderStatusBadge(p.confirmado, p.rechazado)}
                        </td>
                        <td className="py-2.5 px-3 text-rose-400/80 text-[11px]">
                          {p.motivo_rechazo || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-700 bg-slate-900/50 font-mono font-bold text-white text-xs">
                      <td colSpan={6} className="py-2.5 px-3 font-sans">TOTAL REPOSICIÓN / PREMIOS</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400">
                        {formatMoney(activeMetrics.pagoPremios, selectedCurrency)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
