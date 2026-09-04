import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCurrency, getTodayDateString } from '../../utils/formatters';
import { ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AuditRow {
  agencia: string;
  totalVentas: number;
  totalPremios: number;
  totalGastos: number;
  totalBanco: number;
  saldoRestante: number;
  cerrado: boolean;
}

export const AuditPanel: React.FC = () => {
  const [fecha, setFecha] = useState(getTodayDateString());
  const [loading, setLoading] = useState(false);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const { data: closures } = await supabase
        .table('saldo_taquilla')
        .select('*')
        .eq('fecha', fecha);

      const rows: AuditRow[] = (closures || []).map((c: any) => ({
        agencia: c.nombre_agency,
        totalVentas: Number(c.total_ventas) || 0,
        totalPremios: Number(c.total_premios) || 0,
        totalGastos: Number(c.total_gastos) || 0,
        totalBanco: Number(c.total_banco) || 0,
        saldoRestante: Number(c.saldo_restante) || 0,
        cerrado: !!c.cerrado,
      }));

      setAuditRows(rows);
    } catch (err) {
      console.error('Error fetching audit data:', err);
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const totalVentas = auditRows.reduce((a, b) => a + b.totalVentas, 0);
  const totalPremios = auditRows.reduce((a, b) => a + b.totalPremios, 0);
  const totalGastos = auditRows.reduce((a, b) => a + b.totalGastos, 0);
  const totalBanco = auditRows.reduce((a, b) => a + b.totalBanco, 0);
  const totalSaldoRestante = auditRows.reduce((a, b) => a + b.saldoRestante, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Panel de Auditoría y Cuadre General
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Consolidado diario de cuadres de caja y auditoría cruzada de agencias
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={fetchAudit}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Global Totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400 mb-1">Ventas Auditadas</div>
          <div className="text-lg font-black text-emerald-400 font-mono">
            {formatCurrency(totalVentas, 'USD')}
          </div>
        </div>
        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400 mb-1">Premios Pagados</div>
          <div className="text-lg font-black text-rose-400 font-mono">
            {formatCurrency(totalPremios, 'USD')}
          </div>
        </div>
        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400 mb-1">Gastos Operativos</div>
          <div className="text-lg font-black text-amber-400 font-mono">
            {formatCurrency(totalGastos, 'USD')}
          </div>
        </div>
        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400 mb-1">Entregas a Banco</div>
          <div className="text-lg font-black text-sky-400 font-mono">
            {formatCurrency(totalBanco, 'USD')}
          </div>
        </div>
        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400 mb-1">Saldo Total en Cajas</div>
          <div className="text-lg font-black text-white font-mono">
            {formatCurrency(totalSaldoRestante, 'USD')}
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Cuadre Consolidado por Agencia ({auditRows.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                <th className="py-3 px-4 font-semibold">Agencia</th>
                <th className="py-3 px-4 font-semibold text-right">Ventas</th>
                <th className="py-3 px-4 font-semibold text-right">Premios</th>
                <th className="py-3 px-4 font-semibold text-right">Gastos</th>
                <th className="py-3 px-4 font-semibold text-right">Banco</th>
                <th className="py-3 px-4 font-semibold text-right">Saldo Final</th>
                <th className="py-3 px-4 font-semibold text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {auditRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No hay registros de arqueo cerrados en esta fecha.
                  </td>
                </tr>
              ) : (
                auditRows.map((row) => (
                  <tr key={row.agencia} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-white">
                      {row.agencia}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-400">
                      {formatCurrency(row.totalVentas, 'USD')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-400">
                      {formatCurrency(row.totalPremios, 'USD')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-400">
                      {formatCurrency(row.totalGastos, 'USD')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sky-400">
                      {formatCurrency(row.totalBanco, 'USD')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {formatCurrency(row.saldoRestante, 'USD')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.cerrado ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Auditado y Cerrado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          Pendiente de Cierre
                        </span>
                      )}
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
