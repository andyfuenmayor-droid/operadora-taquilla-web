import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { formatMoney, formatDate, getTodayDateString } from '../../utils/formatters';
import { supabase } from '../../lib/supabase';
import { 
  fetchFullCycleMetrics, 
  clearMetricsCache,
  type CurrencyOperationalMetrics 
} from '../../utils/operationalDashboard';
import { 
  Calendar, 
  Phone, 
  DollarSign, 
  Calculator, 
  Award, 
  TrendingUp, 
  Unlock, 
  RefreshCw, 
  Percent, 
  CheckCircle2, 
  Clock, 
  XCircle 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { realtimeBroadcast } from '../../utils/realtimeBroadcast';
import { notificationService } from '../../utils/notificationService';
import { formatCurrency } from '../../utils/formatters';

interface HomeDashboardProps {
  onNavigate?: (tab: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = () => {
  const { user, agency, systemCycle, assignedCurrencies, assignedSystems } = useAuth();
  const { isLight } = useTheme();
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

  const loadData = useCallback(async (force = true) => {
    if (!agencyName) return;
    if (!systemCycle || !systemCycle.desde) return;
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
  }, [agencyName, systemCycle?.desde, systemCycle?.hasta, assignedCurrencies, assignedSystems, user, agency]);

  useEffect(() => {
    if (agencyName && systemCycle?.desde) {
      loadData(true);
    }
  }, [loadData, agencyName, systemCycle?.desde]);

  // Refrescar al volver a la ventana/pestaña
  useEffect(() => {
    const handleFocus = () => {
      if (agencyName && systemCycle?.desde) {
        clearMetricsCache();
        loadData(true);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadData, agencyName, systemCycle?.desde]);

  // 1. Suscripción a eventos broadcast globales en tiempo real por WebSockets
  useEffect(() => {
    if (!agencyName) return;
    const safeAgency = agencyName.trim().toUpperCase();

    const unsubConfirmed = realtimeBroadcast.subscribe('PAYMENT_CONFIRMED', (data) => {
      const dataAg = String(data.agencia || '').trim().toUpperCase();
      if (dataAg === safeAgency || dataAg.includes(safeAgency) || safeAgency.includes(dataAg)) {
        notificationService.showNotification('✅ ¡Pago Bancario Confirmado!', {
          body: `Ref: ${data.referencia || 'N/A'} por ${formatCurrency(Number(data.monto || 0), (data.moneda || 'BS') as any)} ha sido confirmado por ${data.confirmado_por || 'Supervisor'}.`,
          soundType: 'confirmed',
          toastType: 'success',
          tag: `home_conf_${data.id || data.referencia}`,
        });
        try {
          confetti({ particleCount: 40, spread: 65, origin: { y: 0.7 } });
        } catch (_) {}
        clearMetricsCache();
        loadData(true);
      }
    });

    const unsubRejected = realtimeBroadcast.subscribe('PAYMENT_REJECTED', (data) => {
      const dataAg = String(data.agencia || '').trim().toUpperCase();
      if (dataAg === safeAgency || dataAg.includes(safeAgency) || safeAgency.includes(dataAg)) {
        notificationService.showNotification('❌ Pago Rechazado', {
          body: `Ref: ${data.referencia || 'N/A'} por ${formatCurrency(Number(data.monto || 0), (data.moneda || 'BS') as any)}. Motivo: ${data.motivo_rechazo || data.motivo || 'No especificado'}.`,
          soundType: 'rejected',
          toastType: 'warning',
          tag: `home_rech_${data.id || data.referencia}`,
        });
        clearMetricsCache();
        loadData(true);
      }
    });

    const unsubDataChanged = realtimeBroadcast.subscribe('DATA_CHANGED', (data) => {
      const dataAg = String(data.agencia || '').trim().toUpperCase();
      if (!dataAg || dataAg === safeAgency || dataAg.includes(safeAgency) || safeAgency.includes(dataAg)) {
        clearMetricsCache();
        loadData(true);
      }
    });

    const unsubNewExpense = realtimeBroadcast.subscribe('NEW_EXPENSE', (data) => {
      const dataAg = String(data.agencia || '').trim().toUpperCase();
      if (dataAg === safeAgency || dataAg.includes(safeAgency) || safeAgency.includes(dataAg)) {
        clearMetricsCache();
        loadData(true);
      }
    });

    return () => {
      unsubConfirmed();
      unsubRejected();
      unsubDataChanged();
      unsubNewExpense();
    };
  }, [agencyName, loadData]);

  // 2. Heartbeat de refresco automático continuo cada 10 segundos
  useEffect(() => {
    if (!agencyName || !systemCycle?.desde) return;

    const intervalId = setInterval(() => {
      clearMetricsCache();
      loadData(false);
    }, 10000);

    return () => clearInterval(intervalId);
  }, [agencyName, systemCycle?.desde, loadData]);

  // 3. Suscripción Postgres Changes para actualizar métricas operativas
  useEffect(() => {
    if (!agencyName) return;
    const channel = supabase
      .channel(`realtime_homedashboard_${agencyName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cda_pagos_diarios' }, () => {
        clearMetricsCache();
        loadData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cda_pagos_bancarios' }, () => {
        clearMetricsCache();
        loadData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos_semana' }, () => {
        clearMetricsCache();
        loadData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cda_gastos_diarios' }, () => {
        clearMetricsCache();
        loadData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, () => {
        clearMetricsCache();
        loadData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'carga_actual' }, () => {
        clearMetricsCache();
        loadData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agencyName, loadData]);

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
      <div className={`${
        isLight
          ? 'bg-gradient-to-br from-white via-slate-50 to-emerald-50/30 border-slate-200/90 shadow-sm'
          : 'bg-gradient-to-br from-[#0B1325]/95 via-[#0D1B2A]/95 to-[#071217]/95 border-slate-800 shadow-2xl backdrop-blur-md'
      } border rounded-3xl p-6 relative overflow-hidden`}>
        <div className={`absolute top-0 right-0 w-96 h-96 ${isLight ? 'bg-emerald-500/10' : 'bg-emerald-500/5'} rounded-full blur-3xl pointer-events-none`} />

        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <h2 className={`text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <span>👋 ¡Hola, {user?.nombre || user?.usuario}!</span>
            </h2>
            <div className={`flex flex-wrap items-center gap-2 mt-1.5 text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              <span className={`font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Terminal de Cierre y Liquidación en Tiempo Real</span>
              {waNumber && (
                <>
                  <span>&bull;</span>
                  <a
                    href={`https://wa.me/${waNumber.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full border transition-colors ${
                      isLight
                        ? 'text-emerald-700 bg-emerald-100/70 border-emerald-300/60 hover:bg-emerald-200/70'
                        : 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                    }`}
                  >
                    <Phone className="w-3 h-3" />
                    Soporte: {waNumber}
                  </a>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2 text-right">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold border ${
                isLight
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-xs'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                <Unlock className="w-3.5 h-3.5" />
                🟢 CICLO OPERATIVO ACTIVO
              </span>

              <button
                onClick={() => loadData(true)}
                disabled={loading}
                title="Actualizar datos operativos"
                className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200 shadow-xs'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
              </button>
            </div>

            <div className={`text-[11px] mt-1 flex items-center justify-end gap-1.5 flex-wrap ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <Calendar className={`w-3.5 h-3.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
              <span>
                📅 Hoy: <strong className={`font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>{formatDate(todayStr)}</strong>
              </span>
              <span className={isLight ? 'text-slate-300' : 'text-slate-600'}>|</span>
              <span>
                Ciclo Admin {cycleSemana}: <strong className={`font-mono ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{cycleRangeStr}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Estado de Saldo / Deuda por Moneda Asignada */}
      <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0D1B22] border-slate-800 shadow-xl'} border rounded-3xl p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Estado de Saldo / Deuda por Moneda Asignada
            </h3>
            <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
              Monedas asignadas a esta agencia por el administrador
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignedCurrencies.map((curr) => {
            const m = metricsByCurrency[curr];
            const bal = m?.saldoActual ?? 0;
            const isSelected = selectedCurrency === curr;
            const isDebt = bal > 0.005;
            const isFavor = bal < -0.005;

            return (
              <div
                key={curr}
                onClick={() => setSelectedCurrency(curr)}
                className={`border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all ${
                  isLight
                    ? isSelected 
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-500/30' 
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
                    : isSelected 
                      ? 'border-emerald-500/50 bg-[#0a1820] shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/40' 
                      : 'bg-[#071217] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className={`text-xs font-semibold mb-1 flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-500 animate-pulse' : isLight ? 'bg-slate-300' : 'bg-slate-600'}`} />
                    Moneda: <strong className={isLight ? 'text-slate-900' : 'text-white'}>{curr}</strong>
                  </div>
                  <div className={`text-2xl font-black font-mono tracking-tight ${
                    isDebt 
                      ? (isLight ? 'text-rose-600' : 'text-rose-400') 
                      : isFavor 
                      ? (isLight ? 'text-emerald-600' : 'text-emerald-400') 
                      : (isLight ? 'text-slate-800' : 'text-slate-200')
                  }`}>
                    {loading ? 'Calculando...' : isFavor ? `+${formatMoney(Math.abs(bal), curr)}` : formatMoney(Math.abs(bal), curr)}
                  </div>
                  <div className={`text-[10px] mt-1 flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isDebt ? 'bg-rose-500' : isFavor ? 'bg-emerald-500' : isLight ? 'bg-slate-400' : 'bg-slate-500'
                    }`} />
                    {isDebt 
                      ? 'Deuda pendiente' 
                      : isFavor 
                      ? ((user?.rol === 'supervisor' || user?.rol === 'admin') ? 'Saldo a favor / en caja' : 'Saldo a favor') 
                      : 'Al día / Solvente'}
                  </div>
                </div>
                <div className={`p-3 rounded-xl border transition-all ${
                  isDebt 
                    ? (isLight ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-rose-500/10 text-rose-400 border-rose-500/20') 
                    : isFavor 
                    ? (isLight ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') 
                    : (isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-800/80 text-slate-400 border-slate-700')
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
        <div className={`flex items-center gap-2 border-b pb-2 overflow-x-auto ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          {assignedCurrencies.map((curr) => {
            const isSelected = selectedCurrency === curr;
            return (
              <button
                key={curr}
                onClick={() => setSelectedCurrency(curr)}
                className={`px-5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? isLight
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-sm'
                      : 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                    : isLight
                      ? 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 shadow-xs'
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
          <h3 className={`text-sm sm:text-base font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            <span className={`p-1.5 rounded-lg border ${isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
              📊
            </span>
            <span>Resumen Operativo ({selectedCurrency}) - Ciclo Admin: {cycleRangeStr}</span>
          </h3>
          {activeMetrics && (
            <span className={`text-xs font-mono hidden sm:inline-block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Moneda: <strong className={isLight ? 'text-emerald-700' : 'text-emerald-400'}>{selectedCurrency}</strong>
            </span>
          )}
        </div>

        {/* 4 Tarjetas de Métricas Operativas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Ventas */}
          <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300' : 'bg-[#0D1B22] border-slate-800/80 shadow-md hover:border-slate-700'} border rounded-2xl p-4 relative overflow-hidden group transition-all`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Ventas</span>
              <div className={`p-2 rounded-xl border ${isLight ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
              {loading ? '...' : formatMoney(activeMetrics?.ventas ?? 0, selectedCurrency)}
            </div>
            <div className={`text-[10px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Total ventas del ciclo</div>
          </div>

          {/* Comision */}
          <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300' : 'bg-[#0D1B22] border-slate-800/80 shadow-md hover:border-slate-700'} border rounded-2xl p-4 relative overflow-hidden group transition-all`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Comisión</span>
              <div className={`p-2 rounded-xl border ${isLight ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}>
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
              {loading ? '...' : formatMoney(activeMetrics?.comisiones ?? 0, selectedCurrency)}
            </div>
            <div className={`text-[10px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Retención de comisiones</div>
          </div>

          {/* Premios */}
          <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300' : 'bg-[#0D1B22] border-slate-800/80 shadow-md hover:border-slate-700'} border rounded-2xl p-4 relative overflow-hidden group transition-all`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Premios</span>
              <div className={`p-2 rounded-xl border ${isLight ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${isLight ? 'text-purple-700' : 'text-purple-400'}`}>
              {loading ? '...' : formatMoney(activeMetrics?.premios ?? 0, selectedCurrency)}
            </div>
            <div className={`text-[10px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Premios validados / en lotes</div>
          </div>

          {/* Saldo / Resultado Operativo */}
          <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300' : 'bg-[#0D1B22] border-slate-800/80 shadow-md hover:border-slate-700'} border rounded-2xl p-4 relative overflow-hidden group transition-all`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Saldo</span>
              <div className={`p-2 rounded-xl border ${isLight ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                <Calculator className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${
              (activeMetrics?.resultadoOp ?? 0) >= 0 
                ? (isLight ? 'text-emerald-700' : 'text-emerald-400') 
                : (isLight ? 'text-rose-700' : 'text-rose-400')
            }`}>
              {loading ? '...' : formatMoney(activeMetrics?.resultadoOp ?? 0, selectedCurrency)}
            </div>
            <div className={`text-[10px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Ventas - Com. - Premios</div>
          </div>
        </div>

        {/* 5. Barra de Balance Acumulado con la Fórmula Matemática */}
        {activeMetrics && (
          <div className={`${
            isLight
              ? 'bg-slate-50/90 border-slate-200 shadow-xs'
              : 'bg-gradient-to-r from-[#0D1B22] via-[#0A161C] to-[#0D1B22] border-slate-800 shadow-lg'
          } border rounded-2xl p-4 text-xs`}>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-center leading-relaxed font-mono">
              <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Saldo Anterior ({selectedCurrency}):</span>
              <strong className={isLight ? 'text-slate-900' : 'text-white'}>{formatMoney(activeMetrics.saldoAnterior, selectedCurrency)}</strong>

              <span className={`${isLight ? 'text-slate-400' : 'text-slate-600'} font-bold px-0.5`}>+</span>

              <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Resultado Hoy / Periodo:</span>
              <strong className={activeMetrics.resultadoOp >= 0 ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : (isLight ? 'text-rose-700' : 'text-rose-400')}>
                {formatMoney(activeMetrics.resultadoOp, selectedCurrency)}
              </strong>

              <span className={`${isLight ? 'text-slate-400' : 'text-slate-600'} font-bold px-0.5`}>-</span>

              <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Gastos:</span>
              <strong className={isLight ? 'text-slate-900' : 'text-white'}>{formatMoney(activeMetrics.gastos, selectedCurrency)}</strong>

              <span className={`${isLight ? 'text-slate-400' : 'text-slate-600'} font-bold px-0.5`}>-</span>

              <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Pagos Bancos:</span>
              <strong className={isLight ? 'text-slate-900' : 'text-white'}>{formatMoney(activeMetrics.pagoBanco, selectedCurrency)}</strong>

              <span className={`${isLight ? 'text-slate-400' : 'text-slate-600'} font-bold px-0.5`}>-</span>

              <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Pago Efectivo:</span>
              <strong className={isLight ? 'text-slate-900' : 'text-white'}>{formatMoney(activeMetrics.pagoEfectivo, selectedCurrency)}</strong>

              <span className={`${isLight ? 'text-slate-400' : 'text-slate-600'} font-bold px-0.5`}>+</span>

              <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Pago Pérdidas / Premios:</span>
              <strong className={isLight ? 'text-emerald-700' : 'text-emerald-400'}>{formatMoney(activeMetrics.pagoPremios, selectedCurrency)}</strong>

              <span className={`${isLight ? 'text-slate-400' : 'text-slate-600'} font-bold px-0.5`}>=</span>

              <span className={`${isLight ? 'text-slate-800' : 'text-slate-300'} font-bold`}>Saldo Actual ({selectedCurrency}):</span>
              <strong className={`text-sm sm:text-base px-2.5 py-0.5 rounded-lg border font-mono ${
                activeMetrics.saldoActual > 0.005
                  ? (isLight ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-rose-500/10 text-rose-400 border-rose-500/30')
                  : activeMetrics.saldoActual < -0.005
                  ? (isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30')
                  : (isLight ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-slate-700/20 text-slate-300 border-slate-600')
              }`}>
                {activeMetrics.saldoActual < -0.005 
                  ? `+${formatMoney(Math.abs(activeMetrics.saldoActual), selectedCurrency)} (A favor)` 
                  : activeMetrics.saldoActual > 0.005 
                  ? `${formatMoney(activeMetrics.saldoActual, selectedCurrency)} (Deuda)` 
                  : formatMoney(0, selectedCurrency)}
              </strong>
            </div>
          </div>
        )}

        {/* 6. TABLAS DE ACTIVIDAD DE LA MONEDA */}
        <div className="space-y-6 pt-2">
          {/* TABLA 1: Ventas del Ciclo */}
          <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0D1B22] border-slate-800 shadow-xl'} border rounded-3xl p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <span>📋</span>
                <span>Ventas del Ciclo - {selectedCurrency} ({cycleRangeStr})</span>
              </h4>
            </div>

            {(!activeMetrics || activeMetrics.ventasDetalle.length === 0) ? (
              <div className={`border rounded-2xl p-6 text-center text-xs ${isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#071217] border-slate-800/80 text-slate-400'}`}>
                ℹ️ Sin registros de ventas cargados en {selectedCurrency} para este ciclo.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`border-b text-[10px] tracking-wider font-bold uppercase ${isLight ? 'border-slate-200 text-slate-500 bg-slate-50/50' : 'border-slate-800 text-slate-400'}`}>
                      <th className="py-2.5 px-3">Sistema</th>
                      <th className="py-2.5 px-3">Moneda</th>
                      <th className="py-2.5 px-3 text-right">Venta</th>
                      <th className="py-2.5 px-3 text-right">Comisión</th>
                      <th className="py-2.5 px-3 text-right">Premios</th>
                      <th className="py-2.5 px-3 text-right">Neto</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-mono ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
                    {activeMetrics.ventasDetalle.map((row, idx) => (
                      <tr key={idx} className={`transition-colors ${isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-800/30'}`}>
                        <td className={`py-2.5 px-3 font-sans font-bold flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {row.sistema}
                        </td>
                        <td className={`py-2.5 px-3 font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{row.moneda}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                          {formatMoney(row.venta, selectedCurrency)}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                          {formatMoney(row.comision, selectedCurrency)}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${isLight ? 'text-purple-700' : 'text-purple-400'}`}>
                          {formatMoney(row.premios, selectedCurrency)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${
                          row.neto >= 0 ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : (isLight ? 'text-rose-700' : 'text-rose-400')
                        }`}>
                          {formatMoney(row.neto, selectedCurrency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={`border-t-2 font-mono font-bold text-xs ${isLight ? 'border-slate-300 bg-slate-100/90 text-slate-900' : 'border-slate-700 bg-slate-900/50 text-white'}`}>
                      <td className="py-2.5 px-3 font-sans">TOTAL</td>
                      <td className="py-2.5 px-3 font-sans">{selectedCurrency}</td>
                      <td className={`py-2.5 px-3 text-right ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                        {formatMoney(activeMetrics.ventas, selectedCurrency)}
                      </td>
                      <td className={`py-2.5 px-3 text-right ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                        {formatMoney(activeMetrics.comisiones, selectedCurrency)}
                      </td>
                      <td className={`py-2.5 px-3 text-right ${isLight ? 'text-purple-700' : 'text-purple-400'}`}>
                        {formatMoney(activeMetrics.premios, selectedCurrency)}
                      </td>
                      <td className={`py-2.5 px-3 text-right ${
                        activeMetrics.resultadoOp >= 0 ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : (isLight ? 'text-rose-700' : 'text-rose-400')
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
            <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0D1B22] border-slate-800 shadow-xl'} border rounded-3xl p-5`}>
              <div className="flex items-center justify-between mb-4">
                <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <span>💸</span>
                  <span>Gastos del Ciclo - {selectedCurrency}</span>
                </h4>
                <span className={`text-xs font-mono font-bold ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                  Total: {formatMoney(activeMetrics.gastos, selectedCurrency)}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`border-b text-[10px] tracking-wider font-bold uppercase ${isLight ? 'border-slate-200 text-slate-500 bg-slate-50/50' : 'border-slate-800 text-slate-400'}`}>
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
                  <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
                    {activeMetrics.gastosDetalle.map((g, idx) => (
                      <tr key={idx} className={`transition-colors ${isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-800/30'}`}>
                        <td className={`py-2.5 px-3 font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{formatDate(g.fecha)}</td>
                        <td className={`py-2.5 px-3 font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{g.agencia}</td>
                        <td className={`py-2.5 px-3 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{g.cajero}</td>
                        <td className={`py-2.5 px-3 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{g.concepto}</td>
                        <td className={`py-2.5 px-3 font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{g.moneda}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                          {formatMoney(g.monto, selectedCurrency)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderStatusBadge(g.confirmado, g.rechazado)}
                        </td>
                        <td className={`py-2.5 px-3 text-[11px] ${isLight ? 'text-rose-700' : 'text-rose-400/80'}`}>
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
          <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0D1B22] border-slate-800 shadow-xl'} border rounded-3xl p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <span>🏦</span>
                <span>Pagos a Operadora (Bancos / Efectivo) - {selectedCurrency}</span>
              </h4>
              {activeMetrics && (
                <span className={`text-xs font-mono font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                  Total: {formatMoney(activeMetrics.pagoBanco + activeMetrics.pagoEfectivo, selectedCurrency)}
                </span>
              )}
            </div>

            {(!activeMetrics || activeMetrics.pagosOrdinariosDetalle.length === 0) ? (
              <div className={`border rounded-2xl p-6 text-center text-xs ${isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#071217] border-slate-800/80 text-slate-400'}`}>
                ℹ️ Sin pagos ordinarios a la operadora en {selectedCurrency}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`border-b text-[10px] tracking-wider font-bold uppercase ${isLight ? 'border-slate-200 text-slate-500 bg-slate-50/50' : 'border-slate-800 text-slate-400'}`}>
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
                  <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
                    {activeMetrics.pagosOrdinariosDetalle.map((p, idx) => (
                      <tr key={idx} className={`transition-colors ${isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-800/30'}`}>
                        <td className={`py-2.5 px-3 font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{formatDate(p.fecha)}</td>
                        <td className={`py-2.5 px-3 font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{p.agencia}</td>
                        <td className={`py-2.5 px-3 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{p.cajero}</td>
                        <td className={`py-2.5 px-3 font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{p.tipo_pago}</td>
                        <td className={`py-2.5 px-3 font-mono text-[11px] max-w-[200px] truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`} title={p.referencia}>
                          {p.referencia}
                        </td>
                        <td className={`py-2.5 px-3 font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{p.moneda}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                          {formatMoney(p.monto, selectedCurrency)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderStatusBadge(p.confirmado, p.rechazado)}
                        </td>
                        <td className={`py-2.5 px-3 text-[11px] ${isLight ? 'text-rose-700' : 'text-rose-400/80'}`}>
                          {p.motivo_rechazo || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={`border-t-2 font-mono font-bold text-xs ${isLight ? 'border-slate-300 bg-slate-100/90 text-slate-900' : 'border-slate-700 bg-slate-900/50 text-white'}`}>
                      <td colSpan={6} className="py-2.5 px-3 font-sans">TOTAL PAGOS ORDINARIOS</td>
                      <td className={`py-2.5 px-3 text-right ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
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
          <div className={`${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0D1B22] border-slate-800 shadow-xl'} border rounded-3xl p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <span>🏆</span>
                <span>Pagos de Premios / Reposición de Pérdidas - {selectedCurrency}</span>
              </h4>
              {activeMetrics && activeMetrics.pagosPremiosDetalle.length > 0 && (
                <span className={`text-xs font-mono font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  Total: {formatMoney(activeMetrics.pagoPremios, selectedCurrency)}
                </span>
              )}
            </div>

            {(!activeMetrics || activeMetrics.pagosPremiosDetalle.length === 0) ? (
              <div className={`border rounded-2xl p-6 text-center text-xs ${isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#071217] border-slate-800/80 text-slate-500'}`}>
                ℹ️ No hay reposiciones ni pagos de premios registrados en {selectedCurrency} para este ciclo.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`border-b text-[10px] tracking-wider font-bold uppercase ${isLight ? 'border-slate-200 text-slate-500 bg-slate-50/50' : 'border-slate-800 text-slate-400'}`}>
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
                  <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
                    {activeMetrics.pagosPremiosDetalle.map((p, idx) => (
                      <tr key={idx} className={`transition-colors ${isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-800/30'}`}>
                        <td className={`py-2.5 px-3 font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{formatDate(p.fecha)}</td>
                        <td className={`py-2.5 px-3 font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{p.agencia}</td>
                        <td className={`py-2.5 px-3 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{p.cajero}</td>
                        <td className={`py-2.5 px-3 font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{p.tipo_pago}</td>
                        <td className={`py-2.5 px-3 font-mono text-[11px] max-w-[200px] truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`} title={p.referencia}>
                          {p.referencia}
                        </td>
                        <td className={`py-2.5 px-3 font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{p.moneda}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                          {formatMoney(p.monto, selectedCurrency)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderStatusBadge(p.confirmado, p.rechazado)}
                        </td>
                        <td className={`py-2.5 px-3 text-[11px] ${isLight ? 'text-rose-700' : 'text-rose-400/80'}`}>
                          {p.motivo_rechazo || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={`border-t-2 font-mono font-bold text-xs ${isLight ? 'border-slate-300 bg-slate-100/90 text-slate-900' : 'border-slate-700 bg-slate-900/50 text-white'}`}>
                      <td colSpan={6} className="py-2.5 px-3 font-sans">TOTAL REPOSICIÓN / PREMIOS</td>
                      <td className={`py-2.5 px-3 text-right ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
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
