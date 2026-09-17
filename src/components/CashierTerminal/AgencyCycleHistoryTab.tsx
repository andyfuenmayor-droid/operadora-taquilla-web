import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, normalizarMoneda } from '../../utils/formatters';
import {
  Layers,
  RefreshCw,
  Printer,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  X
} from 'lucide-react';

interface CycleHistoryRow {
  id: string;
  tipo_periodo: 'semanal' | 'mensual';
  periodo_label: string;
  rango_fechas: string;
  fecha_desde: string;
  fecha_hasta: string;
  arrastre_inicial: number;
  venta_neta: number;
  efectivo_qr: number;
  bancos: number;
  reposicion_premios: number;
  gastos: number;
  saldo_final: number;
  is_active_cycle: boolean;
  status: 'pagado' | 'pendiente' | 'favor';
  vouchers: {
    cobradores_qr: any[];
    bancos: any[];
    gastos: any[];
    reposicion_premios: any[];
    ventas_sistemas: any[];
  };
}

export const AgencyCycleHistoryTab: React.FC = () => {
  const { agency, systemCycle } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<'BS' | 'USD' | 'COP'>('COP');
  const [periodicity, setPeriodicity] = useState<'semanal' | 'mensual'>('semanal');

  // Agency data
  const targetAgencyName = useMemo(() => {
    return (agency?.nombre_agencia || '').trim().toUpperCase();
  }, [agency]);

  const [agencyData, setAgencyData] = useState<any | null>(null);
  const [closures, setClosures] = useState<any[]>([]);
  const [activeSales, setActiveSales] = useState<any[]>([]);
  const [rawDailyPayments, setRawDailyPayments] = useState<any[]>([]);
  const [rawBankPayments, setRawBankPayments] = useState<any[]>([]);
  const [rawDailyExpenses, setRawDailyExpenses] = useState<any[]>([]);
  const [rawManualPayments, setRawManualPayments] = useState<any[]>([]);

  // Selected drilldown row
  const [selectedDrilldownRow, setSelectedDrilldownRow] = useState<CycleHistoryRow | null>(null);

  const loadData = async () => {
    if (!targetAgencyName) return;
    setIsLoading(true);

    try {
      const [
        agRes,
        cRes,
        sRes,
        pdRes,
        pbRes,
        gdRes,
        psRes
      ] = await Promise.all([
        supabase.from('agencias').select('*').ilike('nombre_agencia', targetAgencyName).limit(1),
        supabase.from('cierres_semanales').select('*').ilike('entidad', targetAgencyName).order('fecha_cierre', { ascending: false }),
        supabase.from('carga_actual').select('*').ilike('agencia', targetAgencyName),
        supabase.from('cda_pagos_diarios').select('*').or(`agencia.ilike.${targetAgencyName},nombre_agency.ilike.${targetAgencyName}`),
        supabase.from('cda_pagos_bancarios').select('*').ilike('agencia', targetAgencyName).eq('confirmado', true),
        supabase.from('cda_gastos_diarios').select('*').or(`agencia.ilike.${targetAgencyName},nombre_agency.ilike.${targetAgencyName}`),
        supabase.from('pagos_semana').select('*').ilike('agencia', targetAgencyName),
      ]);

      const agObj = agRes.data && agRes.data.length > 0 ? agRes.data[0] : null;
      setAgencyData(agObj);
      setClosures(cRes.data || []);
      setActiveSales(sRes.data || []);
      setRawDailyPayments(pdRes.data || []);
      setRawBankPayments(pbRes.data || []);
      setRawDailyExpenses(gdRes.data || []);
      setRawManualPayments(psRes.data || []);
    } catch (err) {
      console.error('Error loading agency history data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (!targetAgencyName) return;

    const channel = supabase
      .channel('realtime_taquilla_agency_history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cierres_semanales' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cda_pagos_diarios' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cda_pagos_bancarios' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cda_gastos_diarios' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos_semana' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agencias' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetAgencyName]);

  // Compute Weekly Rows
  const weeklyHistoryRows = useMemo<CycleHistoryRow[]>(() => {
    if (!targetAgencyName) return [];

    const mon = selectedCurrency;
    const colIni = mon === 'BS' ? 'saldo_inicial_bs' : mon === 'USD' ? 'saldo_inicial_usd' : 'saldo_inicial_cop';
    const list: CycleHistoryRow[] = [];

    // 1. ACTIVE CYCLE ROW
    const curArrastre = agencyData ? (Math.abs(Number(agencyData[colIni] || 0)) < 0.0001 ? 0 : Number(agencyData[colIni] || 0)) : 0;

    const agActiveSales = activeSales.filter((s) => normalizarMoneda(s.moneda) === mon);
    const activeVentaNeta = agActiveSales.reduce((sum, curr) => sum + Number(curr.neto || curr.util_op || 0), 0);

    const cycleDesde = systemCycle?.desde || '';
    const cycleHasta = systemCycle?.hasta || '';

    // Active daily QR & cash
    const agCobradorList = rawDailyPayments.filter((p) => {
      const matchMon = normalizarMoneda(p.moneda) === mon;
      const isCob = Boolean(p.qr_token) || String(p.tipo_pago || '').toUpperCase().includes('COBRADOR');
      const isConf = Boolean(p.confirmado) || Boolean(p.confirmado_supervisor) || Boolean(p.fecha_escaneo_cobrador);
      const fStr = String(p.fecha || p.created_at || '').slice(0, 10);
      const inCycle = (!cycleDesde || fStr >= cycleDesde) && (!cycleHasta || fStr <= cycleHasta);
      return matchMon && isCob && isConf && inCycle && !p.rechazado;
    });
    const cobradorTot = agCobradorList.reduce((sum, curr) => sum + Number(curr.monto || 0), 0);

    const agEfectivoList = rawDailyPayments.filter((p) => {
      const matchMon = normalizarMoneda(p.moneda) === mon;
      const isCob = Boolean(p.qr_token) || String(p.tipo_pago || '').toUpperCase().includes('COBRADOR');
      const isConf = Boolean(p.confirmado) || Boolean(p.confirmado_supervisor);
      const fStr = String(p.fecha || p.created_at || '').slice(0, 10);
      const inCycle = (!cycleDesde || fStr >= cycleDesde) && (!cycleHasta || fStr <= cycleHasta);
      return matchMon && !isCob && isConf && inCycle && !p.rechazado;
    });
    const rawEfectivoTot = agEfectivoList.reduce((sum, curr) => sum + Number(curr.monto || 0), 0);
    const efectivoRemanente = Math.max(0, rawEfectivoTot - cobradorTot);
    const totalEfectivoQR = cobradorTot + efectivoRemanente;

    // Active bank transfers
    const agBankList = rawBankPayments.filter((p) => {
      const matchMon = normalizarMoneda(p.moneda) === mon;
      const fStr = String(p.fecha || p.created_at || '').slice(0, 10);
      const inCycle = (!cycleDesde || fStr >= cycleDesde) && (!cycleHasta || fStr <= cycleHasta);
      return matchMon && inCycle && !p.rechazado;
    });
    const bancosTot = agBankList.reduce((sum, curr) => sum + Number(curr.monto || 0), 0);

    // Active prize replenishments
    const agManualPrem = rawManualPayments.filter((p) => {
      const matchMon = normalizarMoneda(p.moneda) === mon;
      const isPrem = String(p.tipo_pago || '').toUpperCase().includes('PREMIO') || String(p.referencia || '').toUpperCase().includes('PREMIO');
      return matchMon && isPrem && !p.rechazado;
    });
    const reposicionPremiosTot = agManualPrem.reduce((sum, curr) => sum + Number(curr.monto || 0), 0);

    // Active expenses
    const agExpList = rawDailyExpenses.filter((g) => {
      const matchMon = normalizarMoneda(g.moneda) === mon;
      const fStr = String(g.fecha || g.created_at || '').slice(0, 10);
      const inCycle = (!cycleDesde || fStr >= cycleDesde) && (!cycleHasta || fStr <= cycleHasta);
      return matchMon && inCycle && (g.confirmado || g.confirmado_supervisor) && !g.rechazado;
    });
    const gastosTot = agExpList.reduce((sum, curr) => sum + Number(curr.monto || 0), 0);

    const activeFinal = Math.round((curArrastre + activeVentaNeta - totalEfectivoQR - bancosTot + reposicionPremiosTot - gastosTot) * 100) / 100;

    let activeStatus: 'pagado' | 'pendiente' | 'favor' = 'pagado';
    if (Math.abs(activeFinal) < 0.1) activeStatus = 'pagado';
    else if (activeFinal > 0) activeStatus = 'pendiente';
    else activeStatus = 'favor';

    list.push({
      id: `active_sem_${systemCycle?.semana || 'actual'}`,
      tipo_periodo: 'semanal',
      periodo_label: `Semana ${systemCycle?.semana || 'Actual'} (Ciclo Abierto)`,
      rango_fechas: `${systemCycle?.desde || ''} al ${systemCycle?.hasta || ''}`,
      fecha_desde: systemCycle?.desde || '',
      fecha_hasta: systemCycle?.hasta || '',
      arrastre_inicial: curArrastre,
      venta_neta: activeVentaNeta,
      efectivo_qr: totalEfectivoQR,
      bancos: bancosTot,
      reposicion_premios: reposicionPremiosTot,
      gastos: gastosTot,
      saldo_final: activeFinal,
      is_active_cycle: true,
      status: activeStatus,
      vouchers: {
        cobradores_qr: agCobradorList,
        bancos: agBankList,
        gastos: agExpList,
        reposicion_premios: agManualPrem,
        ventas_sistemas: agActiveSales,
      },
    });

    // 2. CLOSED CYCLES
    const pastClosures = closures.filter((c) => normalizarMoneda(c.moneda) === mon);

    pastClosures.forEach((c) => {
      const cFinal = Number(c.saldo_final || 0);
      let cStatus: 'pagado' | 'pendiente' | 'favor' = 'pagado';
      if (Math.abs(cFinal) < 0.1) cStatus = 'pagado';
      else if (cFinal > 0) cStatus = 'pendiente';
      else cStatus = 'favor';

      let pDesde = '', pHasta = '';
      if (c.periodo && c.periodo.includes(' al ')) {
        const parts = c.periodo.split(' al ');
        pDesde = parts[0].trim();
        pHasta = parts[1].trim();
      }

      const histCob = rawDailyPayments.filter((p) => {
        const matchMon = normalizarMoneda(p.moneda) === mon;
        const fStr = String(p.fecha || p.created_at || '').slice(0, 10);
        const inCycle = (!pDesde || fStr >= pDesde) && (!pHasta || fStr <= pHasta);
        return matchMon && inCycle && !p.rechazado;
      });

      const histBank = rawBankPayments.filter((p) => {
        const matchMon = normalizarMoneda(p.moneda) === mon;
        const fStr = String(p.fecha || p.created_at || '').slice(0, 10);
        const inCycle = (!pDesde || fStr >= pDesde) && (!pHasta || fStr <= pHasta);
        return matchMon && inCycle && !p.rechazado;
      });

      const histExp = rawDailyExpenses.filter((g) => {
        const matchMon = normalizarMoneda(g.moneda) === mon;
        const fStr = String(g.fecha || g.created_at || '').slice(0, 10);
        const inCycle = (!pDesde || fStr >= pDesde) && (!pHasta || fStr <= pHasta);
        return matchMon && inCycle && !g.rechazado;
      });

      const arrPast = Math.abs(Number(c.saldo_anterior || 0)) < 0.0001 ? 0 : Number(c.saldo_anterior || 0);
      const vtaPast = Number(c.utilidad_semana || 0);
      const gasPast = Number(c.gastos || 0);
      const movPast = Number(c.movimientos || 0);
      const pastCobTot = histCob.reduce((sum, curr) => sum + Number(curr.monto || 0), 0);
      const pastBankTot = histBank.reduce((sum, curr) => sum + Number(curr.monto || 0), 0);

      list.push({
        id: `closed_${c.id}`,
        tipo_periodo: 'semanal',
        periodo_label: c.periodo ? `Ciclo ${c.periodo}` : `Cierre ${formatDate(c.fecha_cierre)}`,
        rango_fechas: c.periodo || formatDate(c.fecha_cierre),
        fecha_desde: pDesde,
        fecha_hasta: pHasta,
        arrastre_inicial: arrPast,
        venta_neta: vtaPast,
        efectivo_qr: pastCobTot,
        bancos: pastBankTot > 0 ? pastBankTot : Math.max(0, -movPast - pastCobTot - gasPast),
        reposicion_premios: Math.max(0, movPast + pastCobTot + pastBankTot + gasPast),
        gastos: gasPast,
        saldo_final: cFinal,
        is_active_cycle: false,
        status: cStatus,
        vouchers: {
          cobradores_qr: histCob,
          bancos: histBank,
          gastos: histExp,
          reposicion_premios: [],
          ventas_sistemas: [],
        },
      });
    });

    return list;
  }, [
    targetAgencyName,
    agencyData,
    selectedCurrency,
    activeSales,
    rawDailyPayments,
    rawBankPayments,
    rawDailyExpenses,
    rawManualPayments,
    closures,
    systemCycle,
  ]);

  // Compute Monthly Rows
  const monthlyHistoryRows = useMemo<CycleHistoryRow[]>(() => {
    if (weeklyHistoryRows.length === 0) return [];

    const monthMap = new Map<string, CycleHistoryRow[]>();

    weeklyHistoryRows.forEach((row) => {
      const dateKey = row.fecha_desde || row.fecha_hasta || '';
      const ym = dateKey.length >= 7 ? dateKey.slice(0, 7) : '2026-09';
      if (!monthMap.has(ym)) monthMap.set(ym, []);
      monthMap.get(ym)!.push(row);
    });

    const months: CycleHistoryRow[] = [];

    monthMap.forEach((rowsInMonth, ym) => {
      const sorted = [...rowsInMonth].sort((a, b) => (a.fecha_desde || '').localeCompare(b.fecha_desde || ''));
      const oldestRow = sorted[0];
      const newestRow = sorted[sorted.length - 1];

      const [yStr, mStr] = ym.split('-');
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      const mIndex = parseInt(mStr, 10) - 1;
      const mName = monthNames[mIndex] || ym;
      const monthLabel = `${mName} ${yStr}`;

      const totalVenta = sorted.reduce((sum, r) => sum + r.venta_neta, 0);
      const totalEf = sorted.reduce((sum, r) => sum + r.efectivo_qr, 0);
      const totalBan = sorted.reduce((sum, r) => sum + r.bancos, 0);
      const totalPrem = sorted.reduce((sum, r) => sum + r.reposicion_premios, 0);
      const totalG = sorted.reduce((sum, r) => sum + r.gastos, 0);
      const saldoIniMonth = oldestRow.arrastre_inicial;
      const saldoFinMonth = newestRow.saldo_final;

      let mStatus: 'pagado' | 'pendiente' | 'favor' = 'pagado';
      if (Math.abs(saldoFinMonth) < 0.1) mStatus = 'pagado';
      else if (saldoFinMonth > 0) mStatus = 'pendiente';
      else mStatus = 'favor';

      months.push({
        id: `month_${ym}`,
        tipo_periodo: 'mensual',
        periodo_label: monthLabel,
        rango_fechas: `${ym}-01 al fin de mes (${sorted.length} semanas)`,
        fecha_desde: `${ym}-01`,
        fecha_hasta: `${ym}-31`,
        arrastre_inicial: saldoIniMonth,
        venta_neta: totalVenta,
        efectivo_qr: totalEf,
        bancos: totalBan,
        reposicion_premios: totalPrem,
        gastos: totalG,
        saldo_final: saldoFinMonth,
        is_active_cycle: sorted.some((r) => r.is_active_cycle),
        status: mStatus,
        vouchers: {
          cobradores_qr: sorted.flatMap((r) => r.vouchers.cobradores_qr),
          bancos: sorted.flatMap((r) => r.vouchers.bancos),
          gastos: sorted.flatMap((r) => r.vouchers.gastos),
          reposicion_premios: sorted.flatMap((r) => r.vouchers.reposicion_premios),
          ventas_sistemas: sorted.flatMap((r) => r.vouchers.ventas_sistemas),
        },
      });
    });

    return months.sort((a, b) => (b.fecha_desde || '').localeCompare(a.fecha_desde || ''));
  }, [weeklyHistoryRows]);

  const activeRows = periodicity === 'semanal' ? weeklyHistoryRows : monthlyHistoryRows;

  // Thermal receipt print handler
  const handlePrintThermalTicket = () => {
    if (activeRows.length === 0) return;
    const latest = activeRows[0];

    const printContainer = document.getElementById('thermal-printable-area');
    if (!printContainer) {
      window.print();
      return;
    }

    printContainer.innerHTML = `
      <div style="font-family: monospace; font-size: 11px; width: 58mm; padding: 4px; line-height: 1.2;">
        <div style="text-align: center; font-weight: bold; margin-bottom: 4px;">
          MULTIBANCA EXPRESS<br/>
          ESTADO DE CUENTA TAQUILLA
        </div>
        <div>Agencia: ${targetAgencyName}</div>
        <div>Moneda: ${selectedCurrency}</div>
        <div>Fecha: ${new Date().toLocaleDateString('es-VE')}</div>
        <div>--------------------------------</div>
        <div>Periodo: ${latest.periodo_label}</div>
        <div>Arrastre: ${latest.arrastre_inicial.toFixed(2)}</div>
        <div>Venta Neta: ${latest.venta_neta.toFixed(2)}</div>
        <div>Efectivo QR: -${latest.efectivo_qr.toFixed(2)}</div>
        <div>Banco: -${latest.bancos.toFixed(2)}</div>
        <div>Gastos: -${latest.gastos.toFixed(2)}</div>
        <div>--------------------------------</div>
        <div style="font-weight: bold; font-size: 13px;">
          SALDO: ${latest.saldo_final.toFixed(2)} ${selectedCurrency}
        </div>
        <div style="text-align: center; margin-top: 8px;">
          ¡Gracias por su preferencia!
        </div>
      </div>
    `;

    window.print();
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Top Controls Card */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span>Historial de Movimientos</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {targetAgencyName}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Auditoría de ganancias, entregas en efectivo, transferencias bancarias y saldo acumulado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintThermalTicket}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir Ticket
            </button>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Currency & Periodicity Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
          {/* Currency Tabs */}
          <div className="flex items-center bg-[#071217] p-1 rounded-xl border border-slate-700 w-full sm:w-auto">
            {(['COP', 'BS', 'USD'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSelectedCurrency(m)}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCurrency === m
                    ? 'bg-emerald-500 text-slate-950 shadow font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'COP' ? '🟡 COP' : m === 'BS' ? '🔵 BS' : '🟢 USD'}
              </button>
            ))}
          </div>

          {/* Periodicity Switch */}
          <div className="flex items-center bg-[#071217] p-1 rounded-xl border border-slate-700 w-full sm:w-auto">
            <button
              onClick={() => setPeriodicity('semanal')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodicity === 'semanal'
                  ? 'bg-emerald-500 text-slate-950 shadow font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📅 Semanal
            </button>
            <button
              onClick={() => setPeriodicity('mensual')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodicity === 'mensual'
                  ? 'bg-emerald-500 text-slate-950 shadow font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🗓️ Mensual
            </button>
          </div>
        </div>
      </div>

      {/* Main Historical Table */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            {periodicity === 'semanal' ? '📜 Liquidaciones Semanales' : '🗓️ Consolidado Mensual'}
          </h3>
          <span className="text-xs font-bold text-slate-400">
            {activeRows.length} registros en {selectedCurrency}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#071217] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Período</th>
                <th className="py-3 px-4 text-right">Arrastre Inicial</th>
                <th className="py-3 px-4 text-right">Ganancia / Pérdida</th>
                <th className="py-3 px-4 text-right">(-) Efectivo / QR</th>
                <th className="py-3 px-4 text-right">(-) Banco</th>
                <th className="py-3 px-4 text-right">(+) Rep. Premios</th>
                <th className="py-3 px-4 text-right">Saldo Final</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-3 text-center">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {activeRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 font-sans">
                    No hay registros de liquidación para {selectedCurrency}.
                  </td>
                </tr>
              ) : (
                activeRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedDrilldownRow(row)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-sans">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        {row.periodo_label}
                        {row.is_active_cycle && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Activo
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block">{row.rango_fechas}</span>
                    </td>

                    <td className="py-3.5 px-4 text-right text-slate-400">
                      {formatCurrency(row.arrastre_inicial, selectedCurrency)}
                    </td>

                    <td
                      className={`py-3.5 px-4 text-right font-semibold ${
                        row.venta_neta > 0
                          ? 'text-emerald-400'
                          : row.venta_neta < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {row.venta_neta > 0 ? '+' : ''}
                      {formatCurrency(row.venta_neta, selectedCurrency)}
                    </td>

                    <td className="py-3.5 px-4 text-right text-rose-400">
                      {row.efectivo_qr > 0 ? `-${formatCurrency(row.efectivo_qr, selectedCurrency)}` : '0.00'}
                    </td>

                    <td className="py-3.5 px-4 text-right text-sky-400">
                      {row.bancos > 0 ? `-${formatCurrency(row.bancos, selectedCurrency)}` : '0.00'}
                    </td>

                    <td className="py-3.5 px-4 text-right text-amber-400">
                      {row.reposicion_premios > 0
                        ? `+${formatCurrency(row.reposicion_premios, selectedCurrency)}`
                        : '0.00'}
                    </td>

                    <td
                      className={`py-3.5 px-4 text-right font-black ${
                        row.saldo_final > 0
                          ? 'text-rose-400'
                          : row.saldo_final < 0
                          ? 'text-cyan-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {formatCurrency(row.saldo_final, selectedCurrency)}
                    </td>

                    <td className="py-3.5 px-4 text-center font-sans">
                      {row.status === 'pagado' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Solvente
                        </span>
                      ) : row.status === 'pendiente' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3" /> Por Pagar
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          A Favor
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors mx-auto" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drilldown Modal */}
      {selectedDrilldownRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Comprobantes del Período</h3>
                  <p className="text-[11px] text-slate-400">{selectedDrilldownRow.periodo_label}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDrilldownRow(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* QR Receipts */}
              <div className="space-y-1.5">
                <span className="font-bold text-white block uppercase tracking-wider text-[10px]">
                  📲 Entregas a Cobradores en Ruta (QR):
                </span>
                {selectedDrilldownRow.vouchers.cobradores_qr.length === 0 ? (
                  <p className="text-slate-500 italic">Sin entregas QR en este ciclo.</p>
                ) : (
                  selectedDrilldownRow.vouchers.cobradores_qr.map((v, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between">
                      <div>
                        <strong className="text-white block">{v.qr_token || 'Token QR'}</strong>
                        <span className="text-[10px] text-slate-400">Fecha: {formatDate(v.fecha || v.created_at)}</span>
                      </div>
                      <span className="font-mono font-bold text-rose-400">
                        -{formatCurrency(v.monto, selectedCurrency)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Bank Transfers */}
              <div className="space-y-1.5">
                <span className="font-bold text-white block uppercase tracking-wider text-[10px]">
                  🏦 Transferencias Bancarias Confirmadas:
                </span>
                {selectedDrilldownRow.vouchers.bancos.length === 0 ? (
                  <p className="text-slate-500 italic">Sin transferencias en este ciclo.</p>
                ) : (
                  selectedDrilldownRow.vouchers.bancos.map((v, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between">
                      <div>
                        <strong className="text-white block">REF: {v.referencia || 'N/A'}</strong>
                        <span className="text-[10px] text-slate-400">Fecha: {formatDate(v.fecha || v.created_at)}</span>
                      </div>
                      <span className="font-mono font-bold text-sky-400">
                        -{formatCurrency(v.monto, selectedCurrency)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end">
              <button
                onClick={() => setSelectedDrilldownRow(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
