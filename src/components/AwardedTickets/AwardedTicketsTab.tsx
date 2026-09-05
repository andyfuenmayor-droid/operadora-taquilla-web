import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { AwardedTicket } from '../../types';
import { formatCurrency, getTodayDateString } from '../../utils/formatters';
import { Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2, Award, ListPlus } from 'lucide-react';
import confetti from 'canvas-confetti';

export const AwardedTicketsTab: React.FC = () => {
  const { user, agency, assignedSystems, assignedCurrencies, isDayClosed } = useAuth();
  const [fecha, setFecha] = useState(getTodayDateString());
  const [tickets, setTickets] = useState<AwardedTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [verTodos, setVerTodos] = useState(false);

  // Form State
  const [sistema, setSistema] = useState(assignedSystems[0] || 'BETM3');
  const [moneda, setMoneda] = useState(assignedCurrencies[0] || 'BS');
  const [modoLote, setModoLote] = useState(false);

  // Single ticket
  const [numeroTicket, setNumeroTicket] = useState('');
  const [monto, setMonto] = useState<number | ''>('');

  // Batch tickets (last 3 digits)
  const [loteTickets, setLoteTickets] = useState<Array<{ serial: string; monto: number | '' }>>([
    { serial: '', monto: '' },
    { serial: '', monto: '' },
    { serial: '', monto: '' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const agencyName = agency?.nombre_agencia || '';
  const isSupervisor = user?.rol === 'supervisor' || user?.rol === 'admin';

  // Update default system/currency if assigned lists update
  useEffect(() => {
    if (assignedSystems.length > 0 && !assignedSystems.includes(sistema)) {
      setSistema(assignedSystems[0]);
    }
    if (assignedCurrencies.length > 0 && !assignedCurrencies.includes(moneda)) {
      setMoneda(assignedCurrencies[0]);
    }
  }, [assignedSystems, assignedCurrencies, sistema, moneda]);

  const fetchTickets = useCallback(async () => {
    if (!agencyName) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      let q = supabase
        .table('cda_premios_tickets')
        .select('*')
        .eq('fecha', fecha);

      if (!verTodos) {
        q = q.ilike('agencia', agencyName);
        if (!isSupervisor && user?.id) {
          q = q.eq('user_id', String(user.id));
        }
      }

      const { data, error } = await q.order('id', { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (err: unknown) {
      console.error('Error fetching tickets:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar tickets');
    } finally {
      setLoading(false);
    }
  }, [agencyName, fecha, verTodos, isSupervisor, user?.id]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreateSingleTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const numMonto = typeof monto === 'number' ? monto : 0;
    if (!numeroTicket.trim() || numMonto <= 0) {
      setErrorMsg('Complete el número de ticket y un monto mayor a 0');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const newTicket = {
        fecha,
        agencia: agencyName,
        user_id: user?.user_id || user?.id,
        sistema,
        numero_ticket: numeroTicket.trim().toUpperCase(),
        monto: Math.round(numMonto * 100) / 100,
        estado: 'RECLAMADO',
      };

      const { error: insErr } = await supabase.table('cda_premios_tickets').insert(newTicket);
      if (insErr) throw insErr;

      // Update or insert in cda_reportes_diarios
      await updateDailyReportPrizes(numMonto);

      confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
      setSuccessMsg(`Ticket #${numeroTicket.trim().toUpperCase()} registrado exitosamente.`);
      setNumeroTicket('');
      setMonto('');
      fetchTickets();
    } catch (err: unknown) {
      console.error('Error adding ticket:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const updateDailyReportPrizes = async (addedAmount: number) => {
    try {
      let q = supabase
        .table('cda_reportes_diarios')
        .select('*')
        .ilike('nombre_agency', agencyName)
        .eq('fecha', fecha)
        .eq('sistema', sistema);

      if (user?.id) {
        q = q.eq('cajero_id', String(user.id));
      }

      const { data: dRes } = await q.maybeSingle();

      if (dRes) {
        const nuevoPremios = (Number(dRes.monto_premios) || 0) + addedAmount;
        const venta = Number(dRes.monto_venta || 0);
        const comision = Number(dRes.comision || 0);
        const nuevoNeto = venta - comision - nuevoPremios;

        await supabase
          .table('cda_reportes_diarios')
          .update({
            monto_premios: nuevoPremios,
            neto: nuevoNeto,
          })
          .eq('id', dRes.id);
      } else {
        await supabase.table('cda_reportes_diarios').insert({
          fecha,
          nombre_agency: agencyName,
          cajero_id: user?.id ? String(user.id) : null,
          user_id: user?.user_id || user?.id,
          sistema,
          monto_venta: 0,
          comision: 0,
          monto_premios: addedAmount,
          neto: -addedAmount,
          moneda,
          cerrado: false,
        });
      }
    } catch (e) {
      console.warn('Could not sync prize to cda_reportes_diarios:', e);
    }
  };

  const handleSaveBatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const validItems = loteTickets.filter((t) => t.serial.trim() && Number(t.monto) > 0);

    if (validItems.length === 0) {
      setErrorMsg('Debe ingresar al menos un ticket con número y monto válido mayor a 0');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let totalLote = 0;
      for (const item of validItems) {
        const itemMonto = Math.round(Number(item.monto) * 100) / 100;
        totalLote += itemMonto;

        await supabase.table('cda_premios_tickets').insert({
          fecha,
          agencia: agencyName,
          user_id: user?.user_id || user?.id,
          sistema,
          numero_ticket: item.serial.trim().toUpperCase(),
          monto: itemMonto,
          estado: 'RECLAMADO',
        });
      }

      await updateDailyReportPrizes(totalLote);

      confetti({ particleCount: 50, spread: 70, origin: { y: 0.7 } });
      setSuccessMsg(`Lote de ${validItems.length} tickets registrado exitosamente (${formatCurrency(totalLote, moneda)}).`);
      setLoteTickets([
        { serial: '', monto: '' },
        { serial: '', monto: '' },
        { serial: '', monto: '' },
      ]);
      fetchTickets();
    } catch (err: unknown) {
      console.error('Error saving batch:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar lote de tickets');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTicket = async (id?: number) => {
    if (!id || !window.confirm('¿Está seguro de eliminar este ticket premiado?')) return;
    try {
      const { error } = await supabase.table('cda_premios_tickets').delete().eq('id', id);
      if (error) throw error;
      setTickets((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Error deleting ticket:', err);
      alert('No se pudo eliminar el ticket.');
    }
  };

  const totalPremiosDia = tickets.reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Date filter & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Fecha de Sorteo:
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3">
          {isSupervisor && (
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={verTodos}
                onChange={(e) => setVerTodos(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Ver de TODOS los cajeros</span>
            </label>
          )}

          <button
            onClick={fetchTickets}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Total */}
      <div className="bg-[#0D1B22] border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
        <div>
          <div className="text-xs text-slate-400 font-semibold mb-1">
            Total Premios Pagados Registrados ({tickets.length} tickets)
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono">
            {formatCurrency(totalPremiosDia, moneda)}
          </div>
        </div>
        <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400 border border-purple-500/20">
          <Award className="w-6 h-6" />
        </div>
      </div>

      {/* Form Section */}
      {(!isDayClosed || isSupervisor) ? (
        <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Registrar Nuevo Ticket Premiado
            </h3>

            <button
              type="button"
              onClick={() => setModoLote(!modoLote)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition-colors cursor-pointer"
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>{modoLote ? 'Cambiar a Ticket Individual' : '📦 Ingresar por Lote (3 dígitos)'}</span>
            </button>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Sistema Asignado
              </label>
              <select
                value={sistema}
                onChange={(e) => setSistema(e.target.value)}
                className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
              >
                {assignedSystems.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Moneda Asignada
              </label>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
              >
                {assignedCurrencies.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {!modoLote ? (
            /* Single Ticket Form */
            <form onSubmit={handleCreateSingleTicket} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Número / Serial de Ticket
                </label>
                <input
                  type="text"
                  required
                  value={numeroTicket}
                  onChange={(e) => setNumeroTicket(e.target.value)}
                  placeholder="Ej. TK-9382 o 849201"
                  className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Monto del Premio
                </label>
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
              </div>

              <div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar Premio'}
                </button>
              </div>
            </form>
          ) : (
            /* Batch Mode Form */
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Ingrese los últimos 3 dígitos del serial y monto para cada ticket premiado:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {loteTickets.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-[#071217] p-2.5 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-500 font-bold">#{idx + 1}</span>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="Dígitos"
                      value={item.serial}
                      onChange={(e) => {
                        const copy = [...loteTickets];
                        copy[idx].serial = e.target.value.toUpperCase();
                        setLoteTickets(copy);
                      }}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Monto"
                      value={item.monto}
                      onChange={(e) => {
                        const copy = [...loteTickets];
                        copy[idx].monto = e.target.value === '' ? '' : parseFloat(e.target.value);
                        setLoteTickets(copy);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-right"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setLoteTickets([...loteTickets, { serial: '', monto: '' }])}
                  className="text-xs text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                >
                  + Agregar otra fila
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveBatch}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-2 px-5 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : '💾 Guardar Todo el Lote'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          🔒 La jornada de este día está cerrada. No se pueden registrar nuevos tickets a menos que el supervisor la reabra.
        </div>
      )}

      {/* Tickets Table */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Tickets Registrados del Día ({tickets.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                <th className="py-3 px-4 font-semibold">Nro Ticket</th>
                <th className="py-3 px-4 font-semibold">Sistema</th>
                <th className="py-3 px-4 font-semibold">Agencia</th>
                <th className="py-3 px-4 font-semibold text-right">Monto</th>
                <th className="py-3 px-4 font-semibold text-center">Estado</th>
                <th className="py-3 px-4 font-semibold text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No hay tickets premiados registrados para este día.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {t.numero_ticket}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {t.sistema}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {t.agencia}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-purple-400">
                      {formatCurrency(t.monto, t.moneda || moneda)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {t.estado || 'RECLAMADO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDeleteTicket(t.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Eliminar ticket"
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
