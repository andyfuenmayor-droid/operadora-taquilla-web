import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { DailyExpense } from '../../types';
import { formatCurrency, getTodayDateString } from '../../utils/formatters';
import { Plus, Trash2, RefreshCw, AlertCircle, Receipt, DollarSign } from 'lucide-react';

const CATEGORIES = [
  'Rollos Térmicos / Papelería',
  'Alimentación / Refrigerios',
  'Servicios Públicos (Luz/Agua/Internet)',
  'Limpieza e Higiene',
  'Mantenimiento de Equipos',
  'Transporte y Envíos',
  'Varios / Imprevistos',
];

export const ExpensesTab: React.FC = () => {
  const { user, agency } = useAuth();
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState(getTodayDateString());

  // Form
  const [concepto, setConcepto] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIES[0]);
  const [monto, setMonto] = useState<number | ''>('');
  const [moneda, setMoneda] = useState<'USD' | 'VES'>('USD');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const agencyName = agency?.nombre_agencia || '';

  const fetchExpenses = useCallback(async () => {
    if (!agencyName) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .table('cda_gastos_diarios')
        .select('*')
        .eq('fecha', fecha)
        .ilike('agencia', agencyName)
        .order('id', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err: unknown) {
      console.error('Error fetching expenses:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar gastos');
    } finally {
      setLoading(false);
    }
  }, [agencyName, fecha]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMonto = typeof monto === 'number' ? monto : 0;
    if (!concepto.trim() || parsedMonto <= 0) {
      setErrorMsg('Por favor ingrese un concepto y un monto válido mayor a 0');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const newExpense = {
        fecha,
        agencia: agencyName,
        cajero_id: user?.id,
        nombre_cajero: user?.nombre || user?.usuario,
        concepto: concepto.trim(),
        categoria,
        monto: parsedMonto,
        moneda,
        estado: 'aprobado',
      };

      const { error } = await supabase.table('cda_gastos_diarios').insert(newExpense);
      if (error) throw error;

      setConcepto('');
      setMonto('');
      fetchExpenses();
    } catch (err: unknown) {
      console.error('Error adding expense:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar gasto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id?: number) => {
    if (!id || !window.confirm('¿Está seguro de eliminar este gasto?')) return;
    try {
      const { error } = await supabase.table('cda_gastos_diarios').delete().eq('id', id);
      if (error) throw error;
      setExpenses((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error('Error deleting expense:', err);
      alert('No se pudo eliminar el gasto.');
    }
  };

  const totalUsd = expenses
    .filter((g) => g.moneda === 'USD')
    .reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

  const totalVes = expenses
    .filter((g) => g.moneda === 'VES')
    .reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Fecha de Gastos:
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={fetchExpenses}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-semibold mb-1">Total Gastos en USD</div>
            <div className="text-2xl font-black text-rose-400 font-mono">
              {formatCurrency(totalUsd, 'USD')}
            </div>
          </div>
          <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-semibold mb-1">Total Gastos en Bolívares (VES)</div>
            <div className="text-2xl font-black text-amber-400 font-mono">
              {formatCurrency(totalVes, 'VES')}
            </div>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
            <Receipt className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Form: Add Expense */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          Registrar Nuevo Gasto Operativo
        </h3>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCreateExpense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Concepto / Detalle
            </label>
            <input
              type="text"
              required
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Compra de 5 rollos térmicos 58mm"
              className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Categoría
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Monto y Moneda
            </label>
            <div className="flex gap-1">
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={monto}
                onChange={(e) => setMonto(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0.00"
                className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as 'USD' | 'VES')}
                className="bg-[#071217] border border-slate-700 rounded-xl px-2 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
              >
                <option value="USD">USD</option>
                <option value="VES">VES</option>
              </select>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Guardar Gasto'}
            </button>
          </div>
        </form>
      </div>

      {/* Expenses Table */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Gastos Registrados ({expenses.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                <th className="py-3 px-4 font-semibold">Concepto</th>
                <th className="py-3 px-4 font-semibold">Categoría</th>
                <th className="py-3 px-4 font-semibold">Cajero</th>
                <th className="py-3 px-4 font-semibold text-right">Monto</th>
                <th className="py-3 px-4 font-semibold text-center">Estado</th>
                <th className="py-3 px-4 font-semibold text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No hay gastos registrados para este día.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-white">
                      {expense.concepto}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {expense.categoria}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {expense.nombre_cajero || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                      {formatCurrency(expense.monto, expense.moneda)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {expense.estado || 'aprobado'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Eliminar gasto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
