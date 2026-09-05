import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, getTodayDateString, normalizarMoneda } from '../../utils/formatters';
import { printThermalReceipt } from '../../lib/thermalPrinter';
import { 
  Calculator, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Printer, 
  ShieldCheck, 
  Unlock, 
  Users,
  Coins
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CashierUser {
  id: string | number;
  usuario: string;
  nombre_cajero?: string;
  rol: string;
}

export const CashClosureTab: React.FC = () => {
  const { user, agency, assignedCurrencies } = useAuth();
  const [fecha, setFecha] = useState(getTodayDateString());
  const [selectedCurrency, setSelectedCurrency] = useState<string>(assignedCurrencies[0] || 'USD');
  const [loading, setLoading] = useState(false);

  // Supervisor cashier filter
  const isSupervisorOrAdmin = user?.rol === 'supervisor' || user?.rol === 'admin';
  const [cashiersList, setCashiersList] = useState<CashierUser[]>([]);
  const [selectedCashierId, setSelectedCashierId] = useState<string>('ALL');

  // Computed values from transactions
  const [saldoInicial, setSaldoInicial] = useState<number>(0);
  const [totalVentas, setTotalVentas] = useState<number>(0);
  const [totalComisiones, setTotalComisiones] = useState<number>(0);
  const [totalPremios, setTotalPremios] = useState<number>(0);
  const [totalGastos, setTotalGastos] = useState<number>(0);
  const [totalBanco, setTotalBanco] = useState<number>(0);

  // Cashier Count
  const [efectivoFisico, setEfectivoFisico] = useState<number | ''>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [yaCerrado, setYaCerrado] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const agencyName = agency?.nombre_agencia || '';

  // Update selectedCurrency if assignedCurrencies changes
  useEffect(() => {
    if (assignedCurrencies.length > 0 && !assignedCurrencies.includes(selectedCurrency)) {
      setSelectedCurrency(assignedCurrencies[0]);
    }
  }, [assignedCurrencies, selectedCurrency]);

  // Load cashiers list for supervisors
  useEffect(() => {
    if (isSupervisorOrAdmin) {
      const loadCashiers = async () => {
        try {
          const { data } = await supabase
            .table('taquilla_usuarios')
            .select('id, usuario, nombre_cajero, rol')
            .eq('rol', 'cajero');
          setCashiersList(data || []);
        } catch (e) {
          console.error('Error loading cashiers for supervisor closure:', e);
        }
      };
      loadCashiers();
    }
  }, [isSupervisorOrAdmin]);

  const calculateClosureData = useCallback(async () => {
    if (!agencyName) return;
    setLoading(true);

    try {
      // Target cashier ID (if supervisor selected ALL, filter is empty)
      const targetCajeroId = !isSupervisorOrAdmin ? user?.id : (selectedCashierId !== 'ALL' ? selectedCashierId : null);

      // 1. Check if already closed today
      let qClosure = supabase
        .table('saldo_taquilla')
        .select('*')
        .eq('fecha', fecha)
        .ilike('nombre_agency', agencyName);

      if (targetCajeroId) {
        qClosure = qClosure.eq('cajero_id', String(targetCajeroId));
      }

      const { data: closureDataList } = await qClosure;
      const closureData = closureDataList && closureDataList.length > 0 ? closureDataList[0] : null;

      // 2. Also check cda_reportes_diarios cerrado status
      let qRepCerrado = supabase
        .table('cda_reportes_diarios')
        .select('cerrado')
        .eq('fecha', fecha)
        .ilike('nombre_agency', agencyName)
        .eq('cerrado', true);

      if (targetCajeroId) {
        qRepCerrado = qRepCerrado.eq('cajero_id', String(targetCajeroId));
      }
      const { data: repCerradoList } = await qRepCerrado.limit(1);
      const isDayClosed = (closureData && closureData.saldo_restante !== undefined) || (repCerradoList && repCerradoList.length > 0);

      setYaCerrado(Boolean(isDayClosed));

      if (closureData && closureData.cerrado) {
        setSaldoInicial(Number(closureData.saldo_inicial) || 0);
        setTotalVentas(Number(closureData.total_ventas) || 0);
        setTotalPremios(Number(closureData.total_premios) || 0);
        setTotalGastos(Number(closureData.total_gastos) || 0);
        setTotalBanco(Number(closureData.total_banco) || 0);
        setEfectivoFisico(Number(closureData.total_efectivo || closureData.saldo_restante || 0));
        setObservaciones(closureData.observaciones || '');
        setLoading(false);
        return;
      }

      // 3. Query yesterday's remaining balance
      const yesterdayDate = new Date(fecha + 'T12:00:00');
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yStr = yesterdayDate.toISOString().slice(0, 10);

      let qYesterday = supabase
        .table('saldo_taquilla')
        .select('saldo_restante')
        .eq('fecha', yStr)
        .ilike('nombre_agency', agencyName);

      if (targetCajeroId) {
        qYesterday = qYesterday.eq('cajero_id', String(targetCajeroId));
      }

      const { data: yData } = await qYesterday.maybeSingle();
      const initialVal = yData?.saldo_restante ? Number(yData.saldo_restante) : 0;
      setSaldoInicial(initialVal);

      // 4. Query Today Sales from cda_reportes_diarios
      let qSales = supabase
        .table('cda_reportes_diarios')
        .select('monto_venta, comision, monto_premios, moneda, cajero_id')
        .eq('fecha', fecha)
        .ilike('nombre_agency', agencyName);

      if (targetCajeroId) {
        qSales = qSales.eq('cajero_id', String(targetCajeroId));
      }

      const { data: sData } = await qSales;
      const salesFiltered = (sData || []).filter(
        (r: any) => normalizarMoneda(r.moneda) === selectedCurrency
      );

      const sumVentas = salesFiltered.reduce(
        (acc: number, r: any) => acc + (Number(r.monto_venta) || 0),
        0
      );
      const sumComisiones = salesFiltered.reduce(
        (acc: number, r: any) => acc + (Number(r.comision) || 0),
        0
      );
      const sumPremiosRep = salesFiltered.reduce(
        (acc: number, r: any) => acc + (Number(r.monto_premios) || 0),
        0
      );

      // 5. Query Today Awarded Tickets (cda_premios_tickets)
      let qTickets = supabase
        .table('cda_premios_tickets')
        .select('monto, moneda, cajero_id')
        .eq('fecha', fecha)
        .ilike('agencia', agencyName);

      if (targetCajeroId) {
        qTickets = qTickets.eq('cajero_id', String(targetCajeroId));
      }

      const { data: tData } = await qTickets;
      const ticketsFiltered = (tData || []).filter(
        (r: any) => normalizarMoneda(r.moneda) === selectedCurrency
      );
      const sumPremiosTickets = ticketsFiltered.reduce(
        (acc: number, r: any) => acc + (Number(r.monto) || 0),
        0
      );
      const finalPremios = Math.max(sumPremiosRep, sumPremiosTickets);

      // 6. Query Today Expenses
      let qExpenses = supabase
        .table('cda_gastos_diarios')
        .select('monto, moneda, cajero_id')
        .eq('fecha', fecha)
        .ilike('agencia', agencyName);

      if (targetCajeroId) {
        qExpenses = qExpenses.eq('cajero_id', String(targetCajeroId));
      }

      const { data: gData } = await qExpenses;
      const expensesFiltered = (gData || []).filter(
        (r: any) => normalizarMoneda(r.moneda) === selectedCurrency
      );
      const sumGastos = expensesFiltered.reduce(
        (acc: number, r: any) => acc + (Number(r.monto) || 0),
        0
      );

      // 7. Query Today Bank Deposits / Deliveries
      let qBank = supabase
        .table('cda_pagos_bancarios')
        .select('monto, moneda, cajero_id')
        .eq('fecha', fecha)
        .ilike('agencia', agencyName);

      if (targetCajeroId) {
        qBank = qBank.eq('cajero_id', String(targetCajeroId));
      }

      const { data: bData } = await qBank;
      const bankFiltered = (bData || []).filter(
        (r: any) => normalizarMoneda(r.moneda) === selectedCurrency
      );
      const sumBanco = bankFiltered.reduce(
        (acc: number, r: any) => acc + (Number(r.monto) || 0),
        0
      );

      setTotalVentas(sumVentas);
      setTotalComisiones(sumComisiones);
      setTotalPremios(finalPremios);
      setTotalGastos(sumGastos);
      setTotalBanco(sumBanco);
    } catch (err) {
      console.error('Error calculating closure data:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyName, fecha, selectedCurrency, selectedCashierId, isSupervisorOrAdmin, user?.id]);

  useEffect(() => {
    calculateClosureData();
  }, [calculateClosureData]);

  // Calculations matching taquilla.py:
  // Saldo Esperado = Saldo Inicial + Ventas - Comisiones - Premios - Gastos - Entregas/Banco
  const saldoEsperado = saldoInicial + totalVentas - totalComisiones - totalPremios - totalGastos - totalBanco;
  const fisicoNum = typeof efectivoFisico === 'number' ? efectivoFisico : 0;
  const diferencia = fisicoNum - saldoEsperado;

  const handlePrintClosure = () => {
    printThermalReceipt({
      titulo: 'MULTIBANCA EXPRESS',
      agencia: agencyName,
      terminal: user?.terminal_id ? String(user.terminal_id) : undefined,
      cajero: user?.nombre || user?.usuario || 'Cajero',
      ticketNro: `CIERRE-${fecha}-${selectedCurrency}`,
      fecha,
      hora: new Date().toLocaleTimeString(),
      monto: fisicoNum,
      moneda: selectedCurrency,
      metodoPago: 'ARQUEO EFECTIVO',
      concepto: `Cierre de Caja (${selectedCurrency})\nIni: ${formatCurrency(saldoInicial, selectedCurrency)}\nVts: +${formatCurrency(totalVentas, selectedCurrency)}\nCom: -${formatCurrency(totalComisiones, selectedCurrency)}\nPre: -${formatCurrency(totalPremios, selectedCurrency)}\nGst: -${formatCurrency(totalGastos, selectedCurrency)}\nBco: -${formatCurrency(totalBanco, selectedCurrency)}\nEsp: ${formatCurrency(saldoEsperado, selectedCurrency)}\nFis: ${formatCurrency(fisicoNum, selectedCurrency)}\nDif: ${diferencia >= 0 ? '+' : ''}${formatCurrency(diferencia, selectedCurrency)}`,
      qrPayload: `CIERRE|AG:${agencyName}|FEC:${fecha}|MON:${selectedCurrency}|SALDO:${fisicoNum}|DIF:${diferencia}`,
    });
  };

  const handleCommitClosure = async () => {
    if (typeof efectivoFisico !== 'number') {
      alert('Por favor ingrese el total del conteo de efectivo físico en gaveta.');
      return;
    }

    if (!window.confirm(`¿Confirmar el cierre de caja (${selectedCurrency}) para la fecha ${fecha}?`)) return;

    setSubmitting(true);

    try {
      const targetCajeroId = !isSupervisorOrAdmin ? user?.id : (selectedCashierId !== 'ALL' ? selectedCashierId : user?.id);

      const closureRecord: any = {
        nombre_agency: agencyName,
        fecha,
        cajero_id: targetCajeroId ? String(targetCajeroId) : null,
        saldo_restante: fisicoNum,
      };

      // 1. Upsert into saldo_taquilla
      const { error: errSaldo } = await supabase
        .table('saldo_taquilla')
        .upsert(closureRecord, { onConflict: 'nombre_agency,fecha,cajero_id' });

      if (errSaldo) {
        // Fallback without conflict keys if different constraints
        await supabase.table('saldo_taquilla').upsert(closureRecord);
      }

      // 2. Mark cda_reportes_diarios as cerrado: true
      let qUpdateRep = supabase
        .table('cda_reportes_diarios')
        .update({ cerrado: true })
        .eq('fecha', fecha)
        .ilike('nombre_agency', agencyName);

      if (targetCajeroId) {
        qUpdateRep = qUpdateRep.eq('cajero_id', String(targetCajeroId));
      }
      await qUpdateRep;

      setYaCerrado(true);
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#00C853', '#38BDF8', '#F59E0B'],
      });

      alert(`¡Cierre de caja en ${selectedCurrency} completado exitosamente!`);
      handlePrintClosure();
    } catch (err: unknown) {
      console.error('Error committing closure:', err);
      alert(err instanceof Error ? err.message : 'Error al guardar el cierre.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopenDay = async () => {
    if (!window.confirm(`¿Está seguro de REABRIR la jornada del ${fecha}? Esto desbloqueará las pantallas para ingresar ventas y gastos.`)) return;

    setSubmitting(true);
    try {
      const targetCajeroId = !isSupervisorOrAdmin ? user?.id : (selectedCashierId !== 'ALL' ? selectedCashierId : null);

      // 1. Update cda_reportes_diarios cerrado = false
      let qRep = supabase
        .table('cda_reportes_diarios')
        .update({ cerrado: false })
        .eq('fecha', fecha)
        .ilike('nombre_agency', agencyName);

      if (targetCajeroId) {
        qRep = qRep.eq('cajero_id', String(targetCajeroId));
      }
      await qRep;

      // 2. Delete or update saldo_taquilla
      let qSaldo = supabase
        .table('saldo_taquilla')
        .delete()
        .eq('fecha', fecha)
        .ilike('nombre_agency', agencyName);

      if (targetCajeroId) {
        qSaldo = qSaldo.eq('cajero_id', String(targetCajeroId));
      }
      await qSaldo;

      setYaCerrado(false);
      setEfectivoFisico('');
      alert(`✅ La jornada del ${fecha} ha sido reabierta exitosamente.`);
      calculateClosureData();
    } catch (err: unknown) {
      console.error('Error reopening day:', err);
      alert(err instanceof Error ? err.message : 'Error al reabrir la jornada.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar: Date, Currency & Supervisor Cashier Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Fecha:
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Moneda:
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-400 focus:outline-none focus:border-emerald-500"
            >
              {assignedCurrencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {isSupervisorOrAdmin && cashiersList.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Cajero:
              </label>
              <select
                value={selectedCashierId}
                onChange={(e) => setSelectedCashierId(e.target.value)}
                className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">👥 TODOS LOS CAJEROS</option>
                {cashiersList.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    👤 {c.nombre_cajero || c.usuario}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {yaCerrado ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" />
              Jornada Cerrada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              🟢 Jornada Abierta
            </span>
          )}

          <button
            onClick={calculateClosureData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Recalcular</span>
          </button>
        </div>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1">Saldo Inicial</div>
          <div className="text-base font-black text-slate-200 font-mono">
            {formatCurrency(saldoInicial, selectedCurrency)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Caja anterior</div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1">(+) Ventas Brutas</div>
          <div className="text-base font-black text-emerald-400 font-mono">
            +{formatCurrency(totalVentas, selectedCurrency)}
          </div>
          <div className="text-[10px] text-emerald-500/70 mt-1">Ingreso en taquilla</div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1">(-) Comisión Ag.</div>
          <div className="text-base font-black text-slate-300 font-mono">
            -{formatCurrency(totalComisiones, selectedCurrency)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Comisión retenida</div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1">(-) Premios Pag.</div>
          <div className="text-base font-black text-rose-400 font-mono">
            -{formatCurrency(totalPremios, selectedCurrency)}
          </div>
          <div className="text-[10px] text-rose-500/70 mt-1">Salida por premios</div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1">(-) Gastos</div>
          <div className="text-base font-black text-amber-400 font-mono">
            -{formatCurrency(totalGastos, selectedCurrency)}
          </div>
          <div className="text-[10px] text-amber-500/70 mt-1">Operación y papelería</div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1">(-) Banco / Rutas</div>
          <div className="text-base font-black text-sky-400 font-mono">
            -{formatCurrency(totalBanco, selectedCurrency)}
          </div>
          <div className="text-[10px] text-sky-500/70 mt-1">Depósitos / cobrador</div>
        </div>
      </div>

      {/* Arqueo Comparison & Commit Section */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-6 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-emerald-400" />
          Arqueo de Efectivo Físico & Cuadre de Caja ({selectedCurrency})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Expected Cash */}
          <div className="p-5 rounded-2xl bg-[#071217] border border-slate-800 text-center">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
              Saldo Teórico Esperado
            </div>
            <div className="text-3xl font-black text-white font-mono">
              {formatCurrency(saldoEsperado, selectedCurrency)}
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              Calculado automáticamente según transacciones
            </div>
          </div>

          {/* Actual Cash Input */}
          <div className="p-5 rounded-2xl bg-[#071217] border border-slate-800">
            <label className="block text-xs text-emerald-400 font-bold uppercase tracking-wider mb-2 text-center">
              Efectivo Real en Gaveta ({selectedCurrency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              disabled={yaCerrado}
              value={efectivoFisico}
              onChange={(e) => setEfectivoFisico(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="0.00"
              className="w-full bg-[#0D1B22] border border-emerald-500/50 rounded-xl px-4 py-3 text-2xl font-black text-emerald-400 font-mono text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75"
            />
            <div className="text-[11px] text-slate-500 mt-2 text-center">
              Total de billetes contados en caja
            </div>
          </div>

          {/* Difference & Status */}
          <div className={`p-5 rounded-2xl border text-center ${
            Math.abs(diferencia) < 0.01
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : diferencia > 0
              ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2">
              {Math.abs(diferencia) < 0.01
                ? 'Caja Cuadrada'
                : diferencia > 0
                ? 'Sobrante en Caja'
                : 'Faltante en Caja'}
            </div>
            <div className="text-3xl font-black font-mono">
              {diferencia >= 0 ? '+' : ''}
              {formatCurrency(diferencia, selectedCurrency)}
            </div>
            <div className="text-[11px] opacity-80 mt-2 flex items-center justify-center gap-1">
              {Math.abs(diferencia) < 0.01 ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sin discrepancias registradas</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Discrepancia en arqueo</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Observations input */}
        <div className="mt-6">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">
            Observaciones o Comentarios del Cierre
          </label>
          <textarea
            rows={2}
            disabled={yaCerrado}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej. Cierre de turno sin novedades, remesa entregada en sobre..."
            className="w-full bg-[#071217] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-60"
          />
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={handlePrintClosure}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Imprimir Respaldo Térmico (58mm)</span>
          </button>

          {isSupervisorOrAdmin && yaCerrado && (
            <button
              onClick={handleReopenDay}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <Unlock className="w-4 h-4" />
              <span>{submitting ? 'Reabriendo...' : '🔓 Reabrir Día (Supervisor)'}</span>
            </button>
          )}

          {!yaCerrado && (
            <button
              onClick={handleCommitClosure}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{submitting ? 'Guardando Cierre...' : 'Cerrar Caja Definitivamente'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
