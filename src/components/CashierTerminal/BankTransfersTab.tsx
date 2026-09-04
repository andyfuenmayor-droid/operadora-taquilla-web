import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { BankPayment, BankAccount } from '../../types';
import { formatCurrency, getTodayDateString } from '../../utils/formatters';
import { Plus, RefreshCw, AlertCircle, CheckCircle2, Clock, XCircle, Building } from 'lucide-react';

const COMMON_BANKS = [
  'Banco de Venezuela (BDV)',
  'Banesco Banco Universal',
  'Banco Mercantil',
  'Bancaribe',
  'BBVA Provincial',
  'BNC Banco Nacional de Crédito',
  'Pago Móvil Interbancario',
  'Zelle (USD)',
  'Binance USDT',
  'Efectivo Divisas Entregado',
];

export const BankTransfersTab: React.FC = () => {
  const { user, agency } = useAuth();
  const [transfers, setTransfers] = useState<BankPayment[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState(getTodayDateString());

  // Form State
  const [bancoOrigen, setBancoOrigen] = useState(COMMON_BANKS[0]);
  const [bancoDestino, setBancoDestino] = useState('');
  const [referencia, setReferencia] = useState('');
  const [monto, setMonto] = useState<number | ''>('');
  const [moneda, setMoneda] = useState<'USD' | 'VES'>('VES');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const agencyName = agency?.nombre_agencia || '';

  // Load Bank Accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const { data } = await supabase
          .table('cuentas_bancarias')
          .select('*')
          .eq('activa', true);

        if (data && data.length > 0) {
          setAccounts(data);
          setBancoDestino(`${data[0].banco} - ${data[0].numero_cuenta?.slice(-4) || ''}`);
        } else {
          setBancoDestino('Cuenta Operadora Principal');
        }
      } catch (err) {
        console.error('Error fetching bank accounts:', err);
      }
    };
    fetchAccounts();
  }, []);

  const fetchTransfers = useCallback(async () => {
    if (!agencyName) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .table('cda_pagos_bancarios')
        .select('*')
        .eq('fecha', fecha)
        .ilike('agencia', agencyName)
        .order('id', { ascending: false });

      if (error) throw error;
      setTransfers(data || []);
    } catch (err: unknown) {
      console.error('Error fetching bank payments:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar transferencias');
    } finally {
      setLoading(false);
    }
  }, [agencyName, fecha]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMonto = typeof monto === 'number' ? monto : 0;
    if (!referencia.trim() || parsedMonto <= 0) {
      setErrorMsg('Ingrese una referencia válida y un monto mayor a 0');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const now = new Date();
    const currentTimeStr = now.toTimeString().slice(0, 8);

    try {
      const newRecord = {
        fecha,
        hora: currentTimeStr,
        agencia: agencyName,
        cajero_id: user?.id,
        nombre_cajero: user?.nombre || user?.usuario,
        banco_origen: bancoOrigen,
        banco_destino: bancoDestino,
        referencia: referencia.trim(),
        monto: parsedMonto,
        moneda,
        confirmado: false,
        rechazado: false,
      };

      const { error } = await supabase.table('cda_pagos_bancarios').insert(newRecord);
      if (error) throw error;

      setSuccessMsg(`Transferencia ref #${referencia} registrada. En espera de confirmación.`);
      setReferencia('');
      setMonto('');
      fetchTransfers();
    } catch (err: unknown) {
      console.error('Error registering bank payment:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar transferencia');
    } finally {
      setSubmitting(false);
    }
  };

  const totalConfirmadoUsd = transfers
    .filter((t) => t.confirmado && t.moneda === 'USD')
    .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

  const totalConfirmadoVes = transfers
    .filter((t) => t.confirmado && t.moneda === 'VES')
    .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

  const totalPendienteVes = transfers
    .filter((t) => !t.confirmado && !t.rechazado && t.moneda === 'VES')
    .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Fecha de Depósitos:
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={fetchTransfers}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Confirmado en Banco (VES)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono">
            {formatCurrency(totalConfirmadoVes, 'VES')}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Confirmado en USD</span>
            <Building className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-black text-sky-400 font-mono">
            {formatCurrency(totalConfirmadoUsd, 'USD')}
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Pendiente por Confirmar (VES)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400 font-mono">
            {formatCurrency(totalPendienteVes, 'VES')}
          </div>
        </div>
      </div>

      {/* Form: Register Transfer */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          Registrar Depósito / Transferencia Bancaria
        </h3>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
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

        <form onSubmit={handleCreateTransfer} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Banco Origen / Método
            </label>
            <select
              value={bancoOrigen}
              onChange={(e) => setBancoOrigen(e.target.value)}
              className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {COMMON_BANKS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Cuenta Receptora
            </label>
            {accounts.length > 0 ? (
              <select
                value={bancoDestino}
                onChange={(e) => setBancoDestino(e.target.value)}
                className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={`${acc.banco} - ${acc.numero_cuenta?.slice(-4) || ''}`}>
                    {acc.banco} ({acc.numero_cuenta?.slice(-4) || ''}) - {acc.titular}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                required
                value={bancoDestino}
                onChange={(e) => setBancoDestino(e.target.value)}
                placeholder="Ej. Banesco Cta Operadora"
                className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Número de Referencia
            </label>
            <input
              type="text"
              required
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej. 948194"
              className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
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
                <option value="VES">VES</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Registrando...' : 'Registrar Depósito'}
            </button>
          </div>
        </form>
      </div>

      {/* Transfers Table */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Depósitos y Transferencias Registradas ({transfers.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                <th className="py-3 px-4 font-semibold">Hora</th>
                <th className="py-3 px-4 font-semibold">Banco Origen</th>
                <th className="py-3 px-4 font-semibold">Cuenta Destino</th>
                <th className="py-3 px-4 font-semibold">Referencia</th>
                <th className="py-3 px-4 font-semibold text-right">Monto</th>
                <th className="py-3 px-4 font-semibold text-center">Estado de Confirmación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No hay transferencias registradas para esta fecha.
                  </td>
                </tr>
              ) : (
                transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {t.hora || 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-medium text-white">
                      {t.banco_origen}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {t.banco_destino}
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
                        <span 
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          title={t.motivo_rechazo || 'Rechazado por supervisor'}
                        >
                          <XCircle className="w-3 h-3" />
                          Rechazado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3" />
                          Pendiente Supervisor
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
