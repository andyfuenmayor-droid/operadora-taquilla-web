import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { BankPayment, BankAccount, PaymentDevice } from '../../types';
import { formatCurrency, getTodayDateString, formatTime } from '../../utils/formatters';
import { 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Building, 
  Smartphone, 
  Receipt 
} from 'lucide-react';
import confetti from 'canvas-confetti';

const METODOS_BANCARIOS = [
  'Punto de Venta',
  'BioPago',
  'Pago Móvil',
  'Zelle',
  'Transferencia Bancaria',
  'Depósito Bancario',
  'Binance / Cripto',
  'PayPal',
  'Otro (Cuenta Admin)',
];

export const BankTransfersTab: React.FC = () => {
  const { user, agency, assignedCurrencies, isDayClosed } = useAuth();
  const [subTab, setSubTab] = useState<'registrar' | 'cuentas' | 'dispositivos' | 'historial'>('registrar');
  const [transfers, setTransfers] = useState<BankPayment[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [devices, setDevices] = useState<PaymentDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState(getTodayDateString());

  // Form State
  const [metodo, setMetodo] = useState(METODOS_BANCARIOS[0]);
  const bancoOrigen = '';
  const [bancoDestino, setBancoDestino] = useState('');
  const [referencia, setReferencia] = useState('');
  const [monto, setMonto] = useState<number | ''>('');
  const [moneda, setMoneda] = useState(assignedCurrencies[0] || 'BS');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const agencyName = agency?.nombre_agencia || '';

  // Load Accounts & Devices
  useEffect(() => {
    const fetchAccountsAndDevices = async () => {
      try {
        // Accounts
        const { data: accData } = await supabase
          .table('cuentas_bancarias')
          .select('*');

        if (accData && accData.length > 0) {
          setAccounts(accData);
          if (!bancoDestino) {
            setBancoDestino(`${accData[0].banco} - ${accData[0].numero_cuenta?.slice(-4) || ''}`);
          }
        }

        // Devices
        const { data: devData } = await supabase
          .table('dispositivos_pago')
          .select('*');

        if (devData) {
          setDevices(devData);
        }
      } catch (err) {
        console.warn('Error fetching accounts or devices:', err);
      }
    };
    fetchAccountsAndDevices();
  }, [bancoDestino]);

  const fetchTransfers = useCallback(async () => {
    if (!agencyName) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      let q = supabase
        .table('cda_pagos_bancarios')
        .select('*')
        .eq('fecha', fecha)
        .ilike('agencia', agencyName);

      if (user?.rol === 'cajero' && user?.id) {
        q = q.eq('cajero_id', String(user.id));
      }

      const { data, error } = await q.order('id', { ascending: false });

      if (error) throw error;
      setTransfers(data || []);
    } catch (err: unknown) {
      console.error('Error fetching bank payments:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar transferencias');
    } finally {
      setLoading(false);
    }
  }, [agencyName, fecha, user?.rol, user?.id]);

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

    try {
      const newRecord = {
        fecha,
        agencia: agencyName,
        cajero_id: user?.id ? String(user.id) : null,
        user_id: user?.user_id || user?.id,
        metodo_pago: metodo,
        concepto: bancoOrigen || metodo,
        pos_o_cuenta: bancoDestino || 'Cuenta Operadora',
        datos_pagador: user?.nombre || user?.usuario || 'CAJERO',
        referencia: referencia.trim(),
        monto: parsedMonto,
        moneda,
        confirmado: false,
        rechazado: false,
      };

      const { error } = await supabase.table('cda_pagos_bancarios').insert(newRecord);
      if (error) throw error;

      confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      setSuccessMsg(`Pago ref #${referencia} registrado exitosamente. En espera de confirmación.`);
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

  const totalConfirmado = transfers
    .filter((t) => t.confirmado)
    .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

  const totalPendiente = transfers
    .filter((t) => !t.confirmado && !t.rechazado)
    .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Subtabs navigation matching modulo_gestion_bancaria */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1B22] p-3 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSubTab('registrar')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'registrar' ? 'bg-emerald-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            💸 Registrar Pago
          </button>
          <button
            onClick={() => setSubTab('cuentas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'cuentas' ? 'bg-emerald-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            🏦 Cuentas Asignadas ({accounts.length})
          </button>
          <button
            onClick={() => setSubTab('dispositivos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'dispositivos' ? 'bg-emerald-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            📟 Dispositivos POS ({devices.length})
          </button>
          <button
            onClick={() => setSubTab('historial')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'historial' ? 'bg-emerald-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 Historial y Resumen
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-[#071217] border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={fetchTransfers}
            disabled={loading}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Actualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* SUBTAB 1: REGISTRAR PAGO */}
      {subTab === 'registrar' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-md">
              <div>
                <div className="text-xs text-slate-400 font-semibold mb-1">Confirmado en Banco</div>
                <div className="text-xl font-black text-emerald-400 font-mono">
                  {formatCurrency(totalConfirmado, moneda)}
                </div>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-md">
              <div>
                <div className="text-xs text-slate-400 font-semibold mb-1">Pendiente por Confirmar</div>
                <div className="text-xl font-black text-amber-400 font-mono">
                  {formatCurrency(totalPendiente, moneda)}
                </div>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {!isDayClosed ? (
            <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-lg">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                Registrar Pago Bancario / Depósito
              </h3>

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

              <form onSubmit={handleCreateTransfer} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                    className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                  >
                    {METODOS_BANCARIOS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Cuenta Receptora / Destino
                  </label>
                  {accounts.length > 0 ? (
                    <select
                      value={bancoDestino}
                      onChange={(e) => setBancoDestino(e.target.value)}
                      className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
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
                      placeholder="Ej. Banesco Operadora"
                      className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Referencia / Comprobante
                  </label>
                  <input
                    type="text"
                    required
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Ej. 938210"
                    className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
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

                <div className="sm:col-span-2 lg:col-span-4 mt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                  >
                    {submitting ? 'Registrando...' : 'Registrar Depósito / Pago Bancario'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
              🔒 La jornada está cerrada. No se pueden registrar nuevas transferencias hoy.
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: CUENTAS ASIGNADAS */}
      {subTab === 'cuentas' && (
        <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-400" />
              Cuentas Bancarias Asignadas por la Administración ({accounts.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400">
                  <th className="py-3 px-4">Banco / Entidad</th>
                  <th className="py-3 px-4">Titular</th>
                  <th className="py-3 px-4">N° Cuenta / Teléfono</th>
                  <th className="py-3 px-4">Moneda</th>
                  <th className="py-3 px-4 text-center">Estatus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No hay cuentas bancarias asignadas.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-white">{acc.banco}</td>
                      <td className="py-3 px-4 text-slate-300">{acc.titular}</td>
                      <td className="py-3 px-4 font-mono text-sky-400">{acc.numero_cuenta}</td>
                      <td className="py-3 px-4 font-bold text-slate-400">{acc.moneda || 'BS'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {acc.estatus || 'ACTIVA'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: DISPOSITIVOS DE PAGO */}
      {subTab === 'dispositivos' && (
        <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-sky-400" />
              Dispositivos de Pago Asignados (POS / Biopago) ({devices.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400">
                  <th className="py-3 px-4">Alias / Nombre</th>
                  <th className="py-3 px-4">Tipo Dispositivo</th>
                  <th className="py-3 px-4">Serial / TID</th>
                  <th className="py-3 px-4">Cuenta Asociada</th>
                  <th className="py-3 px-4 text-center">Estatus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No hay dispositivos de pago (POS / Biopago) asignados a esta taquilla.
                    </td>
                  </tr>
                ) : (
                  devices.map((dev) => (
                    <tr key={dev.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-white">{dev.alias_nombre}</td>
                      <td className="py-3 px-4 text-slate-300">{dev.tipo_dispositivo}</td>
                      <td className="py-3 px-4 font-mono text-sky-400">{dev.serial_tid}</td>
                      <td className="py-3 px-4 text-slate-400">{dev.cuenta_asociada || 'Principal'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {dev.estatus || 'ACTIVO'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: HISTORIAL Y RESUMEN */}
      {(subTab === 'historial' || subTab === 'registrar') && (
        <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              Historial de Pagos y Transferencias Registradas ({transfers.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                  <th className="py-3 px-4 font-semibold">Hora</th>
                  <th className="py-3 px-4 font-semibold">Método / Origen</th>
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
                      <td className="py-3 px-4 font-mono text-slate-400">{formatTime(t.hora)}</td>
                      <td className="py-3 px-4 font-medium text-white">{t.banco_origen || t.metodo_pago}</td>
                      <td className="py-3 px-4 text-slate-300">{t.banco_destino}</td>
                      <td className="py-3 px-4 font-mono font-bold text-sky-400">{t.referencia}</td>
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
                            Rechazado: {t.motivo_rechazo}
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
      )}
    </div>
  );
};
