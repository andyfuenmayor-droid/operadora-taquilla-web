import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { DailySale } from '../../types';
import { formatCurrency, getTodayDateString } from '../../utils/formatters';
import { Plus, Trash2, RefreshCw, AlertCircle, DollarSign, TrendingUp, Award, MinusCircle } from 'lucide-react';

export const DailySalesTab: React.FC = () => {
  const { user, agency, assignedSystems, assignedCurrencies, isDayClosed } = useAuth();
  const [sales, setSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState(getTodayDateString());

  // Form State
  const [sistema, setSistema] = useState(assignedSystems[0] || 'BETM3');
  const [moneda, setMoneda] = useState(assignedCurrencies[0] || 'BS');
  const [montoVentas, setMontoVentas] = useState<number | ''>('');
  const [comision, setComision] = useState<number | ''>('');
  const [montoPremios, setMontoPremios] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const agencyName = agency?.nombre_agencia || '';
  const isSupervisor = user?.rol === 'supervisor' || user?.rol === 'admin';

  useEffect(() => {
    if (assignedSystems.length > 0 && !assignedSystems.includes(sistema)) {
      setSistema(assignedSystems[0]);
    }
    if (assignedCurrencies.length > 0 && !assignedCurrencies.includes(moneda)) {
      setMoneda(assignedCurrencies[0]);
    }
  }, [assignedSystems, assignedCurrencies, sistema, moneda]);

  const fetchSales = useCallback(async () => {
    if (!agencyName) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .table('cda_reportes_diarios')
        .select('*')
        .eq('fecha', fecha)
        .ilike('agencia', agencyName)
        .order('id', { ascending: false });

      if (error) throw error;
      setSales(data || []);
    } catch (err: unknown) {
      console.error('Error fetching sales:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  }, [agencyName, fecha]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const ventas = typeof montoVentas === 'number' ? montoVentas : 0;
    const comis = typeof comision === 'number' ? comision : 0;
    const premios = typeof montoPremios === 'number' ? montoPremios : 0;

    if (ventas <= 0) {
      setErrorMsg('El monto de ventas debe ser mayor a 0');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const newRecord = {
        fecha,
        agencia: agencyName,
        nombre_agency: agencyName,
        cajero_id: user?.id,
        nombre_cajero: user?.nombre || user?.usuario,
        user_id: user?.user_id || user?.id,
        sistema,
        monto_venta: ventas,
        monto_ventas: ventas,
        comision: comis,
        monto_anulaciones: comis,
        monto_premios: premios,
        neto: ventas - comis - premios,
        monto_neto: ventas - comis - premios,
        moneda,
        cerrado: false,
      };

      const { error } = await supabase.table('cda_reportes_diarios').insert(newRecord);
      if (error) throw error;

      setMontoVentas('');
      setComision('');
      setMontoPremios('');
      fetchSales();
    } catch (err: unknown) {
      console.error('Error creating sale record:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar venta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSale = async (id?: number) => {
    if (!id || !window.confirm('¿Está seguro de eliminar este registro de venta?')) return;
    try {
      const { error } = await supabase.table('cda_reportes_diarios').delete().eq('id', id);
      if (error) throw error;
      setSales((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Error deleting sale:', err);
      alert('No se pudo eliminar el registro.');
    }
  };

  const totalVentas = sales.reduce((acc, s) => acc + (Number(s.monto_ventas || s.monto_venta) || 0), 0);
  const totalComision = sales.reduce((acc, s) => acc + (Number(s.comision || s.monto_anulaciones) || 0), 0);
  const totalPremios = sales.reduce((acc, s) => acc + (Number(s.monto_premios) || 0), 0);
  const totalNeto = totalVentas - totalComision - totalPremios;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Date filter & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Fecha de Carga:
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={fetchSales}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Ventas Brutas</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono">
            {formatCurrency(totalVentas, moneda)}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Comisión</span>
            <MinusCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400 font-mono">
            {formatCurrency(totalComision, moneda)}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Premios Pagados</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-black text-purple-400 font-mono">
            {formatCurrency(totalPremios, moneda)}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl bg-gradient-to-br from-[#0D1B22] to-emerald-950/30 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Venta Neta</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className={`text-xl font-black font-mono ${totalNeto >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
            {formatCurrency(totalNeto, moneda)}
          </div>
        </div>
      </div>

      {/* Form: Add Daily Sales Entry */}
      {(!isDayClosed || isSupervisor) ? (
        <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            Carga Manual de Ventas (Sistemas Asignados)
          </h3>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateSale} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Sistema Asignado
              </label>
              <select
                value={sistema}
                onChange={(e) => setSistema(e.target.value)}
                className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
              >
                {assignedSystems.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Moneda Asignada
              </label>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
              >
                {assignedCurrencies.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Ventas Brutas
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={montoVentas}
                onChange={(e) => setMontoVentas(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0.00"
                className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Comisión
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={comision}
                onChange={(e) => setComision(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0.00"
                className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Premios
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoPremios}
                onChange={(e) => setMontoPremios(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0.00"
                className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-2 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : 'Guardar Venta'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          🔒 Tu jornada del día está cerrada. Contacta al supervisor para reabrirla si requieres registrar ventas.
        </div>
      )}

      {/* Sales Table */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Registros de Carga del Día ({sales.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                <th className="py-3 px-4 font-semibold">Sistema</th>
                <th className="py-3 px-4 font-semibold">Cajero</th>
                <th className="py-3 px-4 font-semibold text-right">Ventas</th>
                <th className="py-3 px-4 font-semibold text-right">Comisión</th>
                <th className="py-3 px-4 font-semibold text-right">Premios</th>
                <th className="py-3 px-4 font-semibold text-right">Neto</th>
                <th className="py-3 px-4 font-semibold text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No hay ventas registradas para esta fecha.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => {
                  const v = Number(sale.monto_ventas || sale.monto_venta) || 0;
                  const c = Number(sale.comision || sale.monto_anulaciones) || 0;
                  const p = Number(sale.monto_premios) || 0;
                  const neto = v - c - p;
                  return (
                    <tr key={sale.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-2" />
                        {sale.sistema}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {sale.nombre_cajero || 'Taquilla'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        {formatCurrency(v, sale.moneda || moneda)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-400">
                        {formatCurrency(c, sale.moneda || moneda)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-purple-400">
                        {formatCurrency(p, sale.moneda || moneda)}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${neto >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
                        {formatCurrency(neto, sale.moneda || moneda)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteSale(sale.id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
