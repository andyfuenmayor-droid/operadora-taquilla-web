import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { DailySale } from '../../types';
import { formatCurrency, getTodayDateString } from '../../utils/formatters';
import { Plus, Trash2, RefreshCw, AlertCircle, DollarSign, TrendingUp, Award, MinusCircle } from 'lucide-react';

export const DailySalesTab: React.FC = () => {
  const { user, agency } = useAuth();
  const [sales, setSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState(getTodayDateString());

  // Form State
  const [sistema, setSistema] = useState('Apuestas');
  const [montoVentas, setMontoVentas] = useState<number | ''>('');
  const [montoAnulaciones, setMontoAnulaciones] = useState<number | ''>('');
  const [montoPremios, setMontoPremios] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const agencyName = agency?.nombre_agencia || '';

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
    const anulaciones = typeof montoAnulaciones === 'number' ? montoAnulaciones : 0;
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
        cajero_id: user?.id,
        nombre_cajero: user?.nombre || user?.usuario,
        sistema,
        monto_ventas: ventas,
        monto_anulaciones: anulaciones,
        monto_premios: premios,
        monto_neto: ventas - anulaciones - premios,
        cerrado: false,
      };

      const { error } = await supabase.table('cda_reportes_diarios').insert(newRecord);
      if (error) throw error;

      // Reset form
      setMontoVentas('');
      setMontoAnulaciones('');
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

  // Totals calculations
  const totalVentas = sales.reduce((acc, s) => acc + (Number(s.monto_ventas) || 0), 0);
  const totalAnulaciones = sales.reduce((acc, s) => acc + (Number(s.monto_anulaciones) || 0), 0);
  const totalPremios = sales.reduce((acc, s) => acc + (Number(s.monto_premios) || 0), 0);
  const totalNeto = totalVentas - totalAnulaciones - totalPremios;

  return (
    <div className="space-y-6">
      {/* Date filter & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Fecha de Operación:
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
        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Ventas Brutas</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400">
            {formatCurrency(totalVentas, 'USD')}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Anulaciones</span>
            <MinusCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400">
            {formatCurrency(totalAnulaciones, 'USD')}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Premios Pagados</span>
            <Award className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-black text-rose-400">
            {formatCurrency(totalPremios, 'USD')}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl bg-gradient-to-br from-[#0D1B22] to-emerald-950/30">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Venta Neta</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-black text-sky-400">
            {formatCurrency(totalNeto, 'USD')}
          </div>
        </div>
      </div>

      {/* Form: Add Daily Sales Entry */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          Registrar Venta por Sistema
        </h3>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCreateSale} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Sistema / Proveedor
            </label>
            <select
              value={sistema}
              onChange={(e) => setSistema(e.target.value)}
              className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="Apuestas">Apuestas Deportivas</option>
              <option value="Lotería">Lotería / Animalitos</option>
              <option value="Hipismo">Hipismo Internacional</option>
              <option value="Parley">Parley Express</option>
              <option value="Casino Virtual">Casino Virtual</option>
              <option value="Otros">Otros</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Ventas Brutas ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={montoVentas}
              onChange={(e) => setMontoVentas(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="0.00"
              className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Anulaciones ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={montoAnulaciones}
              onChange={(e) => setMontoAnulaciones(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="0.00"
              className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Premios Pagados ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={montoPremios}
              onChange={(e) => setMontoPremios(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="0.00"
              className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Guardar Venta'}
            </button>
          </div>
        </form>
      </div>

      {/* Sales Table */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Registros de Venta del Día ({sales.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                <th className="py-3 px-4 font-semibold">Sistema</th>
                <th className="py-3 px-4 font-semibold">Cajero</th>
                <th className="py-3 px-4 font-semibold text-right">Ventas</th>
                <th className="py-3 px-4 font-semibold text-right">Anulaciones</th>
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
                  const neto = (Number(sale.monto_ventas) || 0) - (Number(sale.monto_anulaciones) || 0) - (Number(sale.monto_premios) || 0);
                  return (
                    <tr key={sale.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-white">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-2" />
                        {sale.sistema}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {sale.nombre_cajero || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        {formatCurrency(sale.monto_ventas, 'USD')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-400">
                        {formatCurrency(sale.monto_anulaciones, 'USD')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-rose-400">
                        {formatCurrency(sale.monto_premios, 'USD')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-sky-400">
                        {formatCurrency(neto, 'USD')}
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
