import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, normalizarMoneda } from '../../utils/formatters';
import {
  Layers,
  RefreshCw,
  Printer,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  X,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  Hash,
  BarChart3
} from 'lucide-react';

export interface DetailedMovement {
  id: string | number;
  id_display: string;
  fecha: string;
  tipo_categoria: 'EFECTIVO' | 'COBRADOR' | 'BANCO' | 'GASTO' | 'PREMIO' | 'VENTA';
  categoria_label: string;
  concepto: string;
  referencia: string;
  cajero: string;
  monto: number;
  es_abono: boolean;
  confirmado: boolean;
  rechazado: boolean;
  origen_tabla: string;
}

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
    efectivo: any[];
    bancos: any[];
    gastos: any[];
    reposicion_premios: any[];
    ventas_sistemas: any[];
  };
  movements: DetailedMovement[];
}

export const AgencyCycleHistoryTab: React.FC = () => {
  const { agency, systemCycle } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<'BS' | 'USD' | 'COP'>('COP');
  const [periodicity, setPeriodicity] = useState<'semanal' | 'mensual'>('semanal');
  const [viewMode, setViewMode] = useState<'resumen' | 'movimientos'>('resumen');

  // Filtros para la vista de movimientos detallados
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Filtro dentro del modal drilldown
  const [modalCategoryFilter, setModalCategoryFilter] = useState<string>('all');

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
        supabase.from('cda_pagos_bancarios').select('*').or(`agencia.ilike.${targetAgencyName},nombre_agency.ilike.${targetAgencyName}`),
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

  // Helper para clases de badge por categoría
  const getCategoryBadgeClass = (tipo: DetailedMovement['tipo_categoria']) => {
    switch (tipo) {
      case 'EFECTIVO':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'COBRADOR':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'BANCO':
        return 'bg-sky-500/20 text-sky-400 border border-sky-500/30';
      case 'GASTO':
        return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      case 'PREMIO':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'VENTA':
        return 'bg-teal-500/20 text-teal-400 border border-teal-500/30';
      default:
        return 'bg-slate-700/40 text-slate-300 border border-slate-600/30';
    }
  };

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
      return matchMon && inCycle && (p.confirmado === undefined || p.confirmado === null || Boolean(p.confirmado)) && !p.rechazado;
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

    // Construcción de Movimientos Detallados (1 movimiento = 1 ID)
    const activeMovements: DetailedMovement[] = [];

    // Pagos diarios (efectivo y cobradores)
    const allActiveDaily = rawDailyPayments.filter((p) => {
      const matchMon = normalizarMoneda(p.moneda) === mon;
      const fStr = String(p.fecha || p.created_at || '').slice(0, 10);
      const inCycle = (!cycleDesde || fStr >= cycleDesde) && (!cycleHasta || fStr <= cycleHasta);
      return matchMon && inCycle && !p.rechazado;
    });

    allActiveDaily.forEach((p) => {
      const isCob = Boolean(p.qr_token) || String(p.tipo_pago || '').toUpperCase().includes('COBRADOR');
      const isConf = Boolean(p.confirmado) || Boolean(p.confirmado_supervisor) || Boolean(p.fecha_escaneo_cobrador);
      activeMovements.push({
        id: p.id,
        id_display: `#${p.id}`,
        fecha: String(p.fecha || p.created_at || '').slice(0, 10),
        tipo_categoria: isCob ? 'COBRADOR' : 'EFECTIVO',
        categoria_label: isCob ? '🛵 Cobrador Ruta (QR)' : '💵 Efectivo Taquilla',
        concepto: p.tipo_pago || (isCob ? 'Entrega a Cobrador' : 'Entregado a Supervisor'),
        referencia: p.qr_token ? `QR: ${p.qr_token}` : (p.referencia || (p.supervisor_nombre ? `Sup: ${p.supervisor_nombre}` : 'Efectivo')),
        cajero: p.cajero || p.nombre_cajero || p.cajero_id || 'Cajero',
        monto: Number(p.monto || 0),
        es_abono: true,
        confirmado: isConf,
        rechazado: Boolean(p.rechazado),
        origen_tabla: 'cda_pagos_diarios'
      });
    });

    // Pagos bancarios
    agBankList.forEach((b) => {
      activeMovements.push({
        id: b.id,
        id_display: `#${b.id}`,
        fecha: String(b.fecha || b.created_at || '').slice(0, 10),
        tipo_categoria: 'BANCO',
        categoria_label: '🏛️ Pago Bancario',
        concepto: b.metodo_pago || b.concepto || 'Transferencia Bancaria',
        referencia: b.referencia ? `REF: ${b.referencia} ${b.pos_o_cuenta ? `(${b.pos_o_cuenta})` : ''}` : (b.pos_o_cuenta || 'Banco'),
        cajero: b.datos_pagador || b.cajero || '-',
        monto: Number(b.monto || 0),
        es_abono: true,
        confirmado: Boolean(b.confirmado),
        rechazado: Boolean(b.rechazado),
        origen_tabla: 'cda_pagos_bancarios'
      });
    });

    // Gastos operativos
    agExpList.forEach((g) => {
      activeMovements.push({
        id: g.id,
        id_display: `#${g.id}`,
        fecha: String(g.fecha || g.created_at || '').slice(0, 10),
        tipo_categoria: 'GASTO',
        categoria_label: '🏷️ Gasto Operativo',
        concepto: g.concepto || 'Gasto General',
        referencia: g.descripcion || 'Gasto registrado',
        cajero: g.cajero || g.nombre_cajero || '-',
        monto: Number(g.monto || 0),
        es_abono: false,
        confirmado: Boolean(g.confirmado || g.confirmado_supervisor),
        rechazado: Boolean(g.rechazado),
        origen_tabla: 'cda_gastos_diarios'
      });
    });

    // Reposiciones de premios (pagos_semana)
    agManualPrem.forEach((p) => {
      activeMovements.push({
        id: p.id || `prem_${p.fecha}`,
        id_display: p.id ? `#${p.id}` : '#PREMIO',
        fecha: String(p.fecha || p.created_at || '').slice(0, 10),
        tipo_categoria: 'PREMIO',
        categoria_label: '🏆 Reposición Premios',
        concepto: p.tipo_pago || p.concepto || 'Abono / Reposición',
        referencia: p.referencia || 'Reposición de Caja',
        cajero: '-',
        monto: Number(p.monto || 0),
        es_abono: false,
        confirmado: true,
        rechazado: false,
        origen_tabla: 'pagos_semana'
      });
    });

    // Ventas por sistema
    agActiveSales.forEach((s) => {
      const vNeto = Number(s.neto || (Number(s.venta || 0) - Number(s.comision || 0) - Number(s.premios || 0)));
      activeMovements.push({
        id: s.id || `vta_${s.sistema}_${s.fecha || 'act'}`,
        id_display: s.id ? `#${s.id}` : `#VTA-${s.sistema || 'BETM3'}`,
        fecha: String(s.fecha || systemCycle?.hasta || '').slice(0, 10),
        tipo_categoria: 'VENTA',
        categoria_label: '📊 Venta Neta Sistema',
        concepto: `Venta Sistema ${s.sistema || 'BETM3'}`,
        referencia: `Venta: ${formatCurrency(s.venta || 0, mon)} | Prem: ${formatCurrency(s.premios || 0, mon)} | Com: ${formatCurrency(s.comision || 0, mon)}`,
        cajero: '-',
        monto: vNeto,
        es_abono: false,
        confirmado: true,
        rechazado: false,
        origen_tabla: 'carga_actual'
      });
    });

    activeMovements.sort((a, b) => {
      const fCmp = String(b.fecha).localeCompare(String(a.fecha));
      if (fCmp !== 0) return fCmp;
      return String(b.id).localeCompare(String(a.id));
    });

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
        efectivo: agEfectivoList,
        bancos: agBankList,
        gastos: agExpList,
        reposicion_premios: agManualPrem,
        ventas_sistemas: agActiveSales,
      },
      movements: activeMovements,
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

      // Movimientos de ciclos cerrados
      const closedMovements: DetailedMovement[] = [];

      histCob.forEach((p) => {
        const isCob = Boolean(p.qr_token) || String(p.tipo_pago || '').toUpperCase().includes('COBRADOR');
        closedMovements.push({
          id: p.id,
          id_display: `#${p.id}`,
          fecha: String(p.fecha || p.created_at || '').slice(0, 10),
          tipo_categoria: isCob ? 'COBRADOR' : 'EFECTIVO',
          categoria_label: isCob ? '🛵 Cobrador Ruta (QR)' : '💵 Efectivo Taquilla',
          concepto: p.tipo_pago || (isCob ? 'Entrega a Cobrador' : 'Entregado a Supervisor'),
          referencia: p.qr_token ? `QR: ${p.qr_token}` : (p.referencia || 'Efectivo'),
          cajero: p.cajero || p.nombre_cajero || p.cajero_id || 'Cajero',
          monto: Number(p.monto || 0),
          es_abono: true,
          confirmado: Boolean(p.confirmado || p.confirmado_supervisor),
          rechazado: Boolean(p.rechazado),
          origen_tabla: 'cda_pagos_diarios'
        });
      });

      histBank.forEach((b) => {
        closedMovements.push({
          id: b.id,
          id_display: `#${b.id}`,
          fecha: String(b.fecha || b.created_at || '').slice(0, 10),
          tipo_categoria: 'BANCO',
          categoria_label: '🏛️ Pago Bancario',
          concepto: b.metodo_pago || b.concepto || 'Transferencia',
          referencia: b.referencia ? `REF: ${b.referencia}` : 'Banco',
          cajero: b.datos_pagador || b.cajero || '-',
          monto: Number(b.monto || 0),
          es_abono: true,
          confirmado: Boolean(b.confirmado),
          rechazado: Boolean(b.rechazado),
          origen_tabla: 'cda_pagos_bancarios'
        });
      });

      histExp.forEach((g) => {
        closedMovements.push({
          id: g.id,
          id_display: `#${g.id}`,
          fecha: String(g.fecha || g.created_at || '').slice(0, 10),
          tipo_categoria: 'GASTO',
          categoria_label: '🏷️ Gasto Operativo',
          concepto: g.concepto || 'Gasto General',
          referencia: g.descripcion || 'Gasto',
          cajero: g.cajero || g.nombre_cajero || '-',
          monto: Number(g.monto || 0),
          es_abono: false,
          confirmado: true,
          rechazado: false,
          origen_tabla: 'cda_gastos_diarios'
        });
      });

      closedMovements.sort((a, b) => {
        const fCmp = String(b.fecha).localeCompare(String(a.fecha));
        if (fCmp !== 0) return fCmp;
        return String(b.id).localeCompare(String(a.id));
      });

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
          cobradores_qr: histCob.filter((p) => Boolean(p.qr_token) || String(p.tipo_pago || '').toUpperCase().includes('COBRADOR')),
          efectivo: histCob.filter((p) => !Boolean(p.qr_token) && !String(p.tipo_pago || '').toUpperCase().includes('COBRADOR')),
          bancos: histBank,
          gastos: histExp,
          reposicion_premios: [],
          ventas_sistemas: [],
        },
        movements: closedMovements,
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
          efectivo: sorted.flatMap((r) => r.vouchers.efectivo),
          bancos: sorted.flatMap((r) => r.vouchers.bancos),
          gastos: sorted.flatMap((r) => r.vouchers.gastos),
          reposicion_premios: sorted.flatMap((r) => r.vouchers.reposicion_premios),
          ventas_sistemas: sorted.flatMap((r) => r.vouchers.ventas_sistemas),
        },
        movements: sorted.flatMap((r) => r.movements),
      });
    });

    return months.sort((a, b) => (b.fecha_desde || '').localeCompare(a.fecha_desde || ''));
  }, [weeklyHistoryRows]);

  const activeRows = periodicity === 'semanal' ? weeklyHistoryRows : monthlyHistoryRows;

  // Lista unificada y desduplicada de todos los movimientos (1 a 1)
  const allMovements = useMemo(() => {
    const seen = new Set<string>();
    const list: DetailedMovement[] = [];
    activeRows.forEach((r) => {
      r.movements.forEach((m) => {
        const key = `${m.origen_tabla}_${m.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push(m);
        }
      });
    });
    return list.sort((a, b) => {
      const fCmp = String(b.fecha).localeCompare(String(a.fecha));
      if (fCmp !== 0) return fCmp;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [activeRows]);

  // Conteo de movimientos por categoría
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allMovements.length,
      EFECTIVO: 0,
      BANCO: 0,
      COBRADOR: 0,
      GASTO: 0,
      PREMIO: 0,
      VENTA: 0,
    };
    allMovements.forEach((m) => {
      if (counts[m.tipo_categoria] !== undefined) {
        counts[m.tipo_categoria]++;
      }
    });
    return counts;
  }, [allMovements]);

  // Movimientos filtrados para la vista detallada
  const filteredMovements = useMemo(() => {
    return allMovements.filter((m) => {
      if (categoryFilter !== 'all' && m.tipo_categoria !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = String(m.id).toLowerCase().includes(q) || m.id_display.toLowerCase().includes(q);
        const matchConcept = m.concepto.toLowerCase().includes(q);
        const matchRef = m.referencia.toLowerCase().includes(q);
        const matchUser = m.cajero.toLowerCase().includes(q);
        const matchCat = m.categoria_label.toLowerCase().includes(q);
        return matchId || matchConcept || matchRef || matchUser || matchCat;
      }
      return true;
    });
  }, [allMovements, categoryFilter, searchQuery]);

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
                Auditoría detallada movimiento por movimiento con ID individual, pagos en efectivo, transferencias y gastos.
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

        {/* Currency, Periodicity & View Mode Switch */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            {/* Currency Tabs */}
            <div className="flex items-center bg-[#071217] p-1 rounded-xl border border-slate-700">
              {(['COP', 'BS', 'USD'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedCurrency(m)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
            <div className="flex items-center bg-[#071217] p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setPeriodicity('semanal')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodicity === 'semanal'
                    ? 'bg-emerald-500 text-slate-950 shadow font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📅 Semanal
              </button>
              <button
                onClick={() => setPeriodicity('mensual')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  periodicity === 'mensual'
                    ? 'bg-emerald-500 text-slate-950 shadow font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🗓️ Mensual
              </button>
            </div>
          </div>

          {/* View Mode Selector: Resumen vs Movimientos por separado (1 por ID) */}
          <div className="flex items-center bg-[#071217] p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setViewMode('resumen')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'resumen'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>📊 Resumen por Ciclo</span>
            </button>
            <button
              onClick={() => setViewMode('movimientos')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'movimientos'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>🧾 Movimientos por Separado (1 por ID)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/60 font-mono">
                {allMovements.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* VISTA 1: RESUMEN POR CICLO (CON ACORDEÓN EXPANDIBLE INLINE) */}
      {viewMode === 'resumen' && (
        <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {periodicity === 'semanal' ? '📜 Liquidaciones Semanales' : '🗓️ Consolidado Mensual'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Haz clic en cualquier período o en la flecha <ChevronRight className="w-3 h-3 inline text-emerald-400" /> para ver todos sus movimientos individuales por ID.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400 font-mono">
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
                  activeRows.map((row) => {
                    const isExpanded = expandedRowId === row.id;
                    return (
                      <React.Fragment key={row.id}>
                        <tr
                          onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                          className={`hover:bg-slate-800/40 transition-colors cursor-pointer group ${
                            isExpanded ? 'bg-slate-800/50 border-l-2 border-emerald-400' : ''
                          }`}
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRowId(isExpanded ? null : row.id);
                              }}
                              title={isExpanded ? 'Ocultar movimientos' : 'Ver movimientos por separado (1 por ID)'}
                              className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-emerald-400 mx-auto" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors mx-auto" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* ACORDEÓN EXPANDIBLE INLINE: MOVIMIENTOS POR SEPARADO 1 A 1 CON ID */}
                        {isExpanded && (
                          <tr className="bg-[#08151D] border-b border-slate-800 animate-fadeIn">
                            <td colSpan={9} className="p-4 sm:p-5">
                              <div className="space-y-3 font-sans">
                                <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
                                  <div className="flex items-center gap-2">
                                    <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-xs">
                                      📋 {row.periodo_label}
                                    </span>
                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                      Movimientos Detallados del Período ({row.movements.length} movimientos &bull; 1 movimiento = 1 ID)
                                    </h4>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDrilldownRow(row);
                                    }}
                                    className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> Abrir en Modal Completo
                                  </button>
                                </div>

                                {row.movements.length === 0 ? (
                                  <p className="text-xs text-slate-500 italic py-4 text-center">
                                    No hay movimientos individuales registrados para este ciclo en {selectedCurrency}.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#071217]">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-900/90 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                                        <tr>
                                          <th className="py-2.5 px-3">ID Movimiento</th>
                                          <th className="py-2.5 px-3">Fecha</th>
                                          <th className="py-2.5 px-3">Categoría</th>
                                          <th className="py-2.5 px-3">Concepto</th>
                                          <th className="py-2.5 px-3">Referencia / Comprobante</th>
                                          <th className="py-2.5 px-3">Cajero / Resp.</th>
                                          <th className="py-2.5 px-3 text-right">Monto</th>
                                          <th className="py-2.5 px-3 text-center">Estado</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800/60 font-mono">
                                        {row.movements.map((m, idx) => (
                                          <tr key={`${m.origen_tabla}_${m.id}_${idx}`} className="hover:bg-slate-800/40 transition-colors">
                                            <td className="py-2.5 px-3">
                                              <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-emerald-300 font-bold font-mono text-[11px] inline-flex items-center gap-1">
                                                <Hash className="w-3 h-3 text-slate-400" />
                                                {m.id_display.replace('#', '')}
                                              </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-300 font-sans text-[11px] whitespace-nowrap">
                                              {formatDate(m.fecha)}
                                            </td>
                                            <td className="py-2.5 px-3 font-sans">
                                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getCategoryBadgeClass(m.tipo_categoria)}`}>
                                                {m.categoria_label}
                                              </span>
                                            </td>
                                            <td className="py-2.5 px-3 font-sans text-slate-200 font-semibold">
                                              {m.concepto}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                                              {m.referencia}
                                            </td>
                                            <td className="py-2.5 px-3 font-sans text-slate-400 text-[11px]">
                                              {m.cajero}
                                            </td>
                                            <td className={`py-2.5 px-3 text-right font-bold text-xs ${
                                              m.es_abono 
                                                ? 'text-emerald-400' 
                                                : m.tipo_categoria === 'GASTO' 
                                                ? 'text-rose-400' 
                                                : 'text-slate-200'
                                            }`}>
                                              {m.es_abono ? '-' : m.tipo_categoria === 'GASTO' ? '-' : '+'}
                                              {formatCurrency(m.monto, selectedCurrency)}
                                            </td>
                                            <td className="py-2.5 px-3 text-center font-sans">
                                              {m.rechazado ? (
                                                <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 text-[10px] font-bold">
                                                  Rechazado
                                                </span>
                                              ) : m.confirmado ? (
                                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                                                  Confirmado
                                                </span>
                                              ) : (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                                                  En Tránsito
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 2: MOVIMIENTOS POR SEPARADO (1 MOVIMIENTO = 1 ID) */}
      {viewMode === 'movimientos' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Barra de Filtros y Búsqueda */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por ID (#104), concepto, referencia, cajero..."
                  className="w-full bg-[#071217] border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              <span className="text-xs text-slate-400 font-mono font-bold self-end sm:self-auto">
                Mostrando {filteredMovements.length} de {allMovements.length} movimientos
              </span>
            </div>

            {/* Píldoras de Categoría */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800">
              {[
                { key: 'all', label: 'Todos', count: categoryCounts.all },
                { key: 'EFECTIVO', label: '💵 Efectivo Taquilla', count: categoryCounts.EFECTIVO },
                { key: 'BANCO', label: '🏛️ Bancos', count: categoryCounts.BANCO },
                { key: 'COBRADOR', label: '🛵 Cobrador Ruta (QR)', count: categoryCounts.COBRADOR },
                { key: 'GASTO', label: '🏷️ Gastos', count: categoryCounts.GASTO },
                { key: 'PREMIO', label: '🏆 Reposición Premios', count: categoryCounts.PREMIO },
                { key: 'VENTA', label: '📊 Ventas Netas', count: categoryCounts.VENTA },
              ].map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategoryFilter(c.key)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    categoryFilter === c.key
                      ? 'bg-emerald-500 text-slate-950 shadow font-black'
                      : 'bg-[#071217] text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>{c.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    categoryFilter === c.key ? 'bg-slate-900/40 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {c.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tabla de Movimientos por Separado (1 Movimiento = 1 ID) */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#071217] text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Concepto</th>
                    <th className="py-3 px-4">Referencia / Comprobante</th>
                    <th className="py-3 px-4">Cajero / Responsable</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                    <th className="py-3 px-4 text-center">Impacto</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                        No se encontraron movimientos con los filtros seleccionados para {selectedCurrency}.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m, idx) => (
                      <tr
                        key={`${m.origen_tabla}_${m.id}_${idx}`}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-emerald-300 inline-flex items-center gap-1 shadow-sm">
                            <Hash className="w-3 h-3 text-slate-500" />
                            {m.id_display.replace('#', '')}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-sans text-slate-300 text-xs whitespace-nowrap">
                          {formatDate(m.fecha)}
                        </td>

                        <td className="py-3 px-4 font-sans">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getCategoryBadgeClass(m.tipo_categoria)}`}>
                            {m.categoria_label}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-sans text-slate-200 font-semibold">
                          {m.concepto}
                        </td>

                        <td className="py-3 px-4 text-slate-400 text-xs">
                          {m.referencia}
                        </td>

                        <td className="py-3 px-4 font-sans text-slate-400 text-xs">
                          {m.cajero}
                        </td>

                        <td className={`py-3 px-4 text-right font-black text-sm font-mono ${
                          m.es_abono 
                            ? 'text-emerald-400' 
                            : m.tipo_categoria === 'GASTO' 
                            ? 'text-rose-400' 
                            : 'text-slate-100'
                        }`}>
                          {m.es_abono ? '-' : m.tipo_categoria === 'GASTO' ? '-' : '+'}
                          {formatCurrency(m.monto, selectedCurrency)}
                        </td>

                        <td className="py-3 px-4 text-center font-sans">
                          {m.es_abono ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <ArrowDownRight className="w-3 h-3" /> Abono / Pago
                            </span>
                          ) : m.tipo_categoria === 'GASTO' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              <ArrowDownRight className="w-3 h-3" /> Gasto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                              <ArrowUpRight className="w-3 h-3" /> Cargo
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center font-sans">
                          {m.rechazado ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              Rechazado
                            </span>
                          ) : m.confirmado ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> Confirmado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              En Tránsito
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
      )}

      {/* Drilldown Modal: Movimientos Detallados 1 a 1 por ID */}
      {selectedDrilldownRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Comprobantes y Movimientos del Período</h3>
                  <p className="text-[11px] text-slate-400 font-mono">{selectedDrilldownRow.periodo_label} &bull; {selectedCurrency}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDrilldownRow(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filtros dentro del modal */}
            <div className="px-5 pt-3 pb-2 border-b border-slate-800/80 bg-[#071217] flex items-center justify-between gap-2 overflow-x-auto">
              <div className="flex items-center gap-1.5">
                {[
                  { key: 'all', label: 'Todos' },
                  { key: 'EFECTIVO', label: '💵 Efectivo' },
                  { key: 'BANCO', label: '🏛️ Bancos' },
                  { key: 'COBRADOR', label: '🛵 Cobrador' },
                  { key: 'GASTO', label: '🏷️ Gastos' },
                  { key: 'PREMIO', label: '🏆 Premios' },
                  { key: 'VENTA', label: '📊 Ventas' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setModalCategoryFilter(f.key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      modalCategoryFilter === f.key
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap font-bold">
                {selectedDrilldownRow.movements.filter((m) => modalCategoryFilter === 'all' || m.tipo_categoria === modalCategoryFilter).length} mov.
              </span>
            </div>

            {/* Lista detallada de movimientos: 1 movimiento = 1 ID */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-2 text-xs flex-1">
              {selectedDrilldownRow.movements
                .filter((m) => modalCategoryFilter === 'all' || m.tipo_categoria === modalCategoryFilter)
                .length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-sans">
                  No hay movimientos registrados para esta categoría en este período.
                </div>
              ) : (
                selectedDrilldownRow.movements
                  .filter((m) => modalCategoryFilter === 'all' || m.tipo_categoria === modalCategoryFilter)
                  .map((m, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-emerald-300 font-mono font-bold text-xs inline-flex items-center gap-0.5 mt-0.5">
                          <Hash className="w-3 h-3 text-slate-400" />
                          {m.id_display.replace('#', '')}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-xs">{m.concepto}</span>
                            <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold ${getCategoryBadgeClass(m.tipo_categoria)}`}>
                              {m.categoria_label}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                            <span>📅 {formatDate(m.fecha)}</span>
                            {m.referencia && (
                              <>
                                <span>&bull;</span>
                                <span className="font-mono text-slate-300">{m.referencia}</span>
                              </>
                            )}
                            {m.cajero && m.cajero !== '-' && (
                              <>
                                <span>&bull;</span>
                                <span className="text-slate-400">Resp: {m.cajero}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                        <span className={`font-mono font-black text-sm ${
                          m.es_abono 
                            ? 'text-emerald-400' 
                            : m.tipo_categoria === 'GASTO' 
                            ? 'text-rose-400' 
                            : 'text-slate-200'
                        }`}>
                          {m.es_abono ? '-' : m.tipo_categoria === 'GASTO' ? '-' : '+'}
                          {formatCurrency(m.monto, selectedCurrency)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                          {m.confirmado ? '✅ Confirmado' : m.rechazado ? '❌ Rechazado' : '⏳ En Tránsito'}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                Total en período: <strong className="text-white">{selectedDrilldownRow.movements.length} movimientos</strong>
              </span>
              <button
                onClick={() => setSelectedDrilldownRow(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
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

export default AgencyCycleHistoryTab;
