import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatCurrency, getTodayDateString } from '../../utils/formatters';
import { 
  Building2, 
  Calendar, 
  Phone, 
  DollarSign, 
  Receipt, 
  CreditCard, 
  Calculator, 
  Award, 
  TrendingUp, 
  ShieldCheck, 
  Lock, 
  Unlock 
} from 'lucide-react';

interface HomeDashboardProps {
  onNavigate: (tab: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate }) => {
  const { user, agency, systemCycle, assignedCurrencies, isDayClosed } = useAuth();
  const [balancesByCurrency, setBalancesByCurrency] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const agencyName = agency?.nombre_agencia || '';
  const waNumber = agency?.telefono_whatsapp || agency?.telefono || '';

  const fetchBalancePerCurrency = useCallback(async () => {
    if (!agencyName) return;
    setLoading(true);

    try {
      const today = getTodayDateString();
      const balances: Record<string, number> = {};

      for (const curr of assignedCurrencies) {
        balances[curr] = 0;

        // 1. Get latest closed balance
        const { data: saldoData } = await supabase
          .table('saldo_taquilla')
          .select('saldo_restante')
          .eq('fecha', today)
          .ilike('nombre_agency', agencyName)
          .maybeSingle();

        if (saldoData && saldoData.saldo_restante !== undefined) {
          balances[curr] = Number(saldoData.saldo_restante) || 0;
        } else {
          // Compute estimated balance for today
          const { data: sales } = await supabase
            .table('cda_reportes_diarios')
            .select('monto_ventas, monto_venta, comision, monto_anulaciones, monto_premios')
            .eq('fecha', today)
            .ilike('agencia', agencyName);

          const { data: expenses } = await supabase
            .table('cda_gastos_diarios')
            .select('monto')
            .eq('fecha', today)
            .ilike('agencia', agencyName);

          const { data: bankPayments } = await supabase
            .table('cda_pagos_bancarios')
            .select('monto')
            .eq('fecha', today)
            .ilike('agencia', agencyName)
            .eq('confirmado', true);

          const totalVentas = (sales || []).reduce(
            (acc: number, s: any) => acc + (Number(s.monto_ventas || s.monto_venta) || 0) - (Number(s.monto_anulaciones || s.comision) || 0),
            0
          );
          const totalPremios = (sales || []).reduce(
            (acc: number, s: any) => acc + (Number(s.monto_premios) || 0),
            0
          );
          const totalGastos = (expenses || []).reduce(
            (acc: number, g: any) => acc + (Number(g.monto) || 0),
            0
          );
          const totalBanco = (bankPayments || []).reduce(
            (acc: number, b: any) => acc + (Number(b.monto) || 0),
            0
          );

          balances[curr] = totalVentas - totalPremios - totalGastos - totalBanco;
        }
      }

      setBalancesByCurrency(balances);
    } catch (err) {
      console.error('Error fetching currency balances:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyName, assignedCurrencies]);

  useEffect(() => {
    fetchBalancePerCurrency();
  }, [fetchBalancePerCurrency]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fadeIn">
      {/* Welcome Banner */}
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

          <div className="text-right">
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
            <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-end gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Ciclo Admin {systemCycle?.semana ? `(Sem. ${systemCycle.semana})` : ''}:{' '}
                <strong className="text-slate-300 font-mono">{systemCycle?.desde || '—'}</strong> al{' '}
                <strong className="text-slate-300 font-mono">{systemCycle?.hasta || '—'}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Multicurrency Balances / Debt Status */}
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
            const bal = balancesByCurrency[curr] || 0;
            return (
              <div
                key={curr}
                className="bg-[#071217] border border-slate-800 rounded-2xl p-4 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Moneda: <strong className="text-white">{curr}</strong>
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    {loading ? 'Calculando...' : formatCurrency(bal, curr)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {bal >= 0 ? 'Saldo a favor / en caja' : 'Deuda pendiente'}
                  </div>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => onNavigate('ventas')}
          className="bg-[#0D1B22] hover:bg-[#12242e] border border-slate-800 p-4 rounded-2xl text-center transition-all cursor-pointer group shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-white">Carga Ventas</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Auditoría diaria</div>
        </button>

        <button
          onClick={() => onNavigate('tickets_premiados')}
          className="bg-[#0D1B22] hover:bg-[#12242e] border border-slate-800 p-4 rounded-2xl text-center transition-all cursor-pointer group shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
            <Award className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-white">Tickets Premios</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Registro y lotes</div>
        </button>

        <button
          onClick={() => onNavigate('gastos')}
          className="bg-[#0D1B22] hover:bg-[#12242e] border border-slate-800 p-4 rounded-2xl text-center transition-all cursor-pointer group shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-white">Gastos Agencia</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Operación</div>
        </button>

        <button
          onClick={() => onNavigate('pagos')}
          className="bg-[#0D1B22] hover:bg-[#12242e] border border-slate-800 p-4 rounded-2xl text-center transition-all cursor-pointer group shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-white">Pago Efectivo</div>
          <div className="text-[10px] text-slate-500 mt-0.5">PIN &amp; QR ruta</div>
        </button>

        <button
          onClick={() => onNavigate('banco')}
          className="bg-[#0D1B22] hover:bg-[#12242e] border border-slate-800 p-4 rounded-2xl text-center transition-all cursor-pointer group shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-white">Gestión Bancaria</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Cuentas &amp; POS</div>
        </button>

        <button
          onClick={() => onNavigate('cierre')}
          className="bg-[#0D1B22] hover:bg-[#12242e] border border-slate-800 p-4 rounded-2xl text-center transition-all cursor-pointer group shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-white">Cierre Diario</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Arqueo físico</div>
        </button>
      </div>
    </div>
  );
};
