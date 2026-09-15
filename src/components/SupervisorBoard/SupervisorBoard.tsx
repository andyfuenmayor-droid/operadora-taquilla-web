import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { BankPayment } from '../../types';
import { formatCurrency, getTodayDateString, formatTime, formatMoney } from '../../utils/formatters';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Building2, 
  Search,
  Truck,
  Wallet,
  Users,
  AlertCircle,
  Copy,
  Check,
  X,
  CreditCard,
  Trash2,
  Ban
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AgencySummary {
  agencia: string;
  totalVentas: number;
  totalPremios: number;
  totalGastos: number;
  totalBanco: number;
  saldoEstimado: number;
  cerrado: boolean;
}

interface Cobrador {
  id: number;
  nombre: string;
  usuario: string;
  activo?: boolean;
}

interface CajeroPaymentRow {
  id: number;
  fecha: string;
  agencia: string;
  nombre_agency?: string;
  cajero_id?: string;
  user_id?: string;
  cajero?: string;
  nombre_cajero?: string;
  tipo_pago: string;
  monto: number;
  moneda: string;
  confirmado: boolean;
  confirmado_supervisor: boolean;
  supervisor_nombre?: string;
  fecha_confirmacion_supervisor?: string;
  rechazado?: boolean;
  motivo_rechazo?: string;
  qr_token?: string;
  cobrador_id?: number;
  cobrador_nombre?: string;
  estado?: string;
  fecha_escaneo_cobrador?: string;
  liquidado_admin?: boolean;
  fecha_liquidacion_admin?: string;
  created_at?: string;
}

interface CustodiaMetrics {
  balance: number;
  entradas: number;
  entregas: number;
  pendientes: number;
}

export const SupervisorBoard: React.FC = () => {
  const { user, agency, systemCycle, assignedCurrencies } = useAuth();
  const agencyName = agency?.nombre_agencia || '';
  const supervisorName = user?.nombre || user?.usuario || 'Supervisor';

  // Subpestañas del panel de supervisión
  const [activeTab, setActiveTab] = useState<'efectivo' | 'confirmaciones' | 'bancos' | 'agencias'>('efectivo');

  // Filtro de fecha (por defecto hoy o ciclo hasta)
  const defaultDate = systemCycle?.hasta || getTodayDateString();
  const [fecha, setFecha] = useState(defaultDate);
  const [loading, setLoading] = useState(false);

  // 1. Datos de Custodia y Arqueo
  const [cobradoresList, setCobradoresList] = useState<Cobrador[]>([]);
  const [cashiersList, setCashiersList] = useState<{ id: string; nombre: string }[]>([]);
  const [custodiaMetrics, setCustodiaMetrics] = useState<Record<string, CustodiaMetrics>>({});
  const [entregasCobrador, setEntregasCobrador] = useState<CajeroPaymentRow[]>([]);
  
  // 2. Datos de Confirmaciones de Cajeros
  const [cajeroPayments, setCajeroPayments] = useState<CajeroPaymentRow[]>([]);
  const [filtroCajero, setFiltroCajero] = useState<string>('all');
  const [filtroEstadoCajero, setFiltroEstadoCajero] = useState<'todos' | 'pendientes' | 'confirmados'>('pendientes');

  // 3. Formulario de Entrega a Cobrador
  const [selectedCobradorId, setSelectedCobradorId] = useState<string>('');
  const [monedaEntrega, setMonedaEntrega] = useState<string>(assignedCurrencies[0] || 'COP');
  const [montoEntrega, setMontoEntrega] = useState<number | ''>('');
  const [notaEntrega, setNotaEntrega] = useState<string>('');
  const [submittingEntrega, setSubmittingEntrega] = useState(false);
  const [entregaMsg, setEntregaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 4. Voucher PIN Activo para dictar al cobrador
  const [activePinVoucher, setActivePinVoucher] = useState<{
    pin: string;
    cobradorNombre: string;
    monto: number;
    moneda: string;
    fecha: string;
    agencia: string;
  } | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [processingEntregaId, setProcessingEntregaId] = useState<number | null>(null);

  // 5. Transferencias Bancarias
  const [pendingTransfers, setPendingTransfers] = useState<BankPayment[]>([]);
  const [filtroRangoBancos, setFiltroRangoBancos] = useState<'fecha' | 'ciclo'>('ciclo');
  const [processingId, setProcessingId] = useState<number | null>(null);

  // 6. Resumen de Agencias
  const [agencySummaries, setAgencySummaries] = useState<AgencySummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Sincronizar moneda por defecto cuando se cargan las monedas asignadas
  useEffect(() => {
    if (assignedCurrencies.length > 0 && !assignedCurrencies.includes(monedaEntrega)) {
      setMonedaEntrega(assignedCurrencies[0]);
    }
  }, [assignedCurrencies, monedaEntrega]);

  // Cargar lista de cobradores activos y cajeros de la agencia
  useEffect(() => {
    const fetchAuxData = async () => {
      try {
        // Cobradores activos
        const { data: cobs } = await supabase
          .table('cda_cobradores')
          .select('id, nombre, usuario, activo')
          .eq('activo', true)
          .order('nombre', { ascending: true });
        
        if (cobs && cobs.length > 0) {
          setCobradoresList(cobs);
          setSelectedCobradorId(String(cobs[0].id));
        }

        // Cajeros de la agencia
        let qCaj = supabase
          .table('taquilla_usuarios')
          .select('id, usuario, nombre_cajero, rol')
          .eq('rol', 'cajero');

        if (agency?.id) {
          qCaj = qCaj.eq('agencia_id', agency.id);
        }

        const { data: cajs } = await qCaj;
        const list = (cajs || []).map((c: any) => ({
          id: String(c.id),
          nombre: c.nombre_cajero || c.usuario,
        }));

        if (list.length === 0 && agency?.usuario_taquilla) {
          list.push({
            id: 'taquilla',
            nombre: agency.usuario_taquilla,
          });
        }

        setCashiersList(list);
      } catch (err) {
        console.error('Error fetching auxiliary supervisor data:', err);
      }
    };

    fetchAuxData();
  }, [agency?.id, agency?.usuario_taquilla]);

  // Helper para resolver el nombre del cajero asignado
  const resolveCajeroName = useCallback(
    (cajeroId?: string | number | null, fallbackName?: string | null) => {
      if (cajeroId !== undefined && cajeroId !== null) {
        const found = cashiersList.find((c) => String(c.id) === String(cajeroId));
        if (found?.nombre) return found.nombre;
      }
      if (
        fallbackName &&
        fallbackName.toLowerCase() !== 'cajero' &&
        fallbackName.toLowerCase() !== 'taquilla'
      ) {
        return fallbackName;
      }
      return agency?.usuario_taquilla || 'Cajero';
    },
    [cashiersList, agency?.usuario_taquilla]
  );

  // Cargar todos los datos del panel de supervisión (estrictamente acotado a la agencia y cajeros asignados)
  const fetchSupervisorData = useCallback(async () => {
    setLoading(true);
    setEntregaMsg(null);
    try {
      // 1. Fetch movimientos de custodia de caja del supervisor
      let qCaja = supabase
        .table('cda_caja_efectivo_supervisor')
        .select('*');
      
      if (agencyName) {
        qCaja = qCaja.ilike('agencia', agencyName.trim());
      }
      const { data: cajaData } = await qCaja;

      // 2. Fetch pagos diarios de taquilla (entregas de cajeros y entregas a cobrador)
      let qPagos = supabase
        .table('cda_pagos_diarios')
        .select('*')
        .order('id', { ascending: false });

      if (agencyName) {
        qPagos = qPagos.or(`agencia.ilike.${agencyName.trim()},nombre_agency.ilike.${agencyName.trim()}`);
      }
      const { data: pagosData } = await qPagos;

      // 3. Separar entregas a cobrador vs entregas de efectivo de cajeros asignados
      const rawPagos: CajeroPaymentRow[] = ((pagosData || []) as CajeroPaymentRow[]).filter((p) => {
        if (!agencyName) return true;
        const matchAg = (p.agencia || '').trim().toUpperCase() === agencyName.trim().toUpperCase() ||
                        (p.nombre_agency || '').trim().toUpperCase() === agencyName.trim().toUpperCase();
        const matchCaj = Boolean(p.cajero_id && cashiersList.some((c) => String(c.id) === String(p.cajero_id)));
        return matchAg || matchCaj;
      });
      
      const cobradorRows = rawPagos.filter((p) => 
        (p.tipo_pago && p.tipo_pago.toUpperCase().includes('COBRADOR')) || Boolean(p.qr_token)
      );
      setEntregasCobrador(cobradorRows);

      // Solo entregas de efectivo de cajeros a supervisor (excluyendo transferencias bancarias y cobrador)
      const cajeroRows = rawPagos.filter((p) => {
        const isCobrador = (p.tipo_pago && p.tipo_pago.toUpperCase().includes('COBRADOR')) || Boolean(p.qr_token);
        if (isCobrador) return false;
        const tipoP = (p.tipo_pago || '').toUpperCase();
        return tipoP.includes('SUPERVISOR') || tipoP.includes('EFECTIVO');
      });
      setCajeroPayments(cajeroRows);

      // 4. Calcular métricas de custodia por moneda
      const metrics: Record<string, CustodiaMetrics> = {};
      const monedasToCheck = Array.from(new Set([...assignedCurrencies, 'COP', 'USD', 'BS']));
      
      monedasToCheck.forEach((m) => {
        metrics[m] = { balance: 0, entradas: 0, entregas: 0, pendientes: 0 };
      });

      // Sumar de cda_caja_efectivo_supervisor
      (cajaData || []).forEach((r: any) => {
        const mon = (r.moneda || 'COP').toUpperCase();
        if (!metrics[mon]) metrics[mon] = { balance: 0, entradas: 0, entregas: 0, pendientes: 0 };
        const mto = Number(r.monto) || 0;
        if (r.tipo_movimiento === 'ENTRADA_CAJERO') {
          metrics[mon].entradas += mto;
          metrics[mon].balance += mto;
        } else {
          metrics[mon].entregas += mto;
          metrics[mon].balance -= mto;
        }
      });

      // Calcular montos pendientes por confirmar de cajeros
      cajeroRows.forEach((p) => {
        if (!p.confirmado_supervisor && !p.confirmado && !p.rechazado) {
          const mon = (p.moneda || 'COP').toUpperCase();
          if (!metrics[mon]) metrics[mon] = { balance: 0, entradas: 0, entregas: 0, pendientes: 0 };
          metrics[mon].pendientes += Number(p.monto) || 0;
        }
      });

      setCustodiaMetrics(metrics);

      // 5. Fetch transferencias bancarias (filtradas estrictamente por la agencia y cajeros asignados al supervisor)
      let qBancos = supabase
        .table('cda_pagos_bancarios')
        .select('*')
        .order('id', { ascending: false });

      if (agencyName) {
        qBancos = qBancos.ilike('agencia', agencyName.trim());
      }

      if (filtroRangoBancos === 'fecha' && fecha) {
        qBancos = qBancos.eq('fecha', fecha);
      } else if (filtroRangoBancos === 'ciclo' && systemCycle?.desde && systemCycle?.hasta) {
        qBancos = qBancos.gte('fecha', systemCycle.desde).lte('fecha', systemCycle.hasta);
      }

      const { data: bData } = await qBancos;

      // Doble filtro en memoria para garantizar aislamiento total
      const scopedTransfers = ((bData || []) as BankPayment[]).filter((t) => {
        if (!agencyName) return true;
        const matchAg = (t.agencia || '').trim().toUpperCase() === agencyName.trim().toUpperCase();
        const matchCaj = Boolean(t.cajero_id && cashiersList.some((c) => String(c.id) === String(t.cajero_id)));
        return matchAg || matchCaj;
      });
      setPendingTransfers(scopedTransfers);

      // 6. Fetch datos de agencias y cierres (si es supervisor, exclusivamente su agencia asignada)
      let qSales = supabase
        .table('cda_reportes_diarios')
        .select('nombre_agency, monto_venta, comision, monto_premios, cerrado')
        .eq('fecha', fecha);

      let qGastos = supabase
        .table('cda_gastos_diarios')
        .select('agencia, nombre_agency, monto')
        .eq('fecha', fecha);

      let qSaldo = supabase
        .table('saldo_taquilla')
        .select('nombre_agency, saldo_restante')
        .eq('fecha', fecha);

      if (user?.rol === 'supervisor' && agencyName) {
        qSales = qSales.ilike('nombre_agency', agencyName.trim());
        qGastos = qGastos.or(`agencia.ilike.${agencyName.trim()},nombre_agency.ilike.${agencyName.trim()}`);
        qSaldo = qSaldo.ilike('nombre_agency', agencyName.trim());
      }

      const { data: sData } = await qSales;
      const { data: gData } = await qGastos;
      const { data: saldoData } = await qSaldo;

      const mapAgencies: Record<string, AgencySummary> = {};

      (sData || []).forEach((row: any) => {
        const ag = row.nombre_agency || 'Sin Agencia';
        if (!mapAgencies[ag]) {
          mapAgencies[ag] = {
            agencia: ag,
            totalVentas: 0,
            totalPremios: 0,
            totalGastos: 0,
            totalBanco: 0,
            saldoEstimado: 0,
            cerrado: Boolean(row.cerrado),
          };
        }
        const venta = Number(row.monto_venta) || 0;
        const comision = Number(row.comision) || 0;
        mapAgencies[ag].totalVentas += (venta - comision);
        mapAgencies[ag].totalPremios += Number(row.monto_premios) || 0;
        if (row.cerrado) mapAgencies[ag].cerrado = true;
      });

      (gData || []).forEach((row: any) => {
        const ag = row.agencia || row.nombre_agency || 'Sin Agencia';
        if (!mapAgencies[ag]) {
          mapAgencies[ag] = {
            agencia: ag,
            totalVentas: 0,
            totalPremios: 0,
            totalGastos: 0,
            totalBanco: 0,
            saldoEstimado: 0,
            cerrado: false,
          };
        }
        mapAgencies[ag].totalGastos += Number(row.monto) || 0;
      });

      (scopedTransfers || []).forEach((row: any) => {
        const ag = row.agencia || 'Sin Agencia';
        if (!mapAgencies[ag]) {
          mapAgencies[ag] = {
            agencia: ag,
            totalVentas: 0,
            totalPremios: 0,
            totalGastos: 0,
            totalBanco: 0,
            saldoEstimado: 0,
            cerrado: false,
          };
        }
        if (row.confirmado) {
          mapAgencies[ag].totalBanco += Number(row.monto) || 0;
        }
      });

      (saldoData || []).forEach((s: any) => {
        const ag = s.nombre_agency;
        if (mapAgencies[ag]) {
          mapAgencies[ag].cerrado = true;
          if (s.saldo_restante !== undefined && s.saldo_restante !== null) {
            mapAgencies[ag].saldoEstimado = Number(s.saldo_restante);
          }
        }
      });

      Object.values(mapAgencies).forEach((summary) => {
        if (!summary.cerrado) {
          summary.saldoEstimado = summary.totalVentas - summary.totalPremios - summary.totalGastos - summary.totalBanco;
        }
      });

      const scopedAgencies = Object.values(mapAgencies).filter((summary) => {
        if (user?.rol === 'supervisor' && agencyName) {
          return summary.agencia.trim().toUpperCase() === agencyName.trim().toUpperCase();
        }
        return true;
      });

      setAgencySummaries(scopedAgencies);
    } catch (err) {
      console.error('Error fetching supervisor data:', err);
    } finally {
      setLoading(false);
    }
  }, [agencyName, assignedCurrencies, fecha, filtroRangoBancos, systemCycle, user?.rol, cashiersList]);

  useEffect(() => {
    fetchSupervisorData();
  }, [fetchSupervisorData]);

  // Suscripción Realtime para actualizar la pantalla ante movimientos de cajeros
  useEffect(() => {
    const channel = supabase
      .channel('supervisor_board_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cda_pagos_diarios' }, () => {
        fetchSupervisorData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cda_caja_efectivo_supervisor' }, () => {
        fetchSupervisorData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSupervisorData]);

  // -------------------------------------------------------------
  // ACCIÓN 1: CONFIRMAR PAGO DE EFECTIVO DE CAJERO
  // -------------------------------------------------------------
  const handleConfirmCajeroPayment = async (pago: CajeroPaymentRow) => {
    setProcessingId(pago.id);
    try {
      const nowIso = new Date().toISOString();
      const cajeroName = pago.nombre_cajero || pago.cajero || 'Cajero';

      // 1. Actualizar cda_pagos_diarios
      const { error: errPag } = await supabase
        .table('cda_pagos_diarios')
        .update({
          confirmado: true,
          confirmado_supervisor: true,
          supervisor_nombre: supervisorName,
          fecha_confirmacion_supervisor: nowIso,
          rechazado: false,
          motivo_rechazo: null
        })
        .eq('id', pago.id);

      if (errPag) throw errPag;

      // 2. Registrar en la caja de efectivo en custodia del supervisor
      const { error: errCaja } = await supabase
        .table('cda_caja_efectivo_supervisor')
        .insert({
          user_id: pago.user_id || user?.id,
          agencia: pago.agencia || agencyName,
          supervisor_nombre: supervisorName,
          tipo_movimiento: 'ENTRADA_CAJERO',
          monto: Number(pago.monto),
          moneda: pago.moneda,
          pago_id: pago.id,
          comentario: `Recibido de cajero ${cajeroName} (Confirmado por ${supervisorName})`
        });

      if (errCaja) {
        console.warn('Advertencia al insertar en cda_caja_efectivo_supervisor:', errCaja.message);
      }

      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#00C853', '#38BDF8'],
      });

      await fetchSupervisorData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al confirmar efectivo del cajero');
    } finally {
      setProcessingId(null);
    }
  };

  // -------------------------------------------------------------
  // ACCIÓN 2: RECHAZAR PAGO DE EFECTIVO DE CAJERO
  // -------------------------------------------------------------
  const handleRejectCajeroPayment = async (pago: CajeroPaymentRow) => {
    const motivo = window.prompt(`Ingrese el motivo del rechazo del pago #${pago.id} de ${pago.nombre_cajero || 'Cajero'}:`);
    if (!motivo) return;

    setProcessingId(pago.id);
    try {
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .table('cda_pagos_diarios')
        .update({
          confirmado: false,
          confirmado_supervisor: false,
          rechazado: true,
          rechazado_por: supervisorName,
          motivo_rechazo: motivo.trim(),
          fecha_rechazo: nowIso
        })
        .eq('id', pago.id);

      if (error) throw error;

      // Eliminar de cda_caja_efectivo_supervisor si existiese
      await supabase
        .table('cda_caja_efectivo_supervisor')
        .delete()
        .eq('pago_id', pago.id);

      await fetchSupervisorData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al rechazar pago');
    } finally {
      setProcessingId(null);
    }
  };

  // -------------------------------------------------------------
  // ACCIÓN 3: ENTREGAR EFECTIVO A COBRADOR Y GENERAR PIN
  // -------------------------------------------------------------
  const handleEntregarCobrador = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMonto = typeof montoEntrega === 'number' ? montoEntrega : parseFloat(String(montoEntrega));
    if (!parsedMonto || parsedMonto <= 0) {
      setEntregaMsg({ type: 'error', text: 'El monto a entregar debe ser mayor a 0.' });
      return;
    }

    if (!selectedCobradorId) {
      setEntregaMsg({ type: 'error', text: 'Seleccione un cobrador activo de la lista.' });
      return;
    }

    const cobradorSeleccionado = cobradoresList.find((c) => String(c.id) === String(selectedCobradorId));
    const cobradorNombre = cobradorSeleccionado?.nombre || 'Cobrador Ruta';

    setSubmittingEntrega(true);
    setEntregaMsg(null);

    // Generar PIN aleatorio de 6 dígitos
    const pin6 = `${Math.floor(Math.random() * 900000 + 100000)}`;
    const qrTokenVal = `QR-REC-${pin6}`;
    const fechaActual = fecha || getTodayDateString();
    const comentarioSupervisor = `Entrega Supervisor (${supervisorName}) a Cobrador (${cobradorNombre}) - (PIN: ${pin6})`;

    try {
      // 1. Insertar en cda_pagos_diarios
      const { data: insPago, error: errPago } = await supabase
        .table('cda_pagos_diarios')
        .insert({
          fecha: fechaActual,
          agencia: agencyName,
          nombre_agency: agencyName,
          tipo_pago: 'Entregado a Cobrador',
          monto: Math.round(parsedMonto * 100) / 100,
          moneda: monedaEntrega,
          user_id: user?.id,
          cajero_id: null,
          confirmado: true,
          confirmado_supervisor: true,
          supervisor_nombre: supervisorName,
          comentario_supervisor: comentarioSupervisor,
          qr_token: qrTokenVal,
          cobrador_id: Number(selectedCobradorId),
          cobrador_nombre: cobradorNombre,
          liquidado_admin: false,
        })
        .select()
        .single();

      if (errPago) throw errPago;

      // 2. Insertar en cda_caja_efectivo_supervisor como ENTREGA_COBRADOR
      const { error: errCaja } = await supabase
        .table('cda_caja_efectivo_supervisor')
        .insert({
          user_id: user?.id,
          agencia: agencyName,
          supervisor_nombre: supervisorName,
          tipo_movimiento: 'ENTREGA_COBRADOR',
          monto: Math.round(parsedMonto * 100) / 100,
          moneda: monedaEntrega,
          pago_id: insPago?.id || null,
          comentario: `Entrega de caja ${agencyName} a Cobrador (Cobrador: ${cobradorNombre} | PIN: ${pin6})`
        });

      if (errCaja) {
        console.warn('Advertencia al registrar en cda_caja_efectivo_supervisor:', errCaja.message);
      }

      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00C853', '#38BDF8', '#F59E0B'],
      });

      // Mostrar voucher activo del PIN generado
      setActivePinVoucher({
        pin: pin6,
        cobradorNombre,
        monto: parsedMonto,
        moneda: monedaEntrega,
        fecha: fechaActual,
        agencia: agencyName,
      });

      setMontoEntrega('');
      setNotaEntrega('');
      setEntregaMsg({
        type: 'success',
        text: `¡Entrega registrada con éxito! PIN generado: ${pin6} para ${cobradorNombre}.`
      });

      await fetchSupervisorData();
    } catch (err: unknown) {
      console.error('Error registrando entrega a cobrador:', err);
      setEntregaMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al registrar entrega a cobrador.'
      });
    } finally {
      setSubmittingEntrega(false);
    }
  };

  // -------------------------------------------------------------
  // ACCIÓN 3.1: VALIDAR MANUALMENTE ENTREGA A COBRADOR
  // -------------------------------------------------------------
  const handleManualValidateEntrega = async (row: CajeroPaymentRow) => {
    const cobradorName = row.cobrador_nombre || 'el cobrador';
    const montoFormatted = formatMoney(row.monto, row.moneda);
    const ok = window.confirm(
      `¿Confirmar que ${cobradorName} recibió la entrega de ${montoFormatted}?\n\nEsta acción marcará el registro como "Validado por Cobrador" en el sistema.`
    );
    if (!ok) return;

    setProcessingEntregaId(row.id);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .table('cda_pagos_diarios')
        .update({
          fecha_escaneo_cobrador: nowIso,
          cobrador_nombre: row.cobrador_nombre || `Validado por ${supervisorName}`,
          confirmado: true,
          confirmado_supervisor: true,
        })
        .eq('id', row.id);

      if (error) throw error;

      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#00C853', '#38BDF8'],
      });

      await fetchSupervisorData();
    } catch (err: unknown) {
      console.error('Error al validar entrega manualmente:', err);
      alert(err instanceof Error ? err.message : 'Error al validar entrega.');
    } finally {
      setProcessingEntregaId(null);
    }
  };

  // -------------------------------------------------------------
  // ACCIÓN 3.2: ANULAR / REVERSAR ENTREGA A COBRADOR
  // -------------------------------------------------------------
  const handleCancelEntrega = async (row: CajeroPaymentRow) => {
    const cobradorName = row.cobrador_nombre || 'el cobrador';
    const montoFormatted = formatMoney(row.monto, row.moneda);
    const motivo = window.prompt(
      `¿Desea anular la entrega de ${montoFormatted} a ${cobradorName}?\n\nEl dinero será reintegrado inmediatamente a la caja de custodia del supervisor.\n\nIndique el motivo de la anulación:`,
      'Entrega no realizada / Error de registro'
    );
    if (motivo === null) return;

    setProcessingEntregaId(row.id);
    try {
      const nowIso = new Date().toISOString();
      const pinOnly = row.qr_token ? row.qr_token.replace('QR-REC-', '') : '';

      // 1. Actualizar en cda_pagos_diarios como anulado/rechazado
      const { error: errPago } = await supabase
        .table('cda_pagos_diarios')
        .update({
          confirmado: false,
          confirmado_supervisor: false,
          rechazado: true,
          rechazado_por: supervisorName,
          motivo_rechazo: (motivo || 'Anulado desde panel de supervisor').trim(),
          fecha_rechazo: nowIso,
        })
        .eq('id', row.id);

      if (errPago) throw errPago;

      // 2. Eliminar el egreso de cda_caja_efectivo_supervisor para reintegrar el saldo a la custodia
      let qDeleteCaja = supabase
        .table('cda_caja_efectivo_supervisor')
        .delete();

      if (pinOnly) {
        qDeleteCaja = qDeleteCaja.or(`pago_id.eq.${row.id},comentario.ilike.%${pinOnly}%`);
      } else {
        qDeleteCaja = qDeleteCaja.eq('pago_id', row.id);
      }

      const { error: errCaja } = await qDeleteCaja;
      if (errCaja) {
        console.warn('Advertencia al eliminar de cda_caja_efectivo_supervisor:', errCaja.message);
      }

      await fetchSupervisorData();
    } catch (err: unknown) {
      console.error('Error al anular entrega a cobrador:', err);
      alert(err instanceof Error ? err.message : 'Error al anular entrega.');
    } finally {
      setProcessingEntregaId(null);
    }
  };

  // -------------------------------------------------------------
  // ACCIÓN 4: CONFIRMAR / RECHAZAR TRANSFERENCIAS BANCARIAS
  // -------------------------------------------------------------
  const handleConfirmTransfer = async (id?: number) => {
    if (!id) return;
    setProcessingId(id);
    try {
      const { error } = await supabase
        .table('cda_pagos_bancarios')
        .update({
          confirmado: true,
          rechazado: false,
          confirmado_supervisor: true,
          supervisor_nombre: supervisorName,
          confirmado_por: supervisorName,
          fecha_confirmacion_supervisor: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setPendingTransfers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, confirmado: true, rechazado: false } : t))
      );

      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#00C853', '#38BDF8'],
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al confirmar transferencia');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectTransfer = async (id?: number) => {
    if (!id) return;
    const motivo = window.prompt('Ingrese el motivo del rechazo de esta transferencia:');
    if (!motivo) return;

    setProcessingId(id);
    try {
      const { error } = await supabase
        .table('cda_pagos_bancarios')
        .update({
          confirmado: false,
          confirmado_supervisor: false,
          rechazado: true,
          rechazado_por: supervisorName,
          motivo_rechazo: motivo,
          fecha_rechazo: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setPendingTransfers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, confirmado: false, rechazado: true, motivo_rechazo: motivo } : t))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al rechazar');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  // Filtrado de entregas de cajeros
  const filteredCajeroPayments = useMemo(() => {
    return cajeroPayments.filter((p) => {
      // Filtro de cajero
      if (filtroCajero !== 'all' && p.cajero_id !== filtroCajero) {
        return false;
      }
      // Filtro de estado
      if (filtroEstadoCajero === 'pendientes') {
        return !p.confirmado_supervisor && !p.confirmado && !p.rechazado;
      }
      if (filtroEstadoCajero === 'confirmados') {
        return p.confirmado_supervisor || p.confirmado;
      }
      return true;
    });
  }, [cajeroPayments, filtroCajero, filtroEstadoCajero]);

  const pendientesCajerosCount = cajeroPayments.filter(
    (p) => !p.confirmado_supervisor && !p.confirmado && !p.rechazado
  ).length;

  const pendientesBancoCount = pendingTransfers.filter(
    (t) => !t.confirmado && !t.rechazado
  ).length;

  // Filtrado de agencias
  const filteredAgencies = agencySummaries.filter((ag) =>
    ag.agencia.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header Controls y Banner de Supervisión */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              Pizarra de Supervisión y Arqueo
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            </h2>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {agencyName || 'AGENCIA CENTRAL'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Custodia de efectivo, confirmación de cajeros y entregas a cobrador de ruta
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#071217] border border-slate-700 px-3 py-1.5 rounded-xl">
            <span className="text-[11px] font-bold text-slate-400">Fecha:</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none font-mono font-bold"
            />
          </div>
          <button
            onClick={fetchSupervisorData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* 2. Selector de Pestañas Principales de la Pizarra */}
      <div className="flex border-b border-slate-800 overflow-x-auto gap-2 pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('efectivo')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'efectivo'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>📦 Arqueo y Custodia (Cobrador)</span>
        </button>

        <button
          onClick={() => setActiveTab('confirmaciones')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'confirmaciones'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>💵 Confirmación de Efectivo (Cajeros)</span>
          {pendientesCajerosCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-black">
              {pendientesCajerosCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('bancos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'bancos'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>🏛️ Transferencias Bancarias</span>
          {pendientesBancoCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-sky-400 text-black">
              {pendientesBancoCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('agencias')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'agencias'
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>📊 Balance de Agencias y Cierres</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PESTAÑA 1: ARQUEO, CUSTODIA Y ENTREGAS A COBRADOR              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'efectivo' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Comprobante PIN Activo (si se generó una entrega reciente) */}
          {activePinVoucher && (
            <div className="bg-gradient-to-r from-emerald-950/90 via-[#0D1B22] to-sky-950/90 border-2 border-emerald-500 rounded-3xl p-6 shadow-2xl relative text-center">
              <button
                onClick={() => setActivePinVoucher(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-extrabold text-emerald-400 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-400" />
                  Comprobante de Entrega a Cobrador
                </span>
                <span className="bg-emerald-500/20 text-emerald-400 px-3 py-0.5 rounded-md text-xs font-black border border-emerald-500/30 animate-pulse">
                  PIN ACTIVO
                </span>
              </div>

              <p className="text-xs text-slate-300 mt-1 max-w-lg mx-auto">
                Díctale este PIN de 6 dígitos al Cobrador de Ruta para que valide la recepción del dinero en su portal:
              </p>

              <div className="bg-slate-900 border-2 border-emerald-400 rounded-2xl py-4 px-6 max-w-sm mx-auto my-4 shadow-xl">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest block">
                  🔢 CÓDIGO PIN DE VALIDACIÓN
                </span>
                <span className="text-4xl sm:text-5xl font-black font-mono tracking-[0.25em] text-white">
                  {activePinVoucher.pin}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 max-w-md mx-auto bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="text-left">🏢 <b>Agencia:</b> {activePinVoucher.agencia}</div>
                <div className="text-right">📅 <b>Fecha:</b> {activePinVoucher.fecha}</div>
                <div className="text-left">🛵 <b>Cobrador:</b> <span className="text-sky-400 font-bold">{activePinVoucher.cobradorNombre}</span></div>
                <div className="text-right">
                  💰 <b>Monto:</b>{' '}
                  <span className="text-emerald-400 font-black font-mono">
                    {formatMoney(activePinVoucher.monto, activePinVoucher.moneda)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => handleCopyPin(activePinVoucher.pin)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                >
                  {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPin ? 'PIN Copiado' : 'Copiar PIN'}</span>
                </button>
                <button
                  onClick={() => setActivePinVoucher(null)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-black text-black transition-colors cursor-pointer"
                >
                  Listo / Cerrar
                </button>
              </div>
            </div>
          )}

          {/* Tarjetas de Balance de Custodia por Moneda */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              Saldo en Custodia de Caja (Efectivo Disponible)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {assignedCurrencies.map((mon) => {
                const met = custodiaMetrics[mon] || { balance: 0, entradas: 0, entregas: 0, pendientes: 0 };
                const isPos = met.balance > 0;
                return (
                  <div
                    key={mon}
                    className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                      <span className="font-bold text-slate-200">Efectivo {mon}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isPos ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isPos ? 'En Caja' : 'Sin Fondos'}
                      </span>
                    </div>
                    <div className={`text-2xl sm:text-3xl font-black font-mono mt-1 ${
                      isPos ? 'text-emerald-400' : 'text-slate-300'
                    }`}>
                      {formatMoney(met.balance, mon)}
                    </div>
                    <div className="border-t border-slate-800/80 pt-2.5 mt-3 grid grid-cols-2 gap-1 text-[11px] text-slate-400">
                      <div>
                        Recibido Cajeros: <b className="text-slate-200 font-mono">+{formatMoney(met.entradas, mon)}</b>
                      </div>
                      <div className="text-right">
                        Entregado Cobrador: <b className="text-rose-400 font-mono">-{formatMoney(met.entregas, mon)}</b>
                      </div>
                      {met.pendientes > 0 && (
                        <div className="col-span-2 text-amber-400 font-semibold pt-1">
                          ⏳ Pendiente por confirmar: {formatMoney(met.pendientes, mon)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Formulario: Realizar Entrega a Cobrador de Ruta */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-400" />
                  Entregar Efectivo a Cobrador de Ruta (Generar PIN)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Registra la entrega física del dinero al cobrador y genera el PIN de 6 dígitos para su liquidación.
                </p>
              </div>
            </div>

            {entregaMsg && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                entregaMsg.type === 'success' 
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
              }`}>
                {entregaMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{entregaMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleEntregarCobrador} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Selector de Cobrador */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Cobrador de Ruta *
                  </label>
                  <select
                    value={selectedCobradorId}
                    onChange={(e) => setSelectedCobradorId(e.target.value)}
                    required
                    className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer"
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

                {/* 2. Selector de Moneda */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Moneda *
                  </label>
                  <select
                    value={monedaEntrega}
                    onChange={(e) => setMonedaEntrega(e.target.value)}
                    className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold cursor-pointer"
                  >
                    {assignedCurrencies.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Monto a Entregar */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-semibold text-slate-400">
                      Monto a Entregar *
                    </label>
                    {custodiaMetrics[monedaEntrega]?.balance > 0 && (
                      <button
                        type="button"
                        onClick={() => setMontoEntrega(custodiaMetrics[monedaEntrega].balance)}
                        className="text-[10px] text-emerald-400 hover:underline font-bold cursor-pointer"
                      >
                        Máximo: {formatMoney(custodiaMetrics[monedaEntrega].balance, monedaEntrega)}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={montoEntrega}
                    onChange={(e) => setMontoEntrega(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="0.00"
                    className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                </div>

                {/* 4. Observación / Nota */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Observación / Referencia
                  </label>
                  <input
                    type="text"
                    value={notaEntrega}
                    onChange={(e) => setNotaEntrega(e.target.value)}
                    placeholder={`Entrega caja ${agencyName}`}
                    className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingEntrega}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 px-4 rounded-xl text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
              >
                <Truck className="w-4 h-4" />
                <span>{submittingEntrega ? 'GENERANDO PIN...' : '🚀 ENTREGAR A COBRADOR Y GENERAR PIN'}</span>
              </button>
            </form>
          </div>

          {/* Historial de Entregas Realizadas a Cobrador */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                Historial de Entregas a Cobrador ({entregasCobrador.length})
              </h3>
              <span className="text-[11px] text-slate-400">
                Registros con PIN para validación en ruta
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#071217] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Cobrador</th>
                    <th className="py-3 px-4">PIN / Token</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                    <th className="py-3 px-4 text-center">Estado Cobranza</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {entregasCobrador.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        No hay entregas a cobrador registradas aún.
                      </td>
                    </tr>
                  ) : (
                    entregasCobrador.map((row) => {
                      const pinOnly = row.qr_token ? row.qr_token.replace('QR-REC-', '') : 'N/A';
                      const isAnulado = Boolean(row.rechazado);
                      const isLiquidado = Boolean(row.liquidado_admin);
                      const isCobrado = !isAnulado && (Boolean(row.fecha_escaneo_cobrador) || isLiquidado);
                      const isPending = !isCobrado && !isAnulado;
                      const isProcessing = processingEntregaId === row.id;

                      return (
                        <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 text-slate-300 font-sans">{row.fecha}</td>
                          <td className="py-3 px-4 font-bold text-white font-sans">
                            🛵 {row.cobrador_nombre || 'Cobrador Ruta'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-sky-400 font-black text-sm tracking-widest">
                              {pinOnly}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-400">
                            {formatMoney(row.monto, row.moneda)}
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            {isAnulado ? (
                              <span 
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                title={row.motivo_rechazo || 'Entrega anulada'}
                              >
                                <Ban className="w-3 h-3" />
                                Anulado / Reversado
                              </span>
                            ) : isCobrado ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                Validado por Cobrador
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                                <Clock className="w-3 h-3" />
                                En Custodia / Pendiente Escaneo
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setActivePinVoucher({
                                    pin: pinOnly,
                                    cobradorNombre: row.cobrador_nombre || 'Cobrador',
                                    monto: Number(row.monto),
                                    moneda: row.moneda,
                                    fecha: row.fecha,
                                    agencia: row.agencia || agencyName,
                                  });
                                }}
                                title="Ver comprobante y PIN"
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 transition-colors cursor-pointer"
                              >
                                Ver PIN
                              </button>

                              {isPending && (
                                <>
                                  <button
                                    onClick={() => handleManualValidateEntrega(row)}
                                    disabled={isProcessing}
                                    title="Validar recepción manualmente (si el cobrador ya tiene el dinero)"
                                    className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Validar</span>
                                  </button>

                                  <button
                                    onClick={() => handleCancelEntrega(row)}
                                    disabled={isProcessing}
                                    title="Anular entrega y reintegrar saldo a custodia"
                                    className="px-2 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Anular</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PESTAÑA 2: CONFIRMACIÓN Y RELACIÓN DE EFECTIVO (CAJEROS)       */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'confirmaciones' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Barra de Filtros */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0D1B22] p-4 rounded-2xl border border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro por Cajero */}
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                <select
                  value={filtroCajero}
                  onChange={(e) => setFiltroCajero(e.target.value)}
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

              {/* Filtro por Estado */}
              <div className="flex items-center gap-1 bg-[#071217] p-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => setFiltroEstadoCajero('pendientes')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    filtroEstadoCajero === 'pendientes'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ⏳ Pendientes ({pendientesCajerosCount})
                </button>
                <button
                  onClick={() => setFiltroEstadoCajero('confirmados')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    filtroEstadoCajero === 'confirmados'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ✅ Confirmados
                </button>
                <button
                  onClick={() => setFiltroEstadoCajero('todos')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    filtroEstadoCajero === 'todos'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({cajeroPayments.length})
                </button>
              </div>
            </div>

            <span className="text-xs text-slate-400">
              Valida el dinero físico entregado por cada cajero en 1 clic
            </span>
          </div>

          {/* Tabla de Entregas de Cajeros */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                📋 Relación de Entregas de Efectivo de Cajeros ({filteredCajeroPayments.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#071217] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Cajero</th>
                    <th className="py-3 px-4">Concepto</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Acción Supervisor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredCajeroPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        No hay entregas registradas para el filtro seleccionado.
                      </td>
                    </tr>
                  ) : (
                    filteredCajeroPayments.map((p) => {
                      const isConf = p.confirmado_supervisor || p.confirmado;
                      const isRech = p.rechazado;
                      const isPend = !isConf && !isRech;

                      return (
                        <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 text-slate-300 font-sans">{p.fecha}</td>
                          <td className="py-3 px-4 font-bold text-white font-sans">
                            👤 {resolveCajeroName(p.cajero_id, p.nombre_cajero || p.cajero)}
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-sans">{p.tipo_pago}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-400">
                            {formatMoney(p.monto, p.moneda)}
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            {isConf ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                Confirmado por {p.supervisor_nombre || 'Supervisor'}
                              </span>
                            ) : isRech ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                <XCircle className="w-3 h-3" />
                                Rechazado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                <Clock className="w-3 h-3" />
                                Pendiente por Recibir
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            {isPend ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  disabled={processingId === p.id}
                                  onClick={() => handleConfirmCajeroPayment(p)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Confirmar</span>
                                </button>
                                <button
                                  disabled={processingId === p.id}
                                  onClick={() => handleRejectCajeroPayment(p)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Rechazar</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500">
                                {isConf ? '✅ Recibido en Caja' : 'Rechazado'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PESTAÑA 3: TRANSFERENCIAS BANCARIAS                            */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'bancos' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-sky-400" />
                  Transferencias y Pagos Bancarios ({pendingTransfers.length})
                </h3>
                {/* Selector de Rango: Ciclo vs Fecha */}
                <div className="flex items-center gap-1 bg-[#071217] p-1 rounded-xl border border-slate-700 text-xs">
                  <button
                    onClick={() => setFiltroRangoBancos('ciclo')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      filtroRangoBancos === 'ciclo'
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🗓️ Todo el Ciclo
                  </button>
                  <button
                    onClick={() => setFiltroRangoBancos('fecha')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      filtroRangoBancos === 'fecha'
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📅 Solo Fecha ({fecha})
                  </button>
                </div>
              </div>
              <span className="text-[11px] text-slate-400">
                Solo transferencias de tu agencia y cajeros asignados
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Hora</th>
                    <th className="py-3 px-4 font-semibold">Agencia</th>
                    <th className="py-3 px-4 font-semibold">Cajero Asignado</th>
                    <th className="py-3 px-4 font-semibold">Banco / Método</th>
                    <th className="py-3 px-4 font-semibold">Referencia</th>
                    <th className="py-3 px-4 font-semibold text-right">Monto</th>
                    <th className="py-3 px-4 font-semibold text-center">Estado</th>
                    <th className="py-3 px-4 font-semibold text-center">Acción Supervisor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {pendingTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        {filtroRangoBancos === 'ciclo'
                          ? 'No hay transferencias registradas para esta agencia en el ciclo operativo.'
                          : `No hay transferencias registradas para esta agencia en la fecha ${fecha}.`}
                      </td>
                    </tr>
                  ) : (
                    pendingTransfers.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {formatTime(t.hora)}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          {t.agencia}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-200">
                          👤 {resolveCajeroName(t.cajero_id, t.nombre_cajero)}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {t.banco_origen} &rarr; {t.banco_destino}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-sky-400">
                          {t.referencia}
                        </td>
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
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              <XCircle className="w-3 h-3" />
                              Rechazado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              <Clock className="w-3 h-3" />
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {!t.confirmado && !t.rechazado ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                disabled={processingId === t.id}
                                onClick={() => handleConfirmTransfer(t.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Confirmar</span>
                              </button>
                              <button
                                disabled={processingId === t.id}
                                onClick={() => handleRejectTransfer(t.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                              >
                                <XCircle className="w-3 h-3" />
                                <span>Rechazar</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500">Procesado</span>
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

      {/* ------------------------------------------------------------- */}
      {/* PESTAÑA 4: BALANCE DE AGENCIAS Y CIERRES                       */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'agencias' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                Estado de Agencias y Cierres ({agencySummaries.length})
              </h3>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar agencia..."
                  className="w-full bg-[#071217] border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAgencies.length === 0 ? (
                <div className="col-span-3 py-8 text-center text-slate-500 text-xs">
                  No hay agencias con movimientos registrados para esta fecha.
                </div>
              ) : (
                filteredAgencies.map((ag) => (
                  <div
                    key={ag.agencia}
                    className="bg-[#071217] border border-slate-800/80 rounded-2xl p-4 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-white text-sm">{ag.agencia}</h4>
                        <span className="text-[10px] text-slate-500 font-mono">Terminal Activo</span>
                      </div>
                      {ag.cerrado ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Cerrado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                          Abierto
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Ventas Netas:</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          {formatCurrency(ag.totalVentas, 'USD')}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Premios Pagados:</span>
                        <span className="font-mono text-rose-400">
                          -{formatCurrency(ag.totalPremios, 'USD')}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Gastos:</span>
                        <span className="font-mono text-amber-400">
                          -{formatCurrency(ag.totalGastos, 'USD')}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Depósitos Banco:</span>
                        <span className="font-mono text-sky-400">
                          -{formatCurrency(ag.totalBanco, 'USD')}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-slate-200">
                        <span>Saldo Estimado en Caja:</span>
                        <span className="font-mono text-sm text-white">
                          {formatCurrency(ag.saldoEstimado, 'USD')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
