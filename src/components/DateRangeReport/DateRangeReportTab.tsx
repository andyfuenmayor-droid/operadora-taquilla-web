import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatCurrency, getTodayDateString } from '../../utils/formatters';
import { RefreshCw, Calendar, DollarSign, Award, Receipt, Building2, TrendingUp, Users } from 'lucide-react';

interface ReportRow {
  fecha: string;
  sistema: string;
  cajero: string;
  ventas: number;
  comision: number;
  premios: number;
  gastos: number;
  banco: number;
  neto: number;
}

export const DateRangeReportTab: React.FC = () => {
  const { user, agency, systemCycle, assignedCurrencies } = useAuth();
  const [desde, setDesde] = useState(systemCycle?.desde || getTodayDateString());
  const [hasta, setHasta] = useState(systemCycle?.hasta || getTodayDateString());

  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [cashiersList, setCashiersList] = useState<Array<{ id: string; nombre: string }>>([]);
  const [selectedCashier, setSelectedCashier] = useState<string>('all');

  const agencyName = agency?.nombre_agencia || '';
  const isSupervisor = user?.rol === 'supervisor' || user?.rol === 'admin';
  const mainCurrency = assignedCurrencies[0] || 'USD';

  // Load cashiers for supervisor filter
  useEffect(() => {
    if (isSupervisor) {
      const fetchCashiers = async () => {
        try {
          const { data } = await supabase
            .table('taquilla_usuarios')
            .select('id, usuario, nombre_cajero, rol');

          const cajeros = (data || [])
            .filter((u: any) => u.rol === 'cajero')
            .map((u: any) => ({
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
  }, [isSupervisor]);

  const fetchReportData = useCallback(async () => {
    if (!agencyName) return;
    setLoading(true);

    try {
      // 1. Sales
      let qSales = supabase
        .table('cda_reportes_diarios')
        .select('*')
        .ilike('agencia', agencyName)
        .gte('fecha', desde)
        .lte('fecha', hasta);

      if (!isSupervisor && user?.id) {
        qSales = qSales.eq('cajero_id', String(user.id));
      } else if (isSupervisor && selectedCashier !== 'all') {
        qSales = qSales.eq('cajero_id', selectedCashier);
      }

      const { data: salesData } = await qSales;

      // 2. Expenses
      let qExpenses = supabase
        .table('cda_gastos_diarios')
        .select('*')
        .ilike('agencia', agencyName)
        .gte('fecha', desde)
        .lte('fecha', hasta);

      if (!isSupervisor && user?.id) {
        qExpenses = qExpenses.eq('cajero_id', String(user.id));
      } else if (isSupervisor && selectedCashier !== 'all') {
        qExpenses = qExpenses.eq('cajero_id', selectedCashier);
      }

      const { data: expData } = await qExpenses;

      // 3. Bank Transfers
      let qBank = supabase
        .table('cda_pagos_bancarios')
        .select('*')
        .ilike('agencia', agencyName)
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .eq('confirmado', true);

      const { data: bankData } = await qBank;

      // Build consolidated rows
      const rows: ReportRow[] = [];

      (salesData || []).forEach((s: any) => {
        const v = Number(s.monto_ventas || s.monto_venta) || 0;
        const c = Number(s.comision || s.monto_anulaciones) || 0;
        const p = Number(s.monto_premios) || 0;
        const n = v - c - p;

        rows.push({
          fecha: s.fecha,
          sistema: s.sistema || 'General',
          cajero: s.nombre_cajero || 'Taquilla',
          ventas: v,
          comision: c,
          premios: p,
          gastos: 0,
          banco: 0,
          neto: n,
        });
      });

      // Add expenses
      (expData || []).forEach((g: any) => {
        rows.push({
          fecha: g.fecha,
          sistema: `Gasto: ${g.concepto || g.categoria || 'Gasto'}`,
          cajero: g.nombre_cajero || 'Taquilla',
          ventas: 0,
          comision: 0,
          premios: 0,
          gastos: Number(g.monto) || 0,
          banco: 0,
          neto: -(Number(g.monto) || 0),
        });
      });

      // Add bank deposits
      (bankData || []).forEach((b: any) => {
        rows.push({
          fecha: b.fecha,
          sistema: `Banco: ${b.banco_origen} (${b.referencia})`,
          cajero: b.nombre_cajero || 'Taquilla',
          ventas: 0,
          comision: 0,
          premios: 0,
          gastos: 0,
          banco: Number(b.monto) || 0,
          neto: 0,
        });
      });

      // Sort by date desc
      rows.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setReportRows(rows);
    } catch (err) {
      console.error('Error fetching date range report:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyName, desde, hasta, isSupervisor, selectedCashier, user?.id]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Totals
  const totalVentas = reportRows.reduce((a, b) => a + b.ventas, 0);
  const totalComisiones = reportRows.reduce((a, b) => a + b.comision, 0);
  const totalPremios = reportRows.reduce((a, b) => a + b.premios, 0);
  const totalGastos = reportRows.reduce((a, b) => a + b.gastos, 0);
  const totalBanco = reportRows.reduce((a, b) => a + b.banco, 0);
  const balanceNeto = totalVentas - totalComisiones - totalPremios - totalGastos;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Date Filters Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Desde:
            </label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Hasta:
            </label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {isSupervisor && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <select
                value={selectedCashier}
                onChange={(e) => setSelectedCashier(e.target.value)}
                className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
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
        </div>

        <button
          onClick={fetchReportData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Totals Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center justify-between">
            <span>Ventas Brutas</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-black text-emerald-400 font-mono">
            {formatCurrency(totalVentas, mainCurrency)}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center justify-between">
            <span>Comisiones</span>
            <span className="text-[10px] text-amber-400 font-bold">%</span>
          </div>
          <div className="text-base font-black text-amber-400 font-mono">
            {formatCurrency(totalComisiones, mainCurrency)}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center justify-between">
            <span>Premios Pagados</span>
            <Award className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-base font-black text-purple-400 font-mono">
            {formatCurrency(totalPremios, mainCurrency)}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center justify-between">
            <span>Gastos</span>
            <Receipt className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-base font-black text-rose-400 font-mono">
            {formatCurrency(totalGastos, mainCurrency)}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center justify-between">
            <span>Depósitos Banco</span>
            <Building2 className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-base font-black text-sky-400 font-mono">
            {formatCurrency(totalBanco, mainCurrency)}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl bg-gradient-to-br from-[#0D1B22] to-emerald-950/30">
          <div className="text-slate-400 text-xs font-semibold mb-1 flex items-center justify-between">
            <span>Resultado Neto</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className={`text-base font-black font-mono ${balanceNeto >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(balanceNeto, mainCurrency)}
          </div>
        </div>
      </div>

      {/* Detailed Movement Table */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Movimientos Consolidados del Periodo ({reportRows.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                <th className="py-3 px-4 font-semibold">Fecha</th>
                <th className="py-3 px-4 font-semibold">Concepto / Sistema</th>
                <th className="py-3 px-4 font-semibold">Cajero</th>
                <th className="py-3 px-4 font-semibold text-right">Ventas</th>
                <th className="py-3 px-4 font-semibold text-right">Premios</th>
                <th className="py-3 px-4 font-semibold text-right">Gastos</th>
                <th className="py-3 px-4 font-semibold text-right">Banco</th>
                <th className="py-3 px-4 font-semibold text-right">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {reportRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No hay registros encontrados para el rango de fechas seleccionado.
                  </td>
                </tr>
              ) : (
                reportRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-300">{r.fecha}</td>
                    <td className="py-3 px-4 font-medium text-white">{r.sistema}</td>
                    <td className="py-3 px-4 text-slate-400">{r.cajero}</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-400">
                      {r.ventas > 0 ? formatCurrency(r.ventas, mainCurrency) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-purple-400">
                      {r.premios > 0 ? formatCurrency(r.premios, mainCurrency) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-400">
                      {r.gastos > 0 ? formatCurrency(r.gastos, mainCurrency) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sky-400">
                      {r.banco > 0 ? formatCurrency(r.banco, mainCurrency) : '—'}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${r.neto >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatCurrency(r.neto, mainCurrency)}
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
