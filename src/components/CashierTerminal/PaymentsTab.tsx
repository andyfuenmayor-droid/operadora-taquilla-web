import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { DailyPayment, ThermalReceiptData } from '../../types';
import { formatCurrency, getTodayDateString, generateTicketNumber, formatTime } from '../../utils/formatters';
import { printThermalReceipt } from '../../lib/thermalPrinter';
import { Plus, Printer, RefreshCw, AlertCircle, CheckCircle2, DollarSign, QrCode, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export const PaymentsTab: React.FC = () => {
  const { user, agency, assignedCurrencies, isDayClosed } = useAuth();
  const [payments, setPayments] = useState<DailyPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState(getTodayDateString());

  // Active delivery PIN/QR display
  const [activeDelivery, setActiveDelivery] = useState<{
    pago_id?: number;
    pin: string;
    token: string;
    monto: number;
    moneda: string;
  } | null>(null);

  // Form State
  const [ticketNro, setTicketNro] = useState(generateTicketNumber());
  const [concepto, setConcepto] = useState('Entregado a Supervisor');
  const [monto, setMonto] = useState<number | ''>('');
  const [moneda, setMoneda] = useState(assignedCurrencies[0] || 'BS');
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Transferencia' | 'Punto de Venta'>('Efectivo');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const agencyName = agency?.nombre_agencia || '';
  const isSupervisor = user?.rol === 'supervisor' || user?.rol === 'admin';
  const isAgencia = user?.rol === 'agencia';

  // Options for payment type based on role
  const paymentTypeOptions = React.useMemo(() => {
    if (isAgencia) {
      return ['Pago a Comercializador', 'Entregado a Cobrador'];
    }
    if (user?.rol === 'cajero') {
      return ['Entregado a Supervisor', 'Pago de Premios'];
    }
    return [
      'Entregado a Cobrador',
      'Efectivo (Entregado a Admin)',
      'Pago de Premios / Abono de Pérdida',
      'Abono / Reposición de Caja',
      'Pago a Comercializador',
    ];
  }, [isAgencia, user?.rol]);

  useEffect(() => {
    if (paymentTypeOptions.length > 0 && !paymentTypeOptions.includes(concepto)) {
      setConcepto(paymentTypeOptions[0]);
    }
    if (assignedCurrencies.length > 0 && !assignedCurrencies.includes(moneda)) {
      setMoneda(assignedCurrencies[0]);
    }
  }, [paymentTypeOptions, assignedCurrencies, concepto, moneda]);

  const fetchPayments = useCallback(async () => {
    if (!agencyName) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      let q = supabase
        .table('cda_pagos_diarios')
        .select('*')
        .eq('fecha', fecha)
        .or(`agencia.ilike.${agencyName},nombre_agency.ilike.${agencyName}`);

      if (user?.rol === 'cajero' && user?.id) {
        q = q.eq('cajero_id', String(user.id));
      }

      const { data, error } = await q.order('id', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (err: unknown) {
      console.error('Error fetching payments:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar pagos');
    } finally {
      setLoading(false);
    }
  }, [agencyName, fecha, user?.rol, user?.id]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handlePrintReceipt = (p: DailyPayment) => {
    const receiptData: ThermalReceiptData = {
      titulo: 'MULTIBANCA EXPRESS',
      agencia: p.agencia || agencyName,
      terminal: user?.terminal_id ? String(user.terminal_id) : undefined,
      cajero: p.nombre_cajero || user?.nombre || 'Cajero',
      ticketNro: p.ticket_nro || `TK-${p.id}`,
      fecha: p.fecha,
      hora: p.hora || new Date().toLocaleTimeString(),
      monto: p.monto,
      moneda: p.moneda,
      metodoPago: p.metodo_pago || 'Efectivo',
      concepto: p.concepto || p.tipo_pago || 'Pago de Efectivo',
      qrPayload: p.qr_token || `TK:${p.ticket_nro || p.id}|AG:${p.agencia || agencyName}|MTO:${p.monto}|FEC:${p.fecha}`,
    };

    printThermalReceipt(receiptData);
  };

  const handleCreatePayment = async (e: React.FormEvent, autoPrint = true) => {
    e.preventDefault();
    const parsedMonto = typeof monto === 'number' ? monto : 0;
    if (parsedMonto <= 0) {
      setErrorMsg('El monto debe ser mayor a 0');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Generate PIN and QR Token if "Entregado a Cobrador"
    let pin6: string | undefined = undefined;
    let qrTokenVal = `TK:${ticketNro}|AG:${agencyName}|MTO:${parsedMonto}|MON:${moneda}|FEC:${fecha}|TS:${Date.now()}`;

    if (concepto.includes('Cobrador')) {
      pin6 = `${Math.floor(Math.random() * 900000 + 100000)}`;
      qrTokenVal = `QR-REC-${pin6}`;
    }

    try {
      const newPayment = {
        fecha,
        agencia: agencyName,
        nombre_agency: agencyName,
        cajero_id: user?.id ? String(user.id) : null,
        user_id: user?.user_id || user?.id,
        tipo_pago: concepto,
        monto: parsedMonto,
        moneda,
        qr_token: qrTokenVal,
        confirmado: false,
        confirmado_supervisor: false,
        rechazado: false,
      };

      const { data, error } = await supabase
        .table('cda_pagos_diarios')
        .insert(newPayment)
        .select()
        .single();

      if (error) throw error;

      confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
      setSuccessMsg(`Pago registrado con éxito.`);

      if (pin6) {
        setActiveDelivery({
          pago_id: data?.id,
          pin: pin6,
          token: qrTokenVal,
          monto: parsedMonto,
          moneda,
        });
      }

      if (autoPrint) {
        handlePrintReceipt(data || newPayment);
      }

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

  const totalEfectivo = payments
    .filter((p) => (p.metodo_pago || 'Efectivo') === 'Efectivo')
    .reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Active PIN display card for Collector delivery */}
      {activeDelivery && (
        <div className="bg-gradient-to-r from-emerald-950/80 via-[#0D1B22] to-sky-950/80 border-2 border-emerald-500 rounded-3xl p-6 shadow-2xl relative text-center">
          <button
            onClick={() => setActiveDelivery(null)}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="inline-flex p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-2">
            <QrCode className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-white">
            🛵 Comprobante de Entrega a Cobrador en Ruta
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
            Díctale este PIN de 6 dígitos al Cobrador para validar la recepción del efectivo al instante:
          </p>

          <div className="bg-slate-900 border-2 border-emerald-400 rounded-2xl py-3 px-6 max-w-xs mx-auto my-4 shadow-xl">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest block">
              CÓDIGO PIN (6 DÍGITOS)
            </span>
            <span className="text-4xl font-black font-mono tracking-[0.3em] text-white">
              {activeDelivery.pin}
            </span>
          </div>

          <div className="text-xs text-slate-400 font-semibold">
            Monto a Recibir:{' '}
            <strong className="text-emerald-400 text-sm font-mono font-black">
              {formatCurrency(activeDelivery.monto, activeDelivery.moneda)}
            </strong>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800 shadow-md">
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

      {/* KPI Total */}
      <div className="bg-[#0D1B22] border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-md">
        <div>
          <div className="text-xs text-slate-400 font-semibold mb-1">
            Total Pagos y Entregas en Efectivo ({payments.length} operaciones)
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {formatCurrency(totalEfectivo, moneda)}
          </div>
        </div>
        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
          <DollarSign className="w-6 h-6" />
        </div>
      </div>

      {/* Form: Emit Ticket / Payout */}
      {(!isDayClosed || isSupervisor) ? (
        <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Registrar Entrega de Efectivo / Pago
            </h3>
            <span className="text-xs font-mono text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-800">
              Ticket #: <strong className="text-emerald-400">{ticketNro}</strong>
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

          <form onSubmit={(e) => handleCreatePayment(e, true)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Concepto / Tipo de Pago
              </label>
              <select
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
              >
                {paymentTypeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Método de Entrega
              </label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value as any)}
                className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Efectivo">Efectivo Físico</option>
                <option value="Transferencia">Transferencia / Pago Móvil</option>
                <option value="Punto de Venta">Punto de Venta (POS)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Monto y Moneda
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={monto}
                  onChange={(e) => setMonto(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value)}
                  className="bg-[#071217] border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                >
                  {assignedCurrencies.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="lg:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-500/20"
              >
                <Printer className="w-4 h-4" />
                <span>{submitting ? 'Procesando...' : 'Emitir e Imprimir (58mm)'}</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={(e) => handleCreatePayment(e as any, false)}
                className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Solo Guardar
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          🔒 La jornada de pagos está cerrada para esta fecha.
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Entregas y Pagos Registrados Hoy ({payments.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                <th className="py-3 px-4 font-semibold">Hora</th>
                <th className="py-3 px-4 font-semibold">Concepto / Destino</th>
                <th className="py-3 px-4 font-semibold">Cajero</th>
                <th className="py-3 px-4 font-semibold">PIN / QR</th>
                <th className="py-3 px-4 font-semibold text-right">Monto</th>
                <th className="py-3 px-4 font-semibold text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No hay pagos registrados para este día.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">{formatTime(p.hora)}</td>
                    <td className="py-3 px-4 font-medium text-white">{p.concepto || p.tipo_pago}</td>
                    <td className="py-3 px-4 text-slate-400">{p.nombre_cajero || 'Taquilla'}</td>
                    <td className="py-3 px-4 font-mono">
                      {p.pin_6 ? (
                        <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold border border-emerald-500/30">
                          PIN: {p.pin_6}
                        </span>
                      ) : p.qr_token ? (
                        <span className="text-slate-400 text-[10px]">QR Activo</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      {formatCurrency(p.monto, p.moneda)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handlePrintReceipt(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                        title="Reimprimir comprobante"
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
