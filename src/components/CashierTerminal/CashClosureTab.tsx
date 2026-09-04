import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, getTodayDateString } from '../../utils/formatters';
import { printThermalReceipt } from '../../lib/thermalPrinter';
import { Calculator, CheckCircle2, AlertTriangle, RefreshCw, Printer, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

export const CashClosureTab: React.FC = () => {
  const { user, agency } = useAuth();
  const [fecha, setFecha] = useState(getTodayDateString());
  const [loading, setLoading] = useState(false);

  // Computed values from today's transactions
  const [saldoInicial, setSaldoInicial] = useState<number>(0);
  const [totalVentas, setTotalVentas] = useState<number>(0);
  const [totalPremios, setTotalPremios] = useState<number>(0);
  const [totalGastos, setTotalGastos] = useState<number>(0);
  const [totalBanco, setTotalBanco] = useState<number>(0);

  // Cashier Count
  const [efectivoFisico, setEfectivoFisico] = useState<number | ''>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [yaCerrado, setYaCerrado] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const agencyName = agency?.nombre_agencia || '';

  const calculateClosureData = useCallback(async () => {
    if (!agencyName) return;
    setLoading(true);

    try {
      // 1. Check if already closed today
      const { data: closureData } = await supabase
        .table('saldo_taquilla')
        .select('*')
        .eq('fecha', fecha)
        .ilike('nombre_agency', agencyName)
        .maybeSingle();

      if (closureData && closureData.cerrado) {
        setYaCerrado(true);
        setSaldoInicial(closureData.saldo_inicial || 0);
        setTotalVentas(closureData.total_ventas || 0);
        setTotalPremios(closureData.total_premios || 0);
        setTotalGastos(closureData.total_gastos || 0);
        setTotalBanco(closureData.total_banco || 0);
        setEfectivoFisico(closureData.total_efectivo || closureData.saldo_restante || 0);
        setObservaciones(closureData.observaciones || '');
        setLoading(false);
        return;
      }

      setYaCerrado(false);

      // 2. Query yesterday's remaining balance
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yStr = yesterdayDate.toISOString().slice(0, 10);

      const { data: yData } = await supabase
        .table('saldo_taquilla')
        .select('saldo_restante')
        .eq('fecha', yStr)
        .ilike('nombre_agency', agencyName)
        .maybeSingle();

      const initialVal = yData?.saldo_restante ? Number(yData.saldo_restante) : 0;
      setSaldoInicial(initialVal);

      // 3. Query Today Sales
      const { data: sData } = await supabase
        .table('cda_reportes_diarios')
        .select('monto_ventas, monto_anulaciones, monto_premios')
        .eq('fecha', fecha)
        .ilike('agencia', agencyName);

      const sumVentas = (sData || []).reduce(
        (acc: number, r: any) => acc + (Number(r.monto_ventas) || 0) - (Number(r.monto_anulaciones) || 0),
        0
      );
      const sumPremios = (sData || []).reduce(
        (acc: number, r: any) => acc + (Number(r.monto_premios) || 0),
        0
      );

      // Also sum from cda_pagos_diarios if cash
      const { data: pData } = await supabase
        .table('cda_pagos_diarios')
        .select('monto')
        .eq('fecha', fecha)
        .ilike('agencia', agencyName)
        .eq('metodo_pago', 'Efectivo');

      const sumPagosCash = (pData || []).reduce((acc: number, r: any) => acc + (Number(r.monto) || 0), 0);
      const finalPremios = Math.max(sumPremios, sumPagosCash);

      // 4. Query Today Expenses
      const { data: gData } = await supabase
        .table('cda_gastos_diarios')
        .select('monto')
        .eq('fecha', fecha)
        .ilike('agencia', agencyName);

      const sumGastos = (gData || []).reduce((acc: number, r: any) => acc + (Number(r.monto) || 0), 0);

      // 5. Query Today Bank Deposits
      const { data: bData } = await supabase
        .table('cda_pagos_bancarios')
        .select('monto')
        .eq('fecha', fecha)
        .ilike('agencia', agencyName);

      const sumBanco = (bData || []).reduce((acc: number, r: any) => acc + (Number(r.monto) || 0), 0);

      setTotalVentas(sumVentas);
      setTotalPremios(finalPremios);
      setTotalGastos(sumGastos);
      setTotalBanco(sumBanco);
    } catch (err) {
      console.error('Error calculating closure data:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyName, fecha]);

  useEffect(() => {
    calculateClosureData();
  }, [calculateClosureData]);

  // Calculations
  const saldoEsperado = saldoInicial + totalVentas - totalPremios - totalGastos - totalBanco;
  const fisicoNum = typeof efectivoFisico === 'number' ? efectivoFisico : 0;
  const diferencia = fisicoNum - saldoEsperado;

  const handlePrintClosure = () => {
    printThermalReceipt({
      titulo: 'MULTIBANCA EXPRESS',
      agencia: agencyName,
      terminal: user?.terminal_id ? String(user.terminal_id) : undefined,
      cajero: user?.nombre || 'Cajero',
      ticketNro: `CIERRE-${fecha}`,
      fecha,
      hora: new Date().toLocaleTimeString(),
      monto: fisicoNum,
      moneda: 'USD',
      metodoPago: 'ARQUEO EFECTIVO',
      concepto: `Cierre Diario de Caja\nIni: $${saldoInicial.toFixed(2)} | Vts: +$${totalVentas.toFixed(2)}\nPre: -$${totalPremios.toFixed(2)} | Gst: -$${totalGastos.toFixed(2)}\nBco: -$${totalBanco.toFixed(2)}\nDif: ${diferencia >= 0 ? '+' : ''}$${diferencia.toFixed(2)}`,
      qrPayload: `CIERRE|AG:${agencyName}|FEC:${fecha}|SALDO:${fisicoNum}|DIF:${diferencia}`,
    });
  };

  const handleCommitClosure = async () => {
    if (typeof efectivoFisico !== 'number') {
      alert('Por favor ingrese el total del conteo de efectivo físico.');
      return;
    }

    if (!window.confirm('¿Confirmar el cierre definitivo de caja para esta fecha?')) return;

    setSubmitting(true);

    try {
      const closureRecord = {
        fecha,
        nombre_agency: agencyName,
        cajero_id: user?.id,
        nombre_cajero: user?.nombre || user?.usuario,
        saldo_inicial: saldoInicial,
        total_ventas: totalVentas,
        total_premios: totalPremios,
        total_gastos: totalGastos,
        total_banco: totalBanco,
        total_efectivo: fisicoNum,
        saldo_restante: fisicoNum,
        sobrante_faltante: diferencia,
        cerrado: true,
        observaciones,
      };

      const { error } = await supabase
        .table('saldo_taquilla')
        .upsert(closureRecord, { onConflict: 'nombre_agency,fecha' });

      if (error) throw error;

      setYaCerrado(true);
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#00C853', '#38BDF8', '#F59E0B'],
      });

      alert('¡Cierre de caja guardado con éxito!');
      handlePrintClosure();
    } catch (err: unknown) {
      console.error('Error committing closure:', err);
      alert(err instanceof Error ? err.message : 'Error al guardar el cierre.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Date Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Fecha de Cierre:
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {yaCerrado && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" />
              Caja Cerrada
            </span>
          )}
          <button
            onClick={calculateClosureData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Recalcular</span>
          </button>
        </div>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1">Saldo Inicial</div>
          <div className="text-lg font-black text-slate-200 font-mono">
            {formatCurrency(saldoInicial, 'USD')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Caja anterior</div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1">(+) Ventas Netas</div>
          <div className="text-lg font-black text-emerald-400 font-mono">
            +{formatCurrency(totalVentas, 'USD')}
          </div>
          <div className="text-[10px] text-emerald-500/70 mt-1">Ingreso en efectivo</div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1">(-) Premios Pagados</div>
          <div className="text-lg font-black text-rose-400 font-mono">
            -{formatCurrency(totalPremios, 'USD')}
          </div>
          <div className="text-[10px] text-rose-500/70 mt-1">Salida de taquilla</div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1">(-) Gastos del Día</div>
          <div className="text-lg font-black text-amber-400 font-mono">
            -{formatCurrency(totalGastos, 'USD')}
          </div>
          <div className="text-[10px] text-amber-500/70 mt-1">Operación y papelería</div>
        </div>

        <div className="bg-[#0D1B22] border border-slate-800 p-4 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold mb-1">(-) Entregas a Banco</div>
          <div className="text-lg font-black text-sky-400 font-mono">
            -{formatCurrency(totalBanco, 'USD')}
          </div>
          <div className="text-[10px] text-sky-500/70 mt-1">Depósitos realizados</div>
        </div>
      </div>

      {/* Arqueo Comparison & Commit Section */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-6 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-emerald-400" />
          Arqueo de Efectivo Físico y Cuadre de Caja
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Expected Cash */}
          <div className="p-5 rounded-2xl bg-[#071217] border border-slate-800 text-center">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
              Saldo Teórico Esperado
            </div>
            <div className="text-3xl font-black text-white font-mono">
              {formatCurrency(saldoEsperado, 'USD')}
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              Calculado automáticamente por el sistema
            </div>
          </div>

          {/* Actual Cash Input */}
          <div className="p-5 rounded-2xl bg-[#071217] border border-slate-800">
            <label className="block text-xs text-emerald-400 font-bold uppercase tracking-wider mb-2 text-center">
              Efectivo Real en Gaveta ($)
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
              Total de billetes contados
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
              {formatCurrency(diferencia, 'USD')}
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
                  <span>Discrepancia detectada</span>
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
