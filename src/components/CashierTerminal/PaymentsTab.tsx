import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { DailyPayment, ThermalReceiptData } from '../../types';
import { formatCurrency, getTodayDateString, generateTicketNumber, formatTime } from '../../utils/formatters';
import { printThermalReceipt } from '../../lib/thermalPrinter';
import { Plus, Printer, RefreshCw, AlertCircle, CheckCircle2, CreditCard, DollarSign } from 'lucide-react';
import confetti from 'canvas-confetti';

export const PaymentsTab: React.FC = () => {
  const { user, agency } = useAuth();
  const [payments, setPayments] = useState<DailyPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState(getTodayDateString());

  // Form State
  const [ticketNro, setTicketNro] = useState(generateTicketNumber());
  const [concepto, setConcepto] = useState('Pago de Premio Taquilla');
  const [monto, setMonto] = useState<number | ''>('');
  const [moneda, setMoneda] = useState<'USD' | 'VES'>('USD');
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Transferencia' | 'Punto de Venta'>('Efectivo');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const agencyName = agency?.nombre_agencia || '';

  const fetchPayments = useCallback(async () => {
    if (!agencyName) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .table('cda_pagos_diarios')
        .select('*')
        .eq('fecha', fecha)
        .ilike('agencia', agencyName)
        .order('id', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (err: unknown) {
      console.error('Error fetching payments:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar pagos');
    } finally {
      setLoading(false);
    }
  }, [agencyName, fecha]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handlePrintReceipt = (p: DailyPayment) => {
    const receiptData: ThermalReceiptData = {
      titulo: 'MULTIBANCA EXPRESS',
      agencia: p.agencia,
      terminal: user?.terminal_id ? String(user.terminal_id) : undefined,
      cajero: p.nombre_cajero || user?.nombre || 'Cajero',
      ticketNro: p.ticket_nro,
      fecha: p.fecha,
      hora: p.hora || new Date().toLocaleTimeString(),
      monto: p.monto,
      moneda: p.moneda,
      metodoPago: p.metodo_pago,
      concepto: p.concepto || 'Pago de Premio',
      qrPayload: p.qr_token || `TK:${p.ticket_nro}|AG:${p.agencia}|MTO:${p.monto}|FEC:${p.fecha}`,
    };

    printThermalReceipt(receiptData);
  };

  const handleCreatePayment = async (e: React.FormEvent, autoPrint = true) => {
    e.preventDefault();
    const parsedMonto = typeof monto === 'number' ? monto : 0;
    if (parsedMonto <= 0) {
      setErrorMsg('El monto del pago debe ser mayor a 0');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const now = new Date();
    const currentTimeStr = now.toTimeString().slice(0, 8);
    const generatedQrToken = `TK:${ticketNro}|AG:${agencyName}|MTO:${parsedMonto}|MON:${moneda}|FEC:${fecha}|TS:${Date.now()}`;

    try {
      const newPayment: DailyPayment = {
        fecha,
        hora: currentTimeStr,
        agencia: agencyName,
        cajero_id: user?.id,
        nombre_cajero: user?.nombre || user?.usuario,
        ticket_nro: ticketNro,
        concepto,
        monto: parsedMonto,
        moneda,
        metodo_pago: metodoPago,
        qr_token: generatedQrToken,
        estado: 'pagado',
      };

      const { data, error } = await supabase
        .table('cda_pagos_diarios')
        .insert(newPayment)
        .select()
        .single();

      if (error) throw error;

      // Confetti celebration
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#00C853', '#38BDF8', '#F59E0B'],
        });
      } catch {
        // ignore
      }

      setSuccessMsg(`Ticket #${ticketNro} emitido con éxito`);

      if (autoPrint) {
        handlePrintReceipt(data || newPayment);
      }

      // Reset and generate fresh ticket number
      setTicketNro(generateTicketNumber());
      setMonto('');
      fetchPayments();
    } catch (err: unknown) {
      console.error('Error creating payment:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al emitir pago');
    } finally {
      setSubmitting(false);
    }
  };

  const totalUsd = payments
    .filter((p) => p.moneda === 'USD')
    .reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

  const totalVes = payments
    .filter((p) => p.moneda === 'VES')
    .reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Fecha de Pagos:
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={fetchPayments}
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
            <div className="text-xs text-slate-400 font-semibold mb-1">Total Pagos Realizados (USD)</div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {formatCurrency(totalUsd, 'USD')}
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-semibold mb-1">Total Pagos en Bolívares (VES)</div>
            <div className="text-2xl font-black text-sky-400 font-mono">
              {formatCurrency(totalVes, 'VES')}
            </div>
          </div>
          <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400 border border-sky-500/20">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Form: Emit Ticket / Payout */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            Emitir Nuevo Pago a Cliente
          </h3>
          <span className="text-xs font-mono text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-800">
            Ticket #: <strong className="text-emerald-400">{ticketNro}</strong>
          </span>
        </div>

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

        <form onSubmit={(e) => handleCreatePayment(e, true)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Concepto / Detalle
            </label>
            <input
              type="text"
              required
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Premio Parley #8372"
              className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Método de Pago
            </label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value as 'Efectivo' | 'Transferencia' | 'Punto de Venta')}
              className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia / Pago Móvil</option>
              <option value="Punto de Venta">Punto de Venta (POS)</option>
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

          <div className="lg:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              <Printer className="w-4 h-4" />
              <span>{submitting ? 'Procesando...' : 'Emitir e Imprimir (58mm)'}</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={(e) => handleCreatePayment(e as unknown as React.FormEvent, false)}
              className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              title="Guardar sin imprimir"
            >
              Solo Guardar
            </button>
          </div>
        </form>
      </div>

      {/* Tickets Table */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Tickets Emitidos Hoy ({payments.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                <th className="py-3 px-4 font-semibold">Nro Ticket</th>
                <th className="py-3 px-4 font-semibold">Hora</th>
                <th className="py-3 px-4 font-semibold">Concepto</th>
                <th className="py-3 px-4 font-semibold">Método</th>
                <th className="py-3 px-4 font-semibold">Cajero</th>
                <th className="py-3 px-4 font-semibold text-right">Monto</th>
                <th className="py-3 px-4 font-semibold text-center">Estado</th>
                <th className="py-3 px-4 font-semibold text-center">Reimprimir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No hay tickets emitidos para este día.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {p.ticket_nro}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      {formatTime(p.hora)}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {p.concepto || 'Pago de Premio'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {p.metodo_pago}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {p.nombre_cajero || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      {formatCurrency(p.monto, p.moneda)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {p.estado || 'pagado'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handlePrintReceipt(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                        title="Reimprimir ticket térmico"
                      >
                        <Printer className="w-3 h-3 text-emerald-400" />
                        <span>Imprimir</span>
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
