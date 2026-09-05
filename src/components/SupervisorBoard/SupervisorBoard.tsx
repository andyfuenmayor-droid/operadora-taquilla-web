import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { BankPayment } from '../../types';
import { formatCurrency, getTodayDateString, formatTime } from '../../utils/formatters';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Building2, 
  DollarSign, 
  Receipt,
  Search
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AgencySummary {
  agencia: string;
  totalVentas: number;
  totalPremios: number;
  totalGastos: number;
  totalBanco: number;
  saldoEstimado: number;
  cerrado: boolean;
}

export const SupervisorBoard: React.FC = () => {
  const [fecha, setFecha] = useState(getTodayDateString());
  const [loading, setLoading] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState<BankPayment[]>([]);
  const [agencySummaries, setAgencySummaries] = useState<AgencySummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchSupervisorData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch pending and recent bank transfers
      const { data: bData } = await supabase
        .table('cda_pagos_bancarios')
        .select('*')
        .eq('fecha', fecha)
        .order('id', { ascending: false });

      setPendingTransfers(bData || []);

      // 2. Fetch all sales for this date
      const { data: sData } = await supabase
        .table('cda_reportes_diarios')
        .select('nombre_agency, monto_venta, comision, monto_premios, cerrado')
        .eq('fecha', fecha);

      // 3. Fetch all expenses for this date
      const { data: gData } = await supabase
        .table('cda_gastos_diarios')
        .select('agencia, nombre_agency, monto')
        .eq('fecha', fecha);

      // 4. Fetch all closed balances
      const { data: saldoData } = await supabase
        .table('saldo_taquilla')
        .select('nombre_agency, saldo_restante')
        .eq('fecha', fecha);

      // Aggregate by agency
      const mapAgencies: Record<string, AgencySummary> = {};

      // Initialize from sales
      (sData || []).forEach((row: any) => {
        const ag = row.nombre_agency || 'Sin Agencia';
        if (!mapAgencies[ag]) {
          mapAgencies[ag] = {
            agencia: ag,
            totalVentas: 0,
            totalPremios: 0,
            totalGastos: 0,
            totalBanco: 0,
            saldoEstimado: 0,
            cerrado: Boolean(row.cerrado),
          };
        }
        const venta = Number(row.monto_venta) || 0;
        const comision = Number(row.comision) || 0;
        mapAgencies[ag].totalVentas += (venta - comision);
        mapAgencies[ag].totalPremios += Number(row.monto_premios) || 0;
        if (row.cerrado) {
          mapAgencies[ag].cerrado = true;
        }
      });

      // Add expenses
      (gData || []).forEach((row: any) => {
        const ag = row.agencia || 'Sin Agencia';
        if (!mapAgencies[ag]) {
          mapAgencies[ag] = {
            agencia: ag,
            totalVentas: 0,
            totalPremios: 0,
            totalGastos: 0,
            totalBanco: 0,
            saldoEstimado: 0,
            cerrado: false,
          };
        }
        mapAgencies[ag].totalGastos += Number(row.monto) || 0;
      });

      // Add bank transfers
      (bData || []).forEach((row: any) => {
        const ag = row.agencia || 'Sin Agencia';
        if (!mapAgencies[ag]) {
          mapAgencies[ag] = {
            agencia: ag,
            totalVentas: 0,
            totalPremios: 0,
            totalGastos: 0,
            totalBanco: 0,
            saldoEstimado: 0,
            cerrado: false,
          };
        }
        if (row.confirmado) {
          mapAgencies[ag].totalBanco += Number(row.monto) || 0;
        }
      });

      // Mark closed status
      (saldoData || []).forEach((s: any) => {
        const ag = s.nombre_agency;
        if (mapAgencies[ag]) {
          mapAgencies[ag].cerrado = true;
          if (s.saldo_restante !== undefined && s.saldo_restante !== null) {
            mapAgencies[ag].saldoEstimado = Number(s.saldo_restante);
          }
        }
      });

      // Compute estimated balance for non-closed
      Object.values(mapAgencies).forEach((summary) => {
        if (!summary.cerrado) {
          summary.saldoEstimado = summary.totalVentas - summary.totalPremios - summary.totalGastos - summary.totalBanco;
        }
      });

      setAgencySummaries(Object.values(mapAgencies));
    } catch (err) {
      console.error('Error fetching supervisor data:', err);
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    fetchSupervisorData();
  }, [fetchSupervisorData]);

  const handleConfirmTransfer = async (id?: number) => {
    if (!id) return;
    setProcessingId(id);
    try {
      const { error } = await supabase
        .table('cda_pagos_bancarios')
        .update({
          confirmado: true,
          rechazado: false,
          fecha_confirmacion: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setPendingTransfers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, confirmado: true, rechazado: false } : t))
      );

      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#00C853', '#38BDF8'],
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al confirmar transferencia');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectTransfer = async (id?: number) => {
    if (!id) return;
    const motivo = window.prompt('Ingrese el motivo del rechazo de esta transferencia:');
    if (!motivo) return;

    setProcessingId(id);
    try {
      const { error } = await supabase
        .table('cda_pagos_bancarios')
        .update({
          confirmado: false,
          rechazado: true,
          motivo_rechazo: motivo,
        })
        .eq('id', id);

      if (error) throw error;

      setPendingTransfers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, confirmado: false, rechazado: true, motivo_rechazo: motivo } : t))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al rechazar');
    } finally {
      setProcessingId(null);
    }
  };

  // KPIs
  const totalGeneralVentas = agencySummaries.reduce((a, b) => a + b.totalVentas, 0);
  const totalGeneralGastos = agencySummaries.reduce((a, b) => a + b.totalGastos, 0);
  const totalGeneralBanco = pendingTransfers.filter((t) => t.confirmado).reduce((a, b) => a + Number(b.monto), 0);
  const pendientesCount = pendingTransfers.filter((t) => !t.confirmado && !t.rechazado).length;

  const filteredAgencies = agencySummaries.filter((ag) =>
    ag.agencia.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            Pizarra de Control en Tiempo Real
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Supervisión unificada de taquillas, transferencias bancarias y cierres
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
            onClick={fetchSupervisorData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Ventas Globales del Día</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {formatCurrency(totalGeneralVentas, 'USD')}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Gastos Operativos Globales</span>
            <Receipt className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {formatCurrency(totalGeneralGastos, 'USD')}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Depósitos Confirmados</span>
            <CheckCircle2 className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400 font-mono">
            {formatCurrency(totalGeneralBanco, 'VES')}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Transferencias Pendientes</span>
            <Clock className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-2xl font-black text-yellow-400 font-mono">
            {pendientesCount} por verificar
          </div>
        </div>
      </div>

      {/* Pending Bank Approvals Section */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            Transferencias y Pagos Bancarios ({pendingTransfers.length})
          </h3>
          <span className="text-[11px] text-slate-400">
            Confirmación o rechazo en 1 clic
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                <th className="py-3 px-4 font-semibold">Hora</th>
                <th className="py-3 px-4 font-semibold">Agencia</th>
                <th className="py-3 px-4 font-semibold">Cajero</th>
                <th className="py-3 px-4 font-semibold">Banco / Método</th>
                <th className="py-3 px-4 font-semibold">Referencia</th>
                <th className="py-3 px-4 font-semibold text-right">Monto</th>
                <th className="py-3 px-4 font-semibold text-center">Estado</th>
                <th className="py-3 px-4 font-semibold text-center">Acción Supervisor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {pendingTransfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No hay transferencias registradas en esta fecha.
                  </td>
                </tr>
              ) : (
                pendingTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {formatTime(t.hora)}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {t.agencia}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {t.nombre_cajero || 'Cajero'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {t.banco_origen} &rarr; {t.banco_destino}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-sky-400">
                      {t.referencia}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {formatCurrency(t.monto, t.moneda)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {t.confirmado ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Confirmado
                        </span>
                      ) : t.rechazado ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          <XCircle className="w-3 h-3" />
                          Rechazado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3" />
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!t.confirmado && !t.rechazado ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            disabled={processingId === t.id}
                            onClick={() => handleConfirmTransfer(t.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Confirmar</span>
                          </button>
                          <button
                            disabled={processingId === t.id}
                            onClick={() => handleRejectTransfer(t.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Rechazar</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">Procesado</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agency Balances Grid */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            Estado de Agencias y Cierres ({agencySummaries.length})
          </h3>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar agencia..."
              className="w-full bg-[#071217] border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgencies.length === 0 ? (
            <div className="col-span-3 py-8 text-center text-slate-500 text-xs">
              No hay agencias con movimientos registrados para esta fecha.
            </div>
          ) : (
            filteredAgencies.map((ag) => (
              <div
                key={ag.agencia}
                className="bg-[#071217] border border-slate-800/80 rounded-2xl p-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-white text-sm">{ag.agencia}</h4>
                    <span className="text-[10px] text-slate-500 font-mono">Terminal Activo</span>
                  </div>
                  {ag.cerrado ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Cerrado
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                      Abierto
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Ventas Netas:</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {formatCurrency(ag.totalVentas, 'USD')}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Premios Pagados:</span>
                    <span className="font-mono text-rose-400">
                      -{formatCurrency(ag.totalPremios, 'USD')}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Gastos:</span>
                    <span className="font-mono text-amber-400">
                      -{formatCurrency(ag.totalGastos, 'USD')}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Depósitos Banco:</span>
                    <span className="font-mono text-sky-400">
                      -{formatCurrency(ag.totalBanco, 'USD')}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-slate-200">
                    <span>Saldo Estimado en Caja:</span>
                    <span className="font-mono text-sm text-white">
                      {formatCurrency(ag.saldoEstimado, 'USD')}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
