import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { DailyExpense } from '../../types';
import { formatCurrency, formatDate, getTodayDateString, normalizarMoneda } from '../../utils/formatters';
import { clearMetricsCache } from '../../utils/operationalDashboard';
import {
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Receipt,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { realtimeBroadcast } from '../../utils/realtimeBroadcast';

const COMMON_CONCEPTS = [
  'SUELDO',
  'PAGO DE INTERNET',
  'PAPELERÍA',
  'ROLLOS TÉRMICOS',
  'CALCULADORA',
  'MANTENIMIENTO',
  'VARIOS',
  'TRANSPORTE',
  'ALIMENTACIÓN / REFRIGERIOS',
  'SERVICIOS PÚBLICOS',
  'COMISIÓN TRANSFERENCIA',
];

export const ExpensesTab: React.FC = () => {
  const { user, agency, systemCycle, assignedCurrencies, isDayClosed } = useAuth();
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [loading, setLoading] = useState(false);

  // Ciclo operativo
  const todayStr = getTodayDateString();
  const cycleDesde = systemCycle?.desde || todayStr;
  const cycleHasta = systemCycle?.hasta || todayStr;
  const cycleSemana = systemCycle?.semana ? `Semana ${systemCycle.semana}` : 'Ciclo Actual';

  // Filtro de visualización (por defecto: gastos del ciclo)
  const [filterMode, setFilterMode] = useState<'ciclo' | 'hoy' | 'todos' | 'fecha'>('ciclo');
  const [customFecha, setCustomFecha] = useState(todayStr);

  // Formulario de nuevo gasto
  const defaultExpenseDate = (cycleHasta && cycleHasta <= todayStr) ? cycleHasta : todayStr;
  const [fechaGasto, setFechaGasto] = useState(defaultExpenseDate);
  const [concepto, setConcepto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [monto, setMonto] = useState<number | ''>('');
  const [moneda, setMoneda] = useState(assignedCurrencies[0] || 'BS');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const agencyName = agency?.nombre_agencia || '';
  const isSupervisor = user?.rol === 'supervisor' || user?.rol === 'admin';

  // Sincronizar moneda con monedas asignadas si cambia
  useEffect(() => {
    if (assignedCurrencies.length > 0 && !assignedCurrencies.includes(moneda)) {
      setMoneda(assignedCurrencies[0]);
    }
  }, [assignedCurrencies, moneda]);

  // Actualizar fecha por defecto si cambia el ciclo
  useEffect(() => {
    if (cycleHasta) {
      setFechaGasto((cycleHasta <= todayStr) ? cycleHasta : todayStr);
    }
  }, [cycleHasta, todayStr]);

  // Consulta de gastos unificada (cda_gastos_diarios + gastos) para la agencia
  const fetchExpenses = useCallback(async () => {
    if (!agencyName) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Consultar cda_gastos_diarios
      let qDiarios = supabase
        .from('cda_gastos_diarios')
        .select('*')
        .or(`agencia.ilike.${agencyName},nombre_agency.ilike.${agencyName}`);

      // 2. Consultar gastos (CMS)
      let qGastos = supabase
        .from('gastos')
        .select('*')
        .or(`agencia.ilike.${agencyName},nombre_agency.ilike.${agencyName}`);

      // Aplicar filtros de fecha según el modo
      if (filterMode === 'ciclo') {
        const fMax = cycleHasta > todayStr ? cycleHasta : todayStr;
        qDiarios = qDiarios.gte('fecha', cycleDesde).lte('fecha', fMax);
        qGastos = qGastos.gte('fecha', cycleDesde).lte('fecha', fMax);
      } else if (filterMode === 'hoy') {
        qDiarios = qDiarios.eq('fecha', todayStr);
        qGastos = qGastos.eq('fecha', todayStr);
      } else if (filterMode === 'fecha') {
        qDiarios = qDiarios.eq('fecha', customFecha);
        qGastos = qGastos.eq('fecha', customFecha);
      }

      const [resDiarios, resGastos] = await Promise.all([
        qDiarios.order('fecha', { ascending: false }).order('id', { ascending: false }),
        qGastos.order('fecha', { ascending: false }).order('id', { ascending: false }),
      ]);

      const listDiarios = resDiarios.data || [];
      const listGastos = resGastos.data || [];

      const unified: DailyExpense[] = [];
      const seenKeys = new Set<string>();

      // Procesar gastos de cda_gastos_diarios
      listDiarios.forEach((g: any) => {
        let rawConcepto = String(g.concepto || g.descripcion || 'Gasto Operativo').trim();
        let refStr = '';
        const matchRef = rawConcepto.match(/\[REF:\s*([^\]]+)\]/i);
        if (matchRef) {
          refStr = matchRef[1].trim();
          rawConcepto = rawConcepto.replace(/\[REF:\s*[^\]]+\]/i, '').trim();
        }

        const fStr = String(g.fecha || '').slice(0, 10);
        const mto = Number(g.monto || 0);
        const mCode = normalizarMoneda(g.moneda);
        const key = `cd_${g.id}`;
        seenKeys.add(key);

        unified.push({
          id: g.id,
          fecha: fStr,
          agencia: g.agencia || g.nombre_agency || agencyName,
          nombre_agency: g.nombre_agency || agencyName,
          cajero_id: g.cajero_id,
          nombre_cajero: g.supervisor_nombre || (g.cajero_id ? 'Cajero' : 'Taquilla'),
          concepto: rawConcepto,
          referencia: refStr || 'N/A',
          monto: mto,
          moneda: mCode,
          confirmado: Boolean(g.confirmado || g.confirmado_supervisor),
          rechazado: Boolean(g.rechazado),
          motivo_rechazo: g.motivo_rechazo,
          created_at: g.created_at,
        });
      });

      // Incorporar gastos de la tabla 'gastos' si no están duplicados
      listGastos.forEach((g: any) => {
        let rawConcepto = String(g.concepto || g.descripcion || 'Gasto General').trim();
        let refStr = '';
        const matchRef = rawConcepto.match(/\[REF:\s*([^\]]+)\]/i);
        if (matchRef) {
          refStr = matchRef[1].trim();
          rawConcepto = rawConcepto.replace(/\[REF:\s*[^\]]+\]/i, '').trim();
        }

        const fStr = String(g.fecha || '').slice(0, 10);
        const mto = Number(g.monto || 0);
        const mCode = normalizarMoneda(g.moneda);

        const yaExiste = unified.some(
          (u) => u.fecha === fStr && Math.abs(u.monto - mto) < 0.01 && u.moneda === mCode
        );

        if (!yaExiste && mto > 0) {
          unified.push({
            id: g.id,
            fecha: fStr,
            agencia: g.agencia || g.nombre_agency || agencyName,
            nombre_agency: g.nombre_agency || agencyName,
            cajero_id: g.cajero_id,
            nombre_cajero: 'Administración',
            concepto: rawConcepto,
            referencia: refStr || 'CMS',
            monto: mto,
            moneda: mCode,
            confirmado: Boolean(g.confirmado),
            rechazado: Boolean(g.rechazado),
            motivo_rechazo: g.motivo_rechazo,
            created_at: g.created_at,
          });
        }
      });

      // Ordenar por fecha descendente
      unified.sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : (b.id || 0) - (a.id || 0)));

      setExpenses(unified);
    } catch (err: unknown) {
      console.error('Error fetching expenses:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar los gastos');
    } finally {
      setLoading(false);
    }
  }, [agencyName, filterMode, cycleDesde, cycleHasta, todayStr, customFecha]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Suscripción Realtime para actualizar la tabla inmediatamente ante confirmaciones de supervisor/admin
  useEffect(() => {
    const channel = supabase
      .channel('realtime_taquilla_expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cda_gastos_diarios' }, () => {
        fetchExpenses();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, () => {
        fetchExpenses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchExpenses]);

  // Lista de sugerencias de conceptos dinámicos (comunes + los ya usados por la agencia)
  const suggestedConcepts = useMemo(() => {
    const setConceptos = new Set<string>(COMMON_CONCEPTS);
    expenses.forEach((e) => {
      if (e.concepto && e.concepto.trim()) {
        setConceptos.add(e.concepto.trim().toUpperCase());
      }
    });
    return Array.from(setConceptos);
  }, [expenses]);

  // Crear nuevo gasto operativo
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMonto = typeof monto === 'number' ? monto : parseFloat(String(monto)) || 0;

    if (!concepto.trim()) {
      setErrorMsg('Por favor ingrese el concepto o descripción del gasto.');
      return;
    }
    if (parsedMonto <= 0) {
      setErrorMsg('El monto del gasto debe ser mayor a 0.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const cleanConcepto = concepto.trim().toUpperCase();
      const cleanRef = referencia.trim().toUpperCase();
      const fullDesc = cleanRef ? `${cleanConcepto} [REF: ${cleanRef}]` : cleanConcepto;

      const newExpense = {
        fecha: fechaGasto,
        agencia: agencyName,
        nombre_agency: agencyName,
        cajero_id: user?.id ? String(user.id) : null,
        user_id: user?.user_id || user?.id,
        concepto: cleanConcepto,
        descripcion: fullDesc,
        monto: parsedMonto,
        moneda: normalizarMoneda(moneda),
        confirmado: isSupervisor, // Confirmación directa si es supervisor, pendiente si es cajero
        rechazado: false,
      };

      const { error } = await supabase.table('cda_gastos_diarios').insert(newExpense);
      if (error) throw error;

      await realtimeBroadcast.broadcast('NEW_EXPENSE', {
        tabla: 'cda_gastos_diarios',
        agencia: agencyName,
        monto: parsedMonto,
        moneda: normalizarMoneda(moneda),
        concepto: cleanConcepto,
        referencia: cleanRef || 'N/A',
        cajero_id: user?.id ? String(user.id) : undefined,
        created_at: new Date().toISOString(),
      });

      confetti({ particleCount: 40, spread: 60 });
      setSuccessMsg(`¡Gasto de ${cleanConcepto} por ${formatCurrency(parsedMonto, moneda)} registrado con éxito!`);

      clearMetricsCache();
      // Limpiar formulario
      setConcepto('');
      setReferencia('');
      setMonto('');
      await fetchExpenses();
    } catch (err: unknown) {
      console.error('Error adding expense:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar gasto.');
    } finally {
      setSubmitting(false);
    }
  };

  // Eliminar gasto
  const handleDeleteExpense = async (id?: number) => {
    if (!id || !window.confirm('¿Está seguro de eliminar este gasto operativo?')) return;
    try {
      const { error } = await supabase.table('cda_gastos_diarios').delete().eq('id', id);
      if (error) throw error;
      clearMetricsCache();
      setExpenses((prev) => prev.filter((g) => g.id !== id));
      setSuccessMsg('Gasto eliminado exitosamente.');
    } catch (err) {
      console.error('Error deleting expense:', err);
      alert('No se pudo eliminar el gasto.');
    }
  };

  // Totales acumulados del ciclo por moneda asignada (solo gastos válidos no rechazados)
  const totalsByCurrency = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    assignedCurrencies.forEach((curr) => {
      map[curr] = { total: 0, count: 0 };
    });

    expenses.forEach((g) => {
      if (g.rechazado) return;
      const mNorm = normalizarMoneda(g.moneda);
      if (!map[mNorm]) {
        map[mNorm] = { total: 0, count: 0 };
      }
      map[mNorm].total += Number(g.monto || 0);
      map[mNorm].count += 1;
    });

    return map;
  }, [expenses, assignedCurrencies]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Barra de Control y Ciclo Operativo */}
      <div className="bg-gradient-to-br from-[#0D1B22] via-[#0A161C] to-[#0D1B22] p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 text-xs font-bold font-mono">
            <Calendar className="w-4 h-4" />
            <span>Ciclo: {formatDate(cycleDesde)} al {formatDate(cycleHasta)} ({cycleSemana})</span>
          </div>

          {/* Filtros de Vista */}
          <div className="flex items-center bg-[#071217] p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilterMode('ciclo')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterMode === 'ciclo'
                  ? 'bg-emerald-500 text-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Gastos del Ciclo
            </button>
            <button
              onClick={() => setFilterMode('hoy')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterMode === 'hoy'
                  ? 'bg-emerald-500 text-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Solo Hoy
            </button>
            <button
              onClick={() => setFilterMode('todos')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterMode === 'todos'
                  ? 'bg-emerald-500 text-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterMode('fecha')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterMode === 'fecha'
                  ? 'bg-emerald-500 text-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Por Fecha
            </button>
          </div>

          {filterMode === 'fecha' && (
            <input
              type="date"
              value={customFecha}
              onChange={(e) => setCustomFecha(e.target.value)}
              className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          )}
        </div>

        <button
          onClick={fetchExpenses}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer border border-slate-700 shadow"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* 2. Tarjetas de Resumen KPI por Moneda para el Ciclo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignedCurrencies.map((curr) => {
          const item = totalsByCurrency[curr] || { total: 0, count: 0 };
          return (
            <div
              key={curr}
              className="bg-gradient-to-br from-[#0D1B22] to-[#0A161C] border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-lg relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
              <div>
                <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                  <span>Total Gastos ({curr})</span>
                  <span className="text-[10px] text-slate-500 font-mono">• {filterMode === 'ciclo' ? cycleSemana : filterMode.toUpperCase()}</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-400 font-mono">
                  {formatCurrency(item.total, curr)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {item.count} {item.count === 1 ? 'movimiento registrado' : 'movimientos registrados'}
                </div>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-400 border border-rose-500/20 shadow-inner">
                <Receipt className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Formulario: Registrar Nuevo Gasto Operativo (Concepto libre, sin categorías predeterminadas) */}
      {(!isDayClosed || isSupervisor) ? (
        <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Registrar Gasto Operativo de la Agencia</span>
            </h3>
            <span className="text-xs text-slate-400">
              Agencia: <strong className="text-white">{agencyName}</strong>
            </span>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateExpense} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Concepto / Descripción (Libre con sugerencias datalist) */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Concepto / Descripción del Gasto *</span>
                  <span className="text-[10px] text-emerald-400 font-normal">Libre / Sin predeterminados</span>
                </label>
                <input
                  type="text"
                  required
                  list="conceptos-sugeridos"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  placeholder="Ej: Sueldo, Pago de internet, Papelería, Mantenimiento..."
                  className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors uppercase font-medium placeholder:normal-case placeholder:text-slate-500"
                />
                <datalist id="conceptos-sugeridos">
                  {suggestedConcepts.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              {/* Referencia / Comprobante */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  N° Comprobante / Referencia (Opcional)
                </label>
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ej: FACTURA 4920, RECIBO"
                  className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors uppercase font-mono placeholder:normal-case placeholder:text-slate-500"
                />
              </div>

              {/* Fecha del Gasto */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Fecha del Gasto *
                </label>
                <input
                  type="date"
                  required
                  value={fechaGasto}
                  onChange={(e) => setFechaGasto(e.target.value)}
                  className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>
            </div>

            {/* Monto, Moneda y Botón de Registro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Monto del Gasto *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={monto}
                  onChange={(e) => setMonto(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono text-base font-bold placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Moneda *
                </label>
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value)}
                  className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                >
                  {assignedCurrencies.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-2.5 px-5 rounded-xl text-xs sm:text-sm transition-all shadow-lg hover:shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{submitting ? 'Registrando Gasto...' : 'Registrar Gasto Operativo'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>🔒 Jornada de caja cerrada para hoy. No se pueden registrar nuevos gastos diarios hasta la reapertura.</span>
        </div>
      )}

      {/* 4. Tabla de Gastos Registrados */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-wrap justify-between items-center gap-2 bg-slate-900/30">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Gastos Registrados ({expenses.length})
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              • {filterMode === 'ciclo' ? `Semana ${systemCycle?.semana || 'Actual'}` : filterMode.toUpperCase()}
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            Mostrando todos los gastos operativos registrados para la agencia
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/60 text-slate-400 font-mono">
                <th className="py-3 px-4 font-semibold">Fecha</th>
                <th className="py-3 px-4 font-semibold">Concepto / Descripción</th>
                <th className="py-3 px-4 font-semibold">Referencia</th>
                <th className="py-3 px-4 font-semibold">Registrado Por</th>
                <th className="py-3 px-4 font-semibold text-right">Monto</th>
                <th className="py-3 px-4 font-semibold text-center">Estado</th>
                <th className="py-3 px-4 font-semibold text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    <Receipt className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                    <p className="font-medium">No hay gastos operativos registrados para este periodo.</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Los gastos que registre aquí se descontarán automáticamente del balance del ciclo.
                    </p>
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => {
                  return (
                    <tr key={`${expense.id}_${expense.fecha}`} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                        {formatDate(expense.fecha)}
                      </td>
                      <td className="py-3 px-4 font-bold text-white max-w-xs break-words">
                        {expense.concepto}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {expense.referencia || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {expense.nombre_cajero || 'Taquilla'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
                        {formatCurrency(expense.monto, expense.moneda)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {expense.rechazado ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30" title={expense.motivo_rechazo || 'Rechazado por administración'}>
                            <XCircle className="w-3 h-3" />
                            Rechazado
                          </span>
                        ) : expense.confirmado ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" title="Gasto formalmente confirmado por el Administrador en Operadora CMS">
                            <CheckCircle2 className="w-3 h-3" />
                            Confirmado Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30" title="Pendiente de aprobación por el Administrador en Operadora CMS">
                            <Clock className="w-3 h-3" />
                            Pendiente Admin
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {(!expense.confirmado || isSupervisor) && expense.id ? (
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Eliminar gasto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-slate-600 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
