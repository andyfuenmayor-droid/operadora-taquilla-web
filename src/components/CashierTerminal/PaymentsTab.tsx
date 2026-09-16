import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  fetchFullCycleMetrics, 
  type CurrencyOperationalMetrics 
} from '../../utils/operationalDashboard';
import { formatMoney, getTodayDateString } from '../../utils/formatters';
import { 
  Save, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  X, 
  Users 
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PaymentRow {
  id: number;
  fecha: string;
  agencia: string;
  cajero_id?: string | null;
  nombre_cajero?: string;
  cajero?: string;
  tipo_pago: string;
  moneda: string;
  monto: number;
  confirmado?: boolean;
  rechazado?: boolean;
  motivo_rechazo?: string;
  qr_token?: string;
  pin_6?: string;
  supervisor_nombre?: string;
}

const FLAG_MAP: Record<string, string> = {
  BS: '🇻🇪',
  USD: '🇺🇸',
  COP: '🇨🇴',
  EUR: '🇪🇺',
  BRL: '🇧🇷'
};

export const PaymentsTab: React.FC = () => {
  const { user, agency, systemCycle, assignedCurrencies, assignedSystems, isDayClosed } = useAuth();
  
  // Fecha seleccionada para ver pagos (por defecto hoy o hasta del ciclo)
  const defaultFecha = systemCycle?.hasta || getTodayDateString();
  const [fechaFiltro, setFechaFiltro] = useState(defaultFecha);

  // Supervisor cashier and collector filter
  const [cashiersList, setCashiersList] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedCashier, setSelectedCashier] = useState<string>('all');
  const [cobradoresList, setCobradoresList] = useState<{ id: number; nombre: string; usuario: string }[]>([]);
  const [selectedCobradorId, setSelectedCobradorId] = useState<string>('');
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Estado de Deuda / Saldo Pendiente por Moneda
  const [metricsByCurrency, setMetricsByCurrency] = useState<Record<string, CurrencyOperationalMetrics>>({});
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Estado de Efectivo Físico en Custodia / Gaveta por Moneda
  const [custodiaMetrics, setCustodiaMetrics] = useState<Record<string, { balance: number; entradas: number; entregas: number }>>({});

  // Pagos del día
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Formulario nuevo pago
  const [fechaPago, setFechaPago] = useState(defaultFecha);
  const [monedaPago, setMonedaPago] = useState(assignedCurrencies[0] || 'BS');
  const [montoPago, setMontoPago] = useState<number | ''>('');
  const [tipoPago, setTipoPago] = useState<string>('Pago a Comercializador');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Comprobante PIN activo para entregas a cobrador
  const [activeDelivery, setActiveDelivery] = useState<{
    agencia: string;
    fecha: string;
    monto: number;
    moneda: string;
    pin: string;
  } | null>(null);

  const agencyName = agency?.nombre_agencia || '';
  const isSupervisor = user?.rol === 'supervisor' || user?.rol === 'admin';
  const isAgencia = user?.rol === 'agencia';

  // Opciones de Concepto según el rol
  const paymentTypeOptions = React.useMemo(() => {
    if (isAgencia) {
      return ['Pago a Comercializador', 'Entregado a Cobrador'];
    }
    if (user?.rol === 'cajero') {
      return ['Entregado a Supervisor'];
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
    if (paymentTypeOptions.length > 0 && !paymentTypeOptions.includes(tipoPago)) {
      setTipoPago(paymentTypeOptions[0]);
    }
    if (assignedCurrencies.length > 0 && !assignedCurrencies.includes(monedaPago)) {
      setMonedaPago(assignedCurrencies[0]);
    }
  }, [paymentTypeOptions, assignedCurrencies, tipoPago, monedaPago]);

  // Cargar lista de cajeros para Supervisor
  useEffect(() => {
    if (isSupervisor) {
      const fetchCashiers = async () => {
        try {
          let q = supabase
            .table('taquilla_usuarios')
            .select('id, usuario, nombre_cajero, rol')
            .eq('rol', 'cajero');

          if (agency?.id) {
            q = q.eq('agencia_id', agency.id);
          }

        const { data: cajs } = await q;
        const cajeros = (cajs || []).map((u: any) => ({
          id: String(u.id),
          nombre: u.nombre_cajero || u.usuario,
        }));
        setCashiersList(cajeros);

        // Cobradores
        const { data: cobs } = await supabase
          .table('cda_cobradores')
          .select('id, nombre, usuario, activo')
          .eq('activo', true)
          .order('nombre');
        if (cobs && cobs.length > 0) {
          setCobradoresList(cobs);
          setSelectedCobradorId(String(cobs[0].id));
        }
      } catch (err) {
        console.error('Error fetching cashiers and cobradores in payments:', err);
      }
    };
    fetchCashiers();
    }
  }, [isSupervisor, agency?.id]);

  // Sincronizar fechas por defecto si cambia el ciclo
  useEffect(() => {
    if (systemCycle?.hasta) {
      setFechaFiltro(systemCycle.hasta);
      setFechaPago(systemCycle.hasta);
    }
  }, [systemCycle?.hasta]);

  // 1.1 Cargar Efectivo Físico en Custodia / Gaveta (Cajeros + Supervisor)
  const fetchCustodiaMetrics = useCallback(async () => {
    if (!agencyName) return;
    try {
      const cycleDesde = systemCycle?.desde || '';
      const cycleHasta = systemCycle?.hasta || '';

      const { data, error } = await supabase
        .table('cda_pagos_diarios')
        .select('*')
        .or(`agencia.ilike.${agencyName},nombre_agency.ilike.${agencyName}`)
        .order('id', { ascending: false });

      if (error) throw error;

      const rows = data || [];
      const metrics: Record<string, { balance: number; entradas: number; entregas: number }> = {};
      assignedCurrencies.forEach((m) => {
        metrics[m] = { balance: 0, entradas: 0, entregas: 0 };
      });

      rows.forEach((p: any) => {
        const fStr = String(p.fecha || p.created_at || '').slice(0, 10);
        const inCycle = !cycleDesde || (fStr >= cycleDesde && fStr <= (cycleHasta || fStr));
        if (!inCycle || p.rechazado) return;

        const mon = (p.moneda || 'COP').toUpperCase();
        if (!metrics[mon]) metrics[mon] = { balance: 0, entradas: 0, entregas: 0 };
        const mto = Number(p.monto) || 0;

        const isCobrador = String(p.tipo_pago || '').includes('Cobrador') || p.qr_token != null;

        if (isCobrador) {
          metrics[mon].entregas += mto;
        } else if (p.confirmado_supervisor || p.confirmado) {
          metrics[mon].entradas += mto;
        }
      });

      setCustodiaMetrics(metrics);
    } catch (err) {
      console.error('Error fetching custodia metrics in payments tab:', err);
    }
  }, [agencyName, systemCycle?.desde, systemCycle?.hasta, assignedCurrencies]);

  // 1. Cargar Estado de Deuda / Saldo Pendiente por Moneda
  const loadDebtMetrics = useCallback(async (force = false) => {
    if (!agencyName) return;
    if (!systemCycle || !systemCycle.desde || !systemCycle.hasta) return;
    setLoadingMetrics(true);
    try {
      const filterCajero = isSupervisor ? selectedCashier : (isAgencia ? null : (user?.id ? String(user.id) : null));
      const [data] = await Promise.all([
        fetchFullCycleMetrics(
          agencyName,
          systemCycle,
          assignedCurrencies,
          assignedSystems,
          user,
          agency,
          {
            filterCajeroId: filterCajero,
            forceRefresh: force
          }
        ),
        fetchCustodiaMetrics()
      ]);
      setMetricsByCurrency(data);
    } catch (err) {
      console.error('Error fetching debt metrics in payments:', err);
    } finally {
      setLoadingMetrics(false);
    }
  }, [agencyName, systemCycle?.desde, systemCycle?.hasta, assignedCurrencies, assignedSystems, user, agency, isSupervisor, isAgencia, selectedCashier, fetchCustodiaMetrics]);

  // 2. Cargar Pagos del Día filtrado
  const fetchPayments = useCallback(async () => {
    if (!agencyName) return;
    setLoadingPayments(true);
    try {
      let q = supabase
        .table('cda_pagos_diarios')
        .select('*')
        .eq('fecha', fechaFiltro)
        .or(`agencia.ilike.${agencyName},nombre_agency.ilike.${agencyName}`);

      if (!isSupervisor && !isAgencia && user?.id) {
        q = q.eq('cajero_id', String(user.id));
      } else if (isSupervisor && selectedCashier !== 'all') {
        q = q.eq('cajero_id', selectedCashier);
      }

      const { data, error } = await q.order('id', { ascending: false });
      if (error) throw error;
      setPayments((data || []) as PaymentRow[]);
    } catch (err) {
      console.error('Error fetching payments of day:', err);
    } finally {
      setLoadingPayments(false);
    }
  }, [agencyName, fechaFiltro, isSupervisor, isAgencia, selectedCashier, user?.id]);

  useEffect(() => {
    if (agencyName && systemCycle?.desde) {
      loadDebtMetrics();
    }
  }, [loadDebtMetrics, agencyName, systemCycle?.desde]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleRefreshAll = () => {
    loadDebtMetrics(true);
    fetchPayments();
    fetchCustodiaMetrics();
  };

  // 3. Registrar Nuevo Pago
  const handleGuardarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMonto = typeof montoPago === 'number' ? montoPago : parseFloat(String(montoPago));
    if (!parsedMonto || parsedMonto <= 0) {
      setErrorMsg('Ingrese un monto válido mayor a cero.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    let pin6: string | undefined = undefined;
    let qrTokenVal: string | null = null;
    let cobradorIdNum: number | null = null;
    let cobradorNomStr: string | null = null;

    const isEntregaCobrador = tipoPago.includes('Cobrador');

    const currentSaldoEnCaja = Math.max(0, (custodiaMetrics[monedaPago]?.entradas || 0) - (custodiaMetrics[monedaPago]?.entregas || 0));
    if ((isEntregaCobrador || tipoPago.includes('Premios') || tipoPago.includes('Comercializador')) && currentSaldoEnCaja > 0 && parsedMonto > currentSaldoEnCaja) {
      const proceed = window.confirm(
        `Atención: El monto ingresado (${formatMoney(parsedMonto, monedaPago)}) excede el efectivo disponible en caja (${formatMoney(currentSaldoEnCaja, monedaPago)}).\n\n¿Desea continuar con el registro de todas formas?`
      );
      if (!proceed) return;
    }

    if (isEntregaCobrador) {
      pin6 = `${Math.floor(Math.random() * 900000 + 100000)}`;
      qrTokenVal = `QR-REC-${pin6}`;
      if (selectedCobradorId) {
        cobradorIdNum = Number(selectedCobradorId);
        const foundCob = cobradoresList.find((c) => String(c.id) === String(selectedCobradorId));
        cobradorNomStr = foundCob?.nombre || 'Cobrador Ruta';
      }
    }

    try {
      const supName = user?.nombre || user?.usuario || 'Supervisor';
      const newPayment = {
        fecha: fechaPago,
        agencia: agencyName,
        nombre_agency: agencyName,
        cajero_id: isEntregaCobrador ? null : (user?.id ? String(user.id) : null),
        user_id: user?.user_id || user?.id,
        tipo_pago: tipoPago,
        monto: Math.round(parsedMonto * 100) / 100,
        moneda: monedaPago,
        qr_token: qrTokenVal,
        cobrador_id: cobradorIdNum,
        cobrador_nombre: cobradorNomStr,
        confirmado: isEntregaCobrador,
        confirmado_supervisor: isEntregaCobrador,
        supervisor_nombre: isEntregaCobrador ? supName : null,
        comentario_supervisor: isEntregaCobrador ? `Entrega Supervisor (${supName}) a Cobrador (${cobradorNomStr || 'Cobrador'}) - (PIN: ${pin6})` : null,
        rechazado: false,
      };

      const { data: insData, error } = await supabase
        .table('cda_pagos_diarios')
        .insert(newPayment)
        .select()
        .single();

      if (error) throw error;

      if (isEntregaCobrador) {
        // También asentar en cda_caja_efectivo_supervisor como salida de custodia
        await supabase
          .table('cda_caja_efectivo_supervisor')
          .insert({
            user_id: user?.id,
            agencia: agencyName,
            supervisor_nombre: supName,
            tipo_movimiento: 'ENTREGA_COBRADOR',
            monto: Math.round(parsedMonto * 100) / 100,
            moneda: monedaPago,
            pago_id: insData?.id || null,
            comentario: `Entrega de caja ${agencyName} a Cobrador (Cobrador: ${cobradorNomStr || 'Cobrador'} | PIN: ${pin6})`
          });
      }

      confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
      setSuccessMsg(`Pago registrado con éxito.`);

      if (pin6) {
        setActiveDelivery({
          agencia: agencyName,
          fecha: fechaPago,
          monto: parsedMonto,
          moneda: monedaPago,
          pin: pin6,
        });
      }

      setMontoPago('');
      fetchPayments();
      loadDebtMetrics(true);
    } catch (err: unknown) {
      console.error('Error registering payment:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar el pago.');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmar efectivo entregado por cajero (Supervisor)
  const handleConfirmPayment = async (p: PaymentRow) => {
    setProcessingId(p.id);
    try {
      const nowIso = new Date().toISOString();
      const supName = user?.nombre || user?.usuario || 'Supervisor';
      const cName = p.nombre_cajero || p.cajero || 'Cajero';

      const { error: errPag } = await supabase
        .table('cda_pagos_diarios')
        .update({
          confirmado: true,
          confirmado_supervisor: true,
          supervisor_nombre: supName,
          fecha_confirmacion_supervisor: nowIso,
          rechazado: false,
          motivo_rechazo: null
        })
        .eq('id', p.id);

      if (errPag) throw errPag;

      await supabase
        .table('cda_caja_efectivo_supervisor')
        .insert({
          user_id: user?.id,
          agencia: p.agencia || agencyName,
          supervisor_nombre: supName,
          tipo_movimiento: 'ENTRADA_CAJERO',
          monto: Number(p.monto),
          moneda: p.moneda,
          pago_id: p.id,
          comentario: `Recibido de cajero ${cName} (Confirmado por ${supName})`
        });

      confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
      await fetchPayments();
      await loadDebtMetrics(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al confirmar pago');
    } finally {
      setProcessingId(null);
    }
  };

  // Rechazar efectivo de cajero (Supervisor)
  const handleRejectPayment = async (p: PaymentRow) => {
    const motivo = window.prompt(`Ingrese motivo de rechazo del pago #${p.id}:`);
    if (!motivo) return;

    setProcessingId(p.id);
    try {
      const supName = user?.nombre || user?.usuario || 'Supervisor';
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .table('cda_pagos_diarios')
        .update({
          confirmado: false,
          confirmado_supervisor: false,
          rechazado: true,
          rechazado_por: supName,
          motivo_rechazo: motivo.trim(),
          fecha_rechazo: nowIso
        })
        .eq('id', p.id);

      if (error) throw error;

      await supabase
        .table('cda_caja_efectivo_supervisor')
        .delete()
        .eq('pago_id', p.id);

      await fetchPayments();
      await loadDebtMetrics(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al rechazar pago');
    } finally {
      setProcessingId(null);
    }
  };

  const renderStatusBadge = (confirmado?: boolean, rechazado?: boolean) => {
    if (rechazado) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <XCircle className="w-3 h-3" />
          Rechazado
        </span>
      );
    }
    if (confirmado) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" />
          Confirmado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <Clock className="w-3 h-3" />
        Pendiente
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Encabezado de Página y Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-300">
              📅 Ver pagos del día:
            </label>
            <input
              type="date"
              value={fechaFiltro}
              onChange={(e) => {
                setFechaFiltro(e.target.value);
                setFechaPago(e.target.value);
              }}
              className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
            />
          </div>

          {isSupervisor && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <select
                value={selectedCashier}
                onChange={(e) => setSelectedCashier(e.target.value)}
                className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer"
              >
                <option value="all">👥 TODOS LOS CAJEROS</option>
                {cashiersList.map((c) => (
                  <option key={c.id} value={c.id}>
                    👤 {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button
          onClick={handleRefreshAll}
          disabled={loadingPayments || loadingMetrics}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${(loadingPayments || loadingMetrics) ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* 2. Sección: Estado de Deuda / Saldo Pendiente por Moneda */}
      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2 tracking-wide">
            <span>💳 Estado de Deuda / Saldo Pendiente por Moneda</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Consulta en tiempo real cuánto debes en cada moneda asignada para este periodo operativo antes de registrar tu pago.
          </p>
        </div>

        {/* Grid de Tarjetas de Deuda por Moneda */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {assignedCurrencies.map((mCode) => {
            const flag = FLAG_MAP[mCode] || '💱';
            const metrics = metricsByCurrency[mCode];
            const sym = metrics?.sym || (mCode === 'BS' ? 'Bs.' : mCode === 'USD' ? '$' : 'COP$');

            const saldoAnt = metrics?.saldoAnterior ?? 0;
            const saldoOp = metrics?.resultadoOp ?? 0;
            const gastos = metrics?.gastos ?? 0;
            const pagosAbonados = (metrics?.pagoEfectivo ?? 0) + (metrics?.pagoBanco ?? 0) - (metrics?.pagoPremios ?? 0);
            const saldoAct = metrics?.saldoActual ?? (saldoAnt + saldoOp - gastos - pagosAbonados);

            const isDebt = saldoAct > 0.005;
            const isFavor = saldoAct < -0.005;

            const metCustodia = custodiaMetrics[mCode] || { balance: 0, entradas: 0, entregas: 0 };
            const saldoEnCaja = Math.max(0, metCustodia.entradas - metCustodia.entregas);

            return (
              <div 
                key={mCode}
                className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col justify-between"
              >
                {/* Cabecera Tarjeta: Bandera + Moneda + Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="font-black text-base text-white flex items-center gap-1.5">
                    <span>{flag}</span>
                    <span>{mCode}</span>
                  </div>

                  <div>
                    {isDebt && (
                      <span className="bg-rose-500/15 text-rose-400 border border-rose-500/35 rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                        🔴 DEUDA PENDIENTE
                      </span>
                    )}
                    {isFavor && (
                      <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                        🟢 SALDO A FAVOR
                      </span>
                    )}
                    {!isDebt && !isFavor && (
                      <span className="bg-slate-700/40 text-slate-300 border border-slate-600/40 rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                        ⚪ AL DÍA / SOLVENTE
                      </span>
                    )}
                  </div>
                </div>

                {/* Monto que debes pagar */}
                <div className="my-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {isDebt ? 'Monto que debes pagar (Deuda con Operadora)' : (isFavor ? 'Saldo a favor de la Taquilla' : 'Sin deuda pendiente')}
                  </div>
                  <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight mt-0.5 ${
                    isDebt ? 'text-rose-500' : (isFavor ? 'text-emerald-400' : 'text-slate-300')
                  }`}>
                    {sym} {Math.abs(saldoAct).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Desglose de 4 Conceptos */}
                <div className="border-t border-slate-700/60 pt-2.5 mt-2 space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Saldo Anterior:</span>
                    <b className="text-slate-200 font-mono">{sym} {saldoAnt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Resultado Operativo:</span>
                    <b className="text-slate-200 font-mono">{sym} {saldoOp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Gastos:</span>
                    <b className="text-slate-200 font-mono">{sym} {gastos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Pagos Abonados:</span>
                    <b className="text-slate-200 font-mono">{sym} {pagosAbonados.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  </div>
                </div>

                {/* 🏦 Bloque Destacado: Efectivo Físico en Caja */}
                <div className="mt-3 bg-[#0B221A] border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between shadow-inner">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase text-emerald-300 tracking-wider flex items-center gap-1">
                      <span>🏦</span>
                      <span>Efectivo Disponible en Caja</span>
                    </div>
                    <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                      {sym} {saldoEnCaja.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[9px] text-emerald-300/70 font-sans">
                      {saldoEnCaja > 0 ? 'Para pago de premios a clientes, gastos y entregas' : 'Sin efectivo en custodia / Caja al día'}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border font-mono ${
                    saldoEnCaja > 0 
                      ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40' 
                      : 'text-slate-400 bg-slate-800 border-slate-700'
                  }`}>
                    {saldoEnCaja > 0 ? '🟢 En Caja' : '⚪ $0.00'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Comprobante PIN de Entrega a Cobrador Activo (si se generó uno) */}
      {activeDelivery && (
        <div className="bg-gradient-to-r from-emerald-950/80 via-[#0D1B22] to-sky-950/80 border-2 border-emerald-500 rounded-3xl p-6 shadow-2xl relative text-center animate-fadeIn">
          <button
            onClick={() => setActiveDelivery(null)}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-between mb-2">
            <h4 className="text-base font-extrabold text-emerald-400 flex items-center gap-2">
              <span>🛵 Comprobante de Entrega a Cobrador</span>
            </h4>
            <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-md text-xs font-black border border-emerald-500/30">
              PIN ACTIVO
            </span>
          </div>

          <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
            Díctale este PIN de 6 dígitos al Cobrador de Ruta para validar la recepción del efectivo en 1 segundo:
          </p>

          <div className="bg-slate-900 border-2 border-emerald-400 rounded-2xl py-3 px-6 max-w-xs mx-auto my-4 shadow-xl">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest block">
              🔢 CÓDIGO PIN (6 DÍGITOS)
            </span>
            <span className="text-4xl font-black font-mono tracking-[0.25em] text-white">
              {activeDelivery.pin}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 max-w-md mx-auto">
            <div><b>🏢 Agencia:</b> {activeDelivery.agencia}</div>
            <div><b>📅 Fecha:</b> {activeDelivery.fecha}</div>
            <div className="col-span-2 text-sm mt-1">
              <b>💰 Monto:</b>{' '}
              <span className="text-emerald-400 font-black font-mono text-base">
                {activeDelivery.moneda} {activeDelivery.monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={() => setActiveDelivery(null)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
            >
              ❌ Cerrar Comprobante
            </button>
          </div>
        </div>
      )}

      {/* 4. Tabla de Pagos del Día o Mensaje Vacío */}
      <div className="space-y-2">
        {payments.length === 0 ? (
          <div className="bg-sky-500/10 border border-sky-500/20 text-sky-400 p-4 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>ℹ️ No hay pagos en este día.</span>
          </div>
        ) : (
          <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                📋 Pagos del Día ({payments.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#071217] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Agencia</th>
                    <th className="py-3 px-4">Cajero</th>
                    <th className="py-3 px-4">Pagos Registrados</th>
                    <th className="py-3 px-4">Moneda</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                    <th className="py-3 px-4 text-center">Conf.</th>
                    {isSupervisor && (
                      <th className="py-3 px-4 text-center">Acción Supervisor</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-4 text-slate-300 font-sans">{p.fecha}</td>
                      <td className="py-2.5 px-4 text-slate-400 font-sans">{p.agencia}</td>
                      <td className="py-2.5 px-4 text-slate-300 font-sans">
                        👤 {p.cajero_id 
                          ? (cashiersList.find((c) => String(c.id) === String(p.cajero_id))?.nombre || p.nombre_cajero || p.cajero || 'Cajero')
                          : (p.tipo_pago?.includes('Cobrador') 
                              ? (p.supervisor_nombre ? `${p.supervisor_nombre} (Supervisor)` : 'Supervisor') 
                              : (p.supervisor_nombre || agency?.usuario_taquilla || 'Taquilla'))}
                      </td>
                      <td className="py-2.5 px-4 text-white font-sans font-medium">{p.tipo_pago}</td>
                      <td className="py-2.5 px-4 text-slate-400">{p.moneda}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                        {formatMoney(p.monto, p.moneda)}
                      </td>
                      <td className="py-2.5 px-4 text-center font-sans">
                        {renderStatusBadge(p.confirmado, p.rechazado)}
                      </td>
                      {isSupervisor && (
                        <td className="py-2.5 px-4 text-center font-sans">
                          {!p.confirmado && !p.rechazado ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                disabled={processingId === p.id}
                                onClick={() => handleConfirmPayment(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Confirmar</span>
                              </button>
                              <button
                                disabled={processingId === p.id}
                                onClick={() => handleRejectPayment(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                <XCircle className="w-3 h-3" />
                                <span>Rechazar</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              {p.confirmado ? '✅ Recibido' : 'Rechazado'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 5. Formulario: Registrar Nuevo Pago */}
      {(!isDayClosed || isSupervisor) ? (
        <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              📝 Registrar Nuevo Pago
            </h3>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleGuardarPago} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Col 1: Fecha */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  required
                  className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                />
              </div>

              {/* Col 2: Moneda */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Moneda
                </label>
                <select
                  value={monedaPago}
                  onChange={(e) => setMonedaPago(e.target.value)}
                  className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold cursor-pointer"
                >
                  {assignedCurrencies.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Col 3: Monto */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold text-slate-400">
                    Monto
                  </label>
                  {(() => {
                    const currentSaldoEnCaja = Math.max(0, (custodiaMetrics[monedaPago]?.entradas || 0) - (custodiaMetrics[monedaPago]?.entregas || 0));
                    if (currentSaldoEnCaja <= 0) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => setMontoPago(currentSaldoEnCaja)}
                        className="text-[10px] text-emerald-400 hover:underline font-bold cursor-pointer"
                      >
                        Llenar en Caja: {formatMoney(currentSaldoEnCaja, monedaPago)}
                      </button>
                    );
                  })()}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                />
              </div>

              {/* Col 4: Tipo Pago / Concepto */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Tipo Pago / Concepto
                </label>
                <select
                  value={tipoPago}
                  onChange={(e) => setTipoPago(e.target.value)}
                  className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer"
                >
                  {paymentTypeOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {tipoPago.includes('Cobrador') && (
                <div className="sm:col-span-2 lg:col-span-4 bg-slate-900/70 p-3 rounded-xl border border-sky-500/30 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-sky-400">🛵 Seleccione el Cobrador de Ruta:</span>
                    <span className="text-[11px] text-slate-400">Se generará un PIN de 6 dígitos para validar la entrega en ruta</span>
                  </div>
                  <select
                    value={selectedCobradorId}
                    onChange={(e) => setSelectedCobradorId(e.target.value)}
                    required
                    className="bg-[#071217] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer min-w-[240px]"
                  >
                    {cobradoresList.length === 0 ? (
                      <option value="">No hay cobradores activos</option>
                    ) : (
                      cobradoresList.map((c) => (
                        <option key={c.id} value={c.id}>
                          🛵 {c.nombre} (@{c.usuario})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Botón Ancho Verde: GUARDAR PAGO */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 px-4 rounded-xl text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'GUARDANDO...' : '💾 GUARDAR PAGO'}</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>🔒 El día {fechaFiltro} está cerrado para este usuario. No se pueden registrar nuevos pagos.</span>
        </div>
      )}
    </div>
  );
};
