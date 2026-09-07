import { supabase } from '../lib/supabase';
import { normalizarMoneda } from './formatters';
import type { Agency, SystemCycle, UserSession } from '../types';

export interface CurrencyOperationalMetrics {
  moneda: string;
  sym: string;
  saldoAnterior: number;
  ventas: number;
  comisiones: number;
  premios: number;
  resultadoOp: number;
  gastos: number;
  pagoEfectivo: number;
  pagoBanco: number;
  pagoPremios: number;
  saldoNeto: number;
  saldoActual: number;
  ventasDetalle: VentasDetalleRow[];
  gastosDetalle: GastosDetalleRow[];
  pagosOrdinariosDetalle: PagosDetalleRow[];
  pagosPremiosDetalle: PagosDetalleRow[];
  rawTicketText?: string;
}

export interface VentasDetalleRow {
  fecha?: string;
  sistema: string;
  moneda: string;
  venta: number;
  comision: number;
  premios: number;
  neto: number;
}

export interface GastosDetalleRow {
  id?: number | string;
  fecha: string;
  agencia: string;
  cajero?: string;
  concepto: string;
  moneda: string;
  monto: number;
  confirmado?: boolean;
  rechazado?: boolean;
  motivo_rechazo?: string;
}

export interface PagosDetalleRow {
  id?: number | string;
  fecha: string;
  agencia: string;
  cajero?: string;
  tipo_pago: string;
  referencia: string;
  moneda: string;
  monto: number;
  confirmado?: boolean;
  rechazado?: boolean;
  motivo_rechazo?: string;
  tipo_clasif: 'BANCO' | 'EFECTIVO' | 'PREMIO';
}

/**
 * Clasifica un registro de pago en 'PREMIO', 'BANCO' o 'EFECTIVO'
 * replicando exactamente clasificar_pago_registro() de taquilla.py
 */
export function clasificarPagoRegistro(r: Record<string, any>): 'PREMIO' | 'BANCO' | 'EFECTIVO' {
  const fields = [
    'concepto',
    'tipo_pago',
    'tipo',
    'descripcion',
    'metodo_pago',
    'metodo',
    'pos_o_cuenta',
    'datos_pagador',
    'referencia',
    'categoria',
    'tabla',
    'origen'
  ];

  const fullText = fields
    .map((k) => String(r[k] || '').trim().toUpperCase())
    .filter((v) => v && !['NONE', 'NAN', 'N/A', 'NULL'].includes(v))
    .join(' ');

  const keywordsPremios = [
    'PREMIO',
    'PREMIOS',
    'PÉRDIDA',
    'PERDIDA',
    'PÉRDIDAS',
    'PERDIDAS',
    'ABONO',
    'REPOSICION',
    'REPOSICIÓN',
    'REPOSICION DE CAJA',
    'REPOSICIÓN DE CAJA'
  ];

  if (keywordsPremios.some((kw) => fullText.includes(kw))) {
    return 'PREMIO';
  }

  const keywordsBanco = [
    'BANCO',
    'PUNTO',
    'POS',
    'ZELLE',
    'TRANSFERENCIA',
    'MÓVIL',
    'MOVIL',
    'BIOPAGO',
    'DEPOSITO',
    'DEPÓSITO',
    'CUENTA'
  ];

  const esOrigenBanco = r.origen === 'cda_pagos_bancarios' || r.tabla === 'cda_pagos_bancarios';
  const tieneKwBanco = keywordsBanco.some((kw) => fullText.includes(kw));

  if (esOrigenBanco || tieneKwBanco) {
    return 'BANCO';
  }

  return 'EFECTIVO';
}

/**
 * Obtiene el saldo anterior acumulado de la agencia para la moneda solicitada
 */
export async function obtenerSaldoAnterior(
  agencyName: string,
  fechaOperativa: string,
  moneda: string,
  cajeroId?: string | number,
  agencyData?: Agency | null
): Promise<number> {
  const agStr = String(agencyName).trim();
  const mCode = normalizarMoneda(moneda).toLowerCase();

  // 1. Buscar en saldo_taquilla por cajero si aplica
  if (cajeroId) {
    try {
      const cStr = String(cajeroId).trim();
      if (cStr && !['none', 'nan', ''].includes(cStr.toLowerCase())) {
        const { data: resC } = await supabase
          .from('saldo_taquilla')
          .select('saldo_restante')
          .ilike('nombre_agency', agStr)
          .ilike('moneda', mCode)
          .eq('cajero_id', cStr)
          .lt('fecha', fechaOperativa)
          .order('fecha', { ascending: false })
          .limit(1);

        if (resC && resC.length > 0 && resC[0].saldo_restante !== null && resC[0].saldo_restante !== undefined) {
          return Number(resC[0].saldo_restante) || 0;
        }
      }
    } catch (e) {
      console.warn('Error fetching anterior cashier balance:', e);
    }
  }

  // 2. Buscar último saldo general en saldo_taquilla
  try {
    const { data: resDate } = await supabase
      .from('saldo_taquilla')
      .select('fecha')
      .ilike('nombre_agency', agStr)
      .ilike('moneda', mCode)
      .lt('fecha', fechaOperativa)
      .order('fecha', { ascending: false })
      .limit(1);

    if (resDate && resDate.length > 0 && resDate[0].fecha) {
      const latestDate = resDate[0].fecha;
      const { data: resAll } = await supabase
        .from('saldo_taquilla')
        .select('saldo_restante')
        .ilike('nombre_agency', agStr)
        .ilike('moneda', mCode)
        .eq('fecha', latestDate);

      if (resAll && resAll.length > 0) {
        return resAll.reduce((acc: number, r: any) => acc + (Number(r.saldo_restante) || 0), 0);
      }
    }
  } catch (e) {
    console.warn('Error fetching agency anterior date balance:', e);
  }

  // 3. Fallback: saldo inicial configurado en tabla agencias
  try {
    let agObj = agencyData;
    if (!agObj || !agObj.nombre_agencia) {
      const { data: resAg } = await supabase
        .from('agencias')
        .select('*')
        .ilike('nombre_agencia', agStr)
        .maybeSingle();
      agObj = resAg as Agency;
    }

    if (agObj) {
      const fieldName = `saldo_inicial_${mCode}` as keyof Agency;
      if (agObj[fieldName] !== undefined && agObj[fieldName] !== null) {
        return Number(agObj[fieldName]) || 0;
      }
      if (mCode === 'bs') {
        const alt1 = (agObj as any).saldo_inicial_bs;
        const alt2 = (agObj as any).saldo_inicial;
        const alt3 = (agObj as any).saldo_arrastre;
        const val = alt1 ?? alt2 ?? alt3;
        if (val !== undefined && val !== null) {
          return Number(val) || 0;
        }
      }
    }
  } catch (e) {
    console.warn('Error reading initial balance from agencias:', e);
  }

  return 0;
}

export interface PeriodMetricsOptions {
  customDesde?: string;
  customHasta?: string;
  filterCajeroId?: string | null;
  forceRefresh?: boolean;
}

interface CacheEntry {
  timestamp: number;
  data: Record<string, CurrencyOperationalMetrics>;
}

const metricsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 segundos de vigencia

export function clearMetricsCache() {
  metricsCache.clear();
}

/**
 * Consulta y unifica todos los datos operativos de la agencia para el ciclo seleccionado
 * Totalmente optimizado con consultas paralelas (Promise.all) y caché en memoria.
 */
export async function fetchFullCycleMetrics(
  agencyName: string,
  systemCycle: SystemCycle | null,
  assignedCurrencies: string[],
  assignedSystems: string[],
  user: UserSession | null,
  agencyData?: Agency | null,
  options?: PeriodMetricsOptions
): Promise<Record<string, CurrencyOperationalMetrics>> {
  if (!agencyName) return {};

  const todayStr = new Date().toISOString().slice(0, 10);
  const fDesdeAdmin = options?.customDesde || systemCycle?.desde || todayStr;
  const fHastaAdmin = options?.customHasta || systemCycle?.hasta || todayStr;
  const fHastaEfectivo = fHastaAdmin > todayStr ? fHastaAdmin : todayStr;
  const fDesdeCarga = fDesdeAdmin <= todayStr ? fDesdeAdmin : todayStr;

  const isSupervisor = user?.rol === 'supervisor' || user?.rol === 'agencia' || user?.rol === 'admin';
  let cajeroId: string | undefined = undefined;
  if (options?.filterCajeroId !== undefined) {
    cajeroId = options.filterCajeroId && options.filterCajeroId !== 'all' ? String(options.filterCajeroId) : undefined;
  } else {
    cajeroId = !isSupervisor && user?.id ? String(user.id) : undefined;
  }
  const uIdAdmin = agencyData?.user_id ? String(agencyData.user_id) : undefined;

  // Verificación de caché en memoria para carga instantánea al cambiar pestañas
  const cacheKey = `${agencyName}_${fDesdeAdmin}_${fHastaAdmin}_${cajeroId || 'all'}_${assignedCurrencies.slice().sort().join(',')}`;
  if (!options?.forceRefresh) {
    const cached = metricsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // 1. Subtarea: Ventas (con sus fallbacks)
  const fetchSales = async (): Promise<any[]> => {
    try {
      let qCarga = supabase
        .from('carga_actual')
        .select('*')
        .ilike('agencia', agencyName)
        .gte('fecha', fDesdeAdmin)
        .lte('fecha', fHastaEfectivo);

      if (uIdAdmin) {
        qCarga = qCarga.eq('user_id', uIdAdmin);
      }
      const { data: dataCarga } = await qCarga;

      if (dataCarga && dataCarga.length > 0) {
        return dataCarga.map((r: any) => ({
          ...r,
          monto_venta: Number(r.venta ?? r.monto_venta ?? 0),
          comision: Number(r.comision ?? 0),
          monto_premios: Number(r.premios ?? r.monto_premios ?? 0),
          neto: Number(r.neto ?? 0),
          moneda: normalizarMoneda(r.moneda),
          sistema: String(r.sistema || 'BETM3').trim().toUpperCase()
        }));
      }

      // Fallback carga_actual sin fecha
      let qCargaAny = supabase
        .from('carga_actual')
        .select('*')
        .ilike('agencia', agencyName);

      if (uIdAdmin) {
        qCargaAny = qCargaAny.eq('user_id', uIdAdmin);
      }
      const { data: dataCargaAny } = await qCargaAny;

      if (dataCargaAny && dataCargaAny.length > 0) {
        return dataCargaAny.map((r: any) => ({
          ...r,
          monto_venta: Number(r.venta ?? r.monto_venta ?? 0),
          comision: Number(r.comision ?? 0),
          monto_premios: Number(r.premios ?? r.monto_premios ?? 0),
          neto: Number(r.neto ?? 0),
          moneda: normalizarMoneda(r.moneda),
          sistema: String(r.sistema || 'BETM3').trim().toUpperCase()
        }));
      }

      // Fallback a cda_reportes_diarios
      const { data: dataRep } = await supabase
        .from('cda_reportes_diarios')
        .select('*')
        .ilike('nombre_agency', agencyName)
        .gte('fecha', fDesdeCarga)
        .lte('fecha', fHastaEfectivo);

      if (dataRep && dataRep.length > 0) {
        return dataRep.map((r: any) => {
          const v = Number(r.monto_ventas ?? r.monto_venta ?? 0);
          const c = Number(r.comision ?? 0);
          const p = Number(r.monto_premios ?? 0);
          return {
            ...r,
            monto_venta: v,
            comision: c,
            monto_premios: p,
            neto: Number(r.neto ?? (v - c - p)),
            moneda: normalizarMoneda(r.moneda),
            sistema: String(r.sistema || 'BETM3').trim().toUpperCase()
          };
        });
      }
    } catch (err) {
      console.error('Error querying sales data:', err);
    }
    return [];
  };

  // 2. Subtarea: Gastos (con sus fallbacks)
  const fetchExpenses = async (): Promise<any[]> => {
    try {
      const { data: dataGastos } = await supabase
        .from('gastos')
        .select('*')
        .ilike('agencia', agencyName)
        .gte('fecha', fDesdeAdmin)
        .lte('fecha', fHastaEfectivo);

      if (dataGastos && dataGastos.length > 0) {
        return dataGastos.map((g: any) => ({
          ...g,
          concepto: g.concepto || g.descripcion || 'Gasto General',
          moneda: normalizarMoneda(g.moneda),
          monto: Number(g.monto ?? 0)
        }));
      }

      const { data: dataGastosAny } = await supabase
        .from('gastos')
        .select('*')
        .ilike('agencia', agencyName);

      if (dataGastosAny && dataGastosAny.length > 0) {
        return dataGastosAny.map((g: any) => ({
          ...g,
          concepto: g.concepto || g.descripcion || 'Gasto General',
          moneda: normalizarMoneda(g.moneda),
          monto: Number(g.monto ?? 0)
        }));
      }

      const { data: dataCdaGastos } = await supabase
        .from('cda_gastos_diarios')
        .select('*')
        .ilike('agencia', agencyName)
        .gte('fecha', fDesdeCarga)
        .lte('fecha', fHastaEfectivo);

      if (dataCdaGastos && dataCdaGastos.length > 0) {
        return dataCdaGastos.map((g: any) => ({
          ...g,
          moneda: normalizarMoneda(g.moneda),
          monto: Number(g.monto ?? 0)
        }));
      }
    } catch (err) {
      console.error('Error querying expenses data:', err);
    }
    return [];
  };

  // 3. Subtarea: Pagos Unificados (bancos, diarios, semanales) en paralelo
  const fetchPayments = async (): Promise<any[]> => {
    try {
      const [bankRes, dailyRes, weekRes] = await Promise.all([
        supabase
          .from('cda_pagos_bancarios')
          .select('*')
          .ilike('agencia', agencyName)
          .gte('fecha', fDesdeCarga)
          .lte('fecha', fHastaEfectivo),
        supabase
          .from('cda_pagos_diarios')
          .select('*')
          .ilike('agencia', agencyName)
          .gte('fecha', fDesdeCarga)
          .lte('fecha', fHastaEfectivo),
        supabase
          .from('pagos_semana')
          .select('*')
          .ilike('agencia', agencyName)
          .gte('fecha', fDesdeAdmin)
          .lte('fecha', fHastaEfectivo)
      ]);

      const bankData = bankRes.data || [];
      const dailyData = dailyRes.data || [];
      const weekData = weekRes.data || [];

      const unified: any[] = [];

      dailyData.forEach((p: any) => {
        unified.push({
          ...p,
          origen: 'cda_pagos_diarios',
          tabla: 'cda_pagos_diarios',
          metodo: p.metodo || 'EFECTIVO',
          metodo_pago: p.metodo_pago || 'EFECTIVO',
          referencia: p.referencia || 'Efectivo',
          moneda: normalizarMoneda(p.moneda),
          monto: Number(p.monto ?? 0)
        });
      });

      bankData.forEach((b: any) => {
        const ref = String(b.referencia || '').trim();
        const metodo = String(b.metodo_pago || 'Pago Bancario').trim();
        const concepto = String(b.concepto || '').trim();
        const tipo = concepto && !metodo.toUpperCase().includes(concepto.toUpperCase())
          ? `${concepto} - ${metodo}`
          : metodo;

        unified.push({
          ...b,
          origen: 'cda_pagos_bancarios',
          tabla: 'cda_pagos_bancarios',
          tipo_pago: ref ? `${tipo} (Ref: ${ref})` : tipo,
          concepto: concepto || metodo,
          metodo_pago: metodo,
          referencia: ref || b.pos_o_cuenta || 'Banco',
          moneda: normalizarMoneda(b.moneda),
          monto: Number(b.monto ?? 0)
        });
      });

      weekData.forEach((w: any) => {
        const montoPs = Number(w.monto ?? 0);
        const fechaPs = String(w.fecha || '').slice(0, 10);
        const yaExiste = unified.some(
          (u) => String(u.fecha || '').slice(0, 10) === fechaPs && Math.abs(Number(u.monto) - montoPs) < 0.01
        );
        if (!yaExiste && montoPs > 0) {
          unified.push({
            ...w,
            origen: 'pagos_semana',
            tabla: 'pagos_semana',
            tipo_pago: w.tipo_pago || w.metodo || 'Pago',
            referencia: w.referencia || 'Semana',
            moneda: normalizarMoneda(w.moneda),
            monto: montoPs
          });
        }
      });

      return unified;
    } catch (err) {
      console.error('Error querying unified payments:', err);
      return [];
    }
  };

  // 4. Subtarea: Tickets Premiados
  const fetchTickets = async (): Promise<any[]> => {
    try {
      const { data: tData } = await supabase
        .from('cda_premios_tickets')
        .select('*')
        .ilike('agencia', agencyName)
        .gte('fecha', fDesdeCarga)
        .lte('fecha', fHastaAdmin);

      return (tData || []).map((t: any) => ({
        ...t,
        moneda: normalizarMoneda(t.moneda),
        monto: Number(t.monto ?? 0)
      }));
    } catch (err) {
      console.warn('Error querying tickets prizes:', err);
      return [];
    }
  };

  // 5. Subtarea: Saldos anteriores de todas las monedas en paralelo
  const fetchAnteriorBalances = async (): Promise<Record<string, number>> => {
    const balances: Record<string, number> = {};
    await Promise.all(
      assignedCurrencies.map(async (mCode) => {
        balances[mCode] = await obtenerSaldoAnterior(agencyName, todayStr, mCode, cajeroId, agencyData);
      })
    );
    return balances;
  };

  // 🚀 DISPARO SIMULTÁNEO DE TODAS LAS CONSULTAS (4X MÁS RÁPIDO) 🚀
  const [salesRows, expensesRows, paymentsRows, ticketsRows, anteriorBalancesMap] = await Promise.all([
    fetchSales(),
    fetchExpenses(),
    fetchPayments(),
    fetchTickets(),
    fetchAnteriorBalances()
  ]);

  // CALCULAR RESULTADOS POR CADA MONEDA ASIGNADA (SIN RECONSULTAS)
  const results: Record<string, CurrencyOperationalMetrics> = {};

  for (const mCode of assignedCurrencies) {
    const sym = mCode === 'BS' ? 'Bs.' : mCode === 'USD' ? '$' : 'COP$';

    // Filtrar ventas por moneda y sistemas permitidos
    let vM = salesRows.filter((s) => normalizarMoneda(s.moneda) === mCode);
    if (assignedSystems.length > 0) {
      vM = vM.filter((s) => assignedSystems.includes(String(s.sistema || '').toUpperCase()));
    }
    if (cajeroId) {
      vM = vM.filter((s) => String(s.cajero_id) === cajeroId);
    }

    // Filtrar gastos
    let gM = expensesRows.filter((g) => normalizarMoneda(g.moneda) === mCode);
    if (cajeroId) {
      gM = gM.filter((g) => String(g.cajero_id) === cajeroId);
    }

    // Filtrar pagos
    let pM = paymentsRows.filter((p) => normalizarMoneda(p.moneda) === mCode);
    if (cajeroId) {
      pM = pM.filter((p) => String(p.cajero_id) === cajeroId);
    }

    // Filtrar tickets
    let tM = ticketsRows.filter((t) => normalizarMoneda(t.moneda) === mCode);
    if (cajeroId) {
      tM = tM.filter((t) => String(t.cajero_id) === cajeroId);
    }

    // Clasificar pagos
    const pMClassified = pM.map((p) => {
      const tipoClasif = clasificarPagoRegistro(p);
      return {
        ...p,
        tipo_clasif: tipoClasif
      };
    });

    const pagosOrdinarios = pMClassified.filter((p) => p.tipo_clasif === 'BANCO' || p.tipo_clasif === 'EFECTIVO');
    const pagosPremios = pMClassified.filter((p) => p.tipo_clasif === 'PREMIO');

    // Totales de métricas
    const totalVenta = vM.reduce((acc, r) => acc + (Number(r.monto_venta) || 0), 0);
    const totalComision = vM.reduce((acc, r) => acc + (Number(r.comision) || 0), 0);
    const premiosRep = vM.reduce((acc, r) => acc + (Number(r.monto_premios) || 0), 0);
    const premiosTick = tM.reduce((acc, r) => acc + (Number(r.monto) || 0), 0);
    const totalPremios = Math.max(premiosRep, premiosTick);

    // Gastos no rechazados
    const gastosValidos = gM.filter((g) => !g.rechazado);
    const totalGastos = gastosValidos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

    // Pagos no rechazados
    const pagosBancoValidos = pMClassified.filter((p) => p.tipo_clasif === 'BANCO' && !p.rechazado);
    const totalPagoBanco = pagosBancoValidos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

    const pagosEfecValidos = pMClassified.filter((p) => p.tipo_clasif === 'EFECTIVO' && !p.rechazado);
    const totalPagoEfectivo = pagosEfecValidos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

    const pagosPremiosValidos = pMClassified.filter((p) => p.tipo_clasif === 'PREMIO' && !p.rechazado);
    const totalPagoPremios = pagosPremiosValidos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

    // Resultados
    const saldoOp = totalVenta - totalComision - totalPremios;
    const saldoNeto = saldoOp - totalGastos - totalPagoEfectivo - totalPagoBanco + totalPagoPremios;
    const saldoAnt = anteriorBalancesMap[mCode] ?? 0;
    const saldoActual = saldoAnt + saldoNeto;

    // Filas para las tablas del ciclo
    const ventasDetalle: VentasDetalleRow[] = vM.map((v) => ({
      fecha: String(v.fecha || todayStr).slice(0, 10),
      sistema: v.sistema || 'BETM3',
      moneda: mCode,
      venta: Number(v.monto_venta || 0),
      comision: Number(v.comision || 0),
      premios: Number(v.monto_premios || 0),
      neto: Number(v.neto || 0)
    }));

    const gastosDetalle: GastosDetalleRow[] = gM.map((g) => ({
      id: g.id,
      fecha: String(g.fecha || todayStr).slice(0, 10),
      agencia: g.agencia || agencyName,
      cajero: g.cajero || g.nombre_cajero || '-',
      concepto: g.concepto || 'Gasto General',
      moneda: mCode,
      monto: Number(g.monto || 0),
      confirmado: g.confirmado,
      rechazado: g.rechazado,
      motivo_rechazo: g.motivo_rechazo
    }));

    const pagosOrdinariosDetalle: PagosDetalleRow[] = pagosOrdinarios.map((p) => ({
      id: p.id,
      fecha: String(p.fecha || todayStr).slice(0, 10),
      agencia: p.agencia || agencyName,
      cajero: p.cajero || p.nombre_cajero || '-',
      tipo_pago: p.tipo_pago || p.concepto || 'Pago Registrado',
      referencia: p.referencia || p.pos_o_cuenta || 'Efectivo',
      moneda: mCode,
      monto: Number(p.monto || 0),
      confirmado: p.confirmado,
      rechazado: p.rechazado,
      motivo_rechazo: p.motivo_rechazo,
      tipo_clasif: p.tipo_clasif
    }));

    const pagosPremiosDetalle: PagosDetalleRow[] = pagosPremios.map((p) => ({
      id: p.id,
      fecha: String(p.fecha || todayStr).slice(0, 10),
      agencia: p.agencia || agencyName,
      cajero: p.cajero || p.nombre_cajero || '-',
      tipo_pago: p.tipo_pago || p.concepto || 'Pago de Premios / Reposición',
      referencia: p.referencia || p.pos_o_cuenta || '-',
      moneda: mCode,
      monto: Number(p.monto || 0),
      confirmado: p.confirmado,
      rechazado: p.rechazado,
      motivo_rechazo: p.motivo_rechazo,
      tipo_clasif: p.tipo_clasif
    }));

    // Generar formato de texto de ticket matching taquilla.py
    const lines: string[] = [];
    lines.push('====================================');
    lines.push(`  Reporte (${mCode}): ${fDesdeAdmin} al ${fHastaAdmin}`);
    lines.push(`  ${agencyName}`);
    lines.push('====================================');
    if (ventasDetalle.length > 0) {
      const fechasUnicas = Array.from(new Set(ventasDetalle.map((v) => v.fecha || fDesdeAdmin))).sort();
      for (const fe of fechasUnicas) {
        lines.push(`  --- ${fe} ---`);
        const diaRows = ventasDetalle.filter((v) => (v.fecha || fDesdeAdmin) === fe);
        for (const r of diaRows) {
          lines.push(`  ${r.sistema}`);
          lines.push(`    Venta:    ${sym} ${r.venta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(10)}`);
          lines.push(`    Comisión: ${sym} ${r.comision.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(10)}`);
          lines.push(`    Premios:  ${sym} ${r.premios.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(10)}`);
        }
        lines.push('------------------------------------');
      }
    }
    lines.push('====================================');
    lines.push(`  TOTAL VENTAS:    ${sym} ${totalVenta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(10)}`);
    lines.push(`  TOTAL COMISION:  ${sym} ${totalComision.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(10)}`);
    lines.push(`  TOTAL PREMIOS:   ${sym} ${totalPremios.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(10)}`);
    lines.push(`  TOTAL GASTOS:    ${sym} ${totalGastos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(10)}`);
    lines.push(`  PAGO EFECTIVO:   ${sym} ${totalPagoEfectivo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(10)}`);
    lines.push(`  PAGOS BANCOS:    ${sym} ${totalPagoBanco.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(10)}`);
    lines.push(`  PAGO PREMIOS:    ${sym} ${totalPagoPremios.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(10)}`);
    lines.push('------------------------------------');
    lines.push(`  SALDO PERIODO:   ${sym} ${saldoOp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(10)}`);
    lines.push(`  SALDO ANTERIOR:  ${sym} ${saldoAnt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(10)}`);
    lines.push(`  SALDO ACTUAL:    ${sym} ${saldoActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(10)}`);
    lines.push('====================================');
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    lines.push(`  Generado: ${nowStr}`);
    lines.push('====================================');
    const rawTicketText = lines.join('\n');

    results[mCode] = {
      moneda: mCode,
      sym,
      saldoAnterior: saldoAnt,
      ventas: totalVenta,
      comisiones: totalComision,
      premios: totalPremios,
      resultadoOp: saldoOp,
      gastos: totalGastos,
      pagoEfectivo: totalPagoEfectivo,
      pagoBanco: totalPagoBanco,
      pagoPremios: totalPagoPremios,
      saldoNeto,
      saldoActual,
      ventasDetalle,
      gastosDetalle,
      pagosOrdinariosDetalle,
      pagosPremiosDetalle,
      rawTicketText
    };
  }

  // Guardar en caché para evitar reconsultas continuas
  metricsCache.set(cacheKey, { timestamp: Date.now(), data: results });

  return results;
}
