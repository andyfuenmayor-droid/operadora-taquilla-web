import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { fetchFullCycleMetrics, type CurrencyOperationalMetrics } from '../../utils/operationalDashboard';
import { formatCurrency, getTodayDateString, normalizarMoneda } from '../../utils/formatters';
import { 
  Building2, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Receipt, 
  CreditCard, 
  Send 
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ParsedBankAccount {
  id: number;
  banco: string;
  titular: string;
  numero_cuenta: string;
  moneda: string;
  tipo_cuenta: string;
  agencia_asignada: string;
  saldo_inicial: number;
  estatus: string;
}

interface ParsedPaymentDevice {
  id: number;
  alias_nombre: string;
  tipo_dispositivo: string;
  serial_tid: string;
  cuenta_asociada: string;
  agencia_asignada: string;
  moneda: string;
  estatus: string;
  notas?: string;
}

interface UnifiedDestination {
  label: string;
  moneda: string;
  metodo: string;
  isDevice: boolean;
}

interface BankTransferRow {
  id?: number;
  fecha: string;
  hora?: string;
  created_at?: string;
  agencia?: string;
  metodo_pago?: string;
  monto: number;
  moneda: string;
  referencia: string;
  pos_o_cuenta?: string;
  concepto?: string;
  datos_pagador?: string;
  confirmado: boolean;
  rechazado?: boolean;
  motivo_rechazo?: string;
}

export const BankTransfersTab: React.FC = () => {
  const { user, agency, systemCycle, assignedCurrencies, assignedSystems, isDayClosed } = useAuth();
  const agencyName = agency?.nombre_agencia || '';
  const userRole = (user?.rol || 'cajero').toLowerCase();
  const isAgencia = userRole === 'agencia';
  const isSupervisor = userRole === 'supervisor' || userRole === 'admin';

  // Subtabs state
  const [subTab, setSubTab] = useState<'cuentas' | 'dispositivos' | 'registrar' | 'historial'>('cuentas');
  const [accounts, setAccounts] = useState<ParsedBankAccount[]>([]);
  const [devices, setDevices] = useState<ParsedPaymentDevice[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Debt & Balances metrics for "Registrar Pago"
  const [metricsByCurrency, setMetricsByCurrency] = useState<Record<string, CurrencyOperationalMetrics>>({});
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Form state
  const defaultFecha = systemCycle?.hasta || getTodayDateString();
  const [fechaPago, setFechaPago] = useState(defaultFecha);
  const [selectedDestinoLabel, setSelectedDestinoLabel] = useState<string>('');
  const [montoPago, setMontoPago] = useState<number | ''>('');
  const [conceptoPago, setConceptoPago] = useState<string>('Pago a Comercializador');
  const [referenciaPago, setReferenciaPago] = useState<string>('');
  const [datosPagador, setDatosPagador] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Historial state
  const [fechaHistorial, setFechaHistorial] = useState(defaultFecha);
  const [transfers, setTransfers] = useState<BankTransferRow[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Daily transfers state for "Registrar Pago"
  const [dailyTransfers, setDailyTransfers] = useState<BankTransferRow[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // -------------------------------------------------------------
  // 1. CARGAR CUENTAS BANCARIAS Y DISPOSITIVOS EXACTO A STREAMLIT
  // -------------------------------------------------------------
  const loadAccountsAndDevices = useCallback(async () => {
    if (!agencyName) return;
    setLoadingData(true);
    try {
      // 1. Obtener cuentas_asignadas desde agency o agencias table
      let assignedAccountIds: number[] = [];
      const rawAsig = agency?.cuentas_asignadas;
      if (rawAsig) {
        const rawList = Array.isArray(rawAsig) ? rawAsig : String(rawAsig).split(',');
        for (const item of rawList) {
          const itemStr = String(item).trim();
          if (itemStr) {
            const parsedId = parseInt(itemStr.split(' - ')[0], 10);
            if (!isNaN(parsedId)) assignedAccountIds.push(parsedId);
          }
        }
      }

      if (assignedAccountIds.length === 0) {
        const { data: agData } = await supabase
          .table('agencias')
          .select('cuentas_asignadas')
          .eq('nombre_agencia', agencyName)
          .maybeSingle();

        if (agData?.cuentas_asignadas) {
          const rawList = Array.isArray(agData.cuentas_asignadas)
            ? agData.cuentas_asignadas
            : String(agData.cuentas_asignadas).split(',');
          for (const item of rawList) {
            const itemStr = String(item).trim();
            if (itemStr) {
              const parsedId = parseInt(itemStr.split(' - ')[0], 10);
              if (!isNaN(parsedId)) assignedAccountIds.push(parsedId);
            }
          }
        }
      }

      // 2. Cargar cuentas bancarias
      const { data: resC } = await supabase
        .table('cuentas_bancarias')
        .select('*');

      const allCuentas = resC || [];
      const uId = String(agency?.user_id || user?.user_id || user?.id || '').trim();
      const agUpper = agencyName.toUpperCase().trim();
      const validAgencies = [agUpper, 'TODAS', 'TODOS', 'GENERAL', 'DISPONIBLE'];

      // Filtrar cuentas (excluyendo dispositivos)
      const parsedCuentas: ParsedBankAccount[] = allCuentas
        .filter((acc: any) => {
          const tipo = String(acc.tipo_cuenta || '').toUpperCase().trim();
          if (tipo === 'DISPOSITIVO DE PAGO') return false;

          const accAg = String(acc.agencia_asignada || '').toUpperCase().trim();
          const metAcep = String(acc.metodos_aceptados || '').toUpperCase().trim();
          const condAg = validAgencies.includes(accAg) || (metAcep && metAcep.includes(agUpper));
          const condId = assignedAccountIds.length > 0 && assignedAccountIds.includes(Number(acc.id));

          return condAg || condId;
        })
        .map((acc: any) => {
          const rawMon = String(acc.moneda || 'BS').trim().toUpperCase();
          const cleanMon = rawMon.includes('BS') || rawMon.includes('VES') ? 'Bs' : (rawMon.includes('COP') ? 'COP' : 'USD');
          return {
            id: Number(acc.id),
            banco: String(acc.banco || 'BANCO').toUpperCase().trim(),
            titular: String(acc.titular || '').toUpperCase().trim(),
            numero_cuenta: String(acc.numero_cuenta || acc.identificador || acc.email || 'N/A').trim(),
            moneda: cleanMon,
            tipo_cuenta: String(acc.tipo_cuenta || 'CORRIENTE').toUpperCase().trim(),
            agencia_asignada: String(acc.agencia_asignada || agencyName).toUpperCase().trim(),
            saldo_inicial: Number(acc.saldo_inicial) || 0,
            estatus: String(acc.estatus || acc.estado || 'ACTIVA').toUpperCase().trim(),
          };
        })
        .sort((a: ParsedBankAccount, b: ParsedBankAccount) => a.id - b.id);

      // Fallback si no hubo coincidencia y no hay IDs asignados
      if (parsedCuentas.length === 0 && assignedAccountIds.length === 0 && allCuentas.length > 0) {
        const fallback = allCuentas
          .filter((acc: any) => String(acc.user_id || '').trim() === uId && String(acc.tipo_cuenta || '').toUpperCase().trim() !== 'DISPOSITIVO DE PAGO')
          .map((acc: any) => ({
            id: Number(acc.id),
            banco: String(acc.banco || 'BANCO').toUpperCase().trim(),
            titular: String(acc.titular || '').toUpperCase().trim(),
            numero_cuenta: String(acc.numero_cuenta || acc.identificador || acc.email || 'N/A').trim(),
            moneda: normalizarMoneda(acc.moneda || 'BS'),
            tipo_cuenta: String(acc.tipo_cuenta || 'CORRIENTE').toUpperCase().trim(),
            agencia_asignada: String(acc.agencia_asignada || agencyName).toUpperCase().trim(),
            saldo_inicial: Number(acc.saldo_inicial) || 0,
            estatus: String(acc.estatus || acc.estado || 'ACTIVA').toUpperCase().trim(),
          }))
          .sort((a: ParsedBankAccount, b: ParsedBankAccount) => a.id - b.id);
        setAccounts(fallback);
      } else {
        setAccounts(parsedCuentas);
      }

      // 3. Cargar Dispositivos de Pago (POS / BioPago)
      const parsedDevices: ParsedPaymentDevice[] = [];
      
      // De cuentas_bancarias con tipo DISPOSITIVO DE PAGO
      allCuentas
        .filter((acc: any) => {
          const tipo = String(acc.tipo_cuenta || '').toUpperCase().trim();
          const banco = String(acc.banco || '').toUpperCase().trim();
          const isDisp = tipo === 'DISPOSITIVO DE PAGO' || banco.startsWith('DISPOSITIVO');
          if (!isDisp) return false;

          const accAg = String(acc.agencia_asignada || '').toUpperCase().trim();
          const condAg = validAgencies.includes(accAg);
          const condId = assignedAccountIds.length > 0 && assignedAccountIds.includes(Number(acc.id));
          return condAg || condId;
        })
        .forEach((d: any) => {
          parsedDevices.push({
            id: Number(d.id),
            alias_nombre: String(d.titular || d.banco || 'POS TAQUILLA').toUpperCase().trim(),
            tipo_dispositivo: String(d.banco || 'PUNTO DE VENTA (POS)').replace('DISPOSITIVO: ', '').trim(),
            serial_tid: String(d.numero_cuenta || 'S/N').trim(),
            cuenta_asociada: String(d.documento_titular || 'SIN CUENTA').trim(),
            agencia_asignada: String(d.agencia_asignada || agencyName).trim(),
            moneda: String(d.moneda || 'USD').trim().toUpperCase(),
            estatus: String(d.estatus || d.estado || 'ACTIVO').toUpperCase().trim(),
            notas: String(d.notas || ''),
          });
        });

      // De tabla dispositivos_pago
      try {
        const { data: resDisp } = await supabase.table('dispositivos_pago').select('*');
        if (resDisp && resDisp.length > 0) {
          resDisp.forEach((d: any) => {
            const dAg = String(d.agencia_asignada || d.agencia || '').toUpperCase().trim();
            if (validAgencies.includes(dAg) || String(d.user_id || '').trim() === uId) {
              if (!parsedDevices.some((existing) => existing.id === Number(d.id))) {
                parsedDevices.push({
                  id: Number(d.id),
                  alias_nombre: String(d.nombre_dispositivo || d.alias || d.titular || 'POS').toUpperCase().trim(),
                  tipo_dispositivo: String(d.tipo_dispositivo || 'PUNTO DE VENTA (POS)').trim(),
                  serial_tid: String(d.serial_pos || d.serial || 'S/N').trim(),
                  cuenta_asociada: String(d.cuenta_asociada || d.cuenta_banco || 'PRINCIPAL').trim(),
                  agencia_asignada: String(d.agencia_asignada || agencyName).trim(),
                  moneda: String(d.moneda || 'USD').trim().toUpperCase(),
                  estatus: String(d.estatus || 'ACTIVO').toUpperCase().trim(),
                  notas: String(d.notas || ''),
                });
              }
            }
          });
        }
      } catch (err) {
        console.warn('dispositivos_pago table not found or empty:', err);
      }

      setDevices(parsedDevices);
    } catch (err) {
      console.error('Error loading accounts and devices:', err);
    } finally {
      setLoadingData(false);
    }
  }, [agencyName, agency?.cuentas_asignadas, agency?.user_id, user?.user_id, user?.id]);

  useEffect(() => {
    loadAccountsAndDevices();
  }, [loadAccountsAndDevices]);

  // -------------------------------------------------------------
  // 2. CONFIGURACIÓN DINÁMICA DE SUBPESTAÑAS
  // -------------------------------------------------------------
  const tabsConfig = useMemo(() => {
    const list: { id: 'cuentas' | 'dispositivos' | 'registrar' | 'historial'; label: string }[] = [];
    if (accounts.length > 0) {
      list.push({ id: 'cuentas', label: '🏛️ Cuentas Bancarias' });
    }
    if (devices.length > 0) {
      list.push({ id: 'dispositivos', label: '📟 Dispositivos de Pago (POS / Biopago)' });
    }
    list.push({ id: 'registrar', label: '💸 Registrar Pago' });
    list.push({ id: 'historial', label: '📊 Historial y Resumen' });
    return list;
  }, [accounts.length, devices.length]);

  // Si la pestaña activa actual no existe en las disponibles, ajustar a la primera
  useEffect(() => {
    if (!tabsConfig.some((t) => t.id === subTab)) {
      if (tabsConfig.length > 0) setSubTab(tabsConfig[0].id);
    }
  }, [tabsConfig, subTab]);

  // -------------------------------------------------------------
  // 3. CARGAR ESTADO DE DEUDA POR MONEDA (PARA REGISTRAR PAGO)
  // -------------------------------------------------------------
  const loadDebtMetrics = useCallback(async (force = false) => {
    if (!agencyName) return;
    setLoadingMetrics(true);
    try {
      const data = await fetchFullCycleMetrics(
        agencyName,
        systemCycle,
        assignedCurrencies,
        assignedSystems,
        user,
        agency,
        {
          filterCajeroId: null,
          forceRefresh: force,
        }
      );
      setMetricsByCurrency(data);
    } catch (err) {
      console.error('Error fetching debt metrics for bank tab:', err);
    } finally {
      setLoadingMetrics(false);
    }
  }, [agencyName, systemCycle, assignedCurrencies, assignedSystems, user, agency]);

  useEffect(() => {
    if (subTab === 'registrar') {
      loadDebtMetrics();
    }
  }, [subTab, loadDebtMetrics]);

  // -------------------------------------------------------------
  // 4. MAPA UNIFICADO DE DESTINOS PARA EL SELECTOR DE REGISTRO
  // -------------------------------------------------------------
  const destinationOptions = useMemo<UnifiedDestination[]>(() => {
    const list: UnifiedDestination[] = [];

    // 1. Dispositivos
    devices.forEach((d) => {
      const isBiopago = d.tipo_dispositivo.toUpperCase().includes('BIOPAGO');
      list.push({
        label: `${d.alias_nombre} [${d.tipo_dispositivo}] (${d.moneda})`,
        moneda: d.moneda || 'USD',
        metodo: isBiopago ? 'BioPago' : 'Punto de Venta',
        isDevice: true,
      });
    });

    // 2. Cuentas
    accounts.forEach((acc) => {
      const tcUpper = acc.tipo_cuenta.toUpperCase();
      const bnUpper = acc.banco.toUpperCase();

      let met = 'Otro (Cuenta Admin)';
      if (tcUpper.includes('PAGO MÓVIL') || tcUpper.includes('PAGO MOVIL') || bnUpper.includes('PAGO MOVIL')) {
        met = 'Pago Móvil';
      } else if (tcUpper.includes('ZELLE') || bnUpper.includes('ZELLE')) {
        met = 'Zelle';
      } else if (tcUpper.includes('BINANCE') || tcUpper.includes('CRIPTO') || bnUpper.includes('BINANCE')) {
        met = 'Binance / Cripto';
      } else if (tcUpper.includes('PAYPAL') || bnUpper.includes('PAYPAL')) {
        met = 'PayPal';
      } else if (tcUpper.includes('DEPÓSITO') || tcUpper.includes('DEPOSITO')) {
        met = 'Depósito Bancario';
      } else if (tcUpper.includes('TRANSFERENCIA') || tcUpper.includes('CORRIENTE') || tcUpper.includes('AHORRO')) {
        met = 'Transferencia Bancaria';
      }

      let label = `${acc.banco} | ${acc.titular}`;
      if (acc.numero_cuenta && acc.numero_cuenta !== 'N/A') {
        label += ` - N°: ${acc.numero_cuenta}`;
      }
      label += ` (${acc.moneda}) [${acc.tipo_cuenta}]`;

      list.push({
        label,
        moneda: acc.moneda,
        metodo: met,
        isDevice: false,
      });
    });

    if (list.length === 0) {
      list.push({
        label: 'Cuenta Operadora General (USD)',
        moneda: 'USD',
        metodo: 'Transferencia Bancaria',
        isDevice: false,
      });
    }

    return list;
  }, [accounts, devices]);

  // Selección inicial automática del primer destino
  useEffect(() => {
    if (destinationOptions.length > 0 && !selectedDestinoLabel) {
      setSelectedDestinoLabel(destinationOptions[0].label);
    }
  }, [destinationOptions, selectedDestinoLabel]);

  const currentDestinoMeta = useMemo(() => {
    return destinationOptions.find((d) => d.label === selectedDestinoLabel) || destinationOptions[0] || {
      label: '',
      moneda: 'BS',
      metodo: 'Transferencia Bancaria',
      isDevice: false,
    };
  }, [destinationOptions, selectedDestinoLabel]);

  // Conceptos permitidos según el rol
  const allowedConceptos = useMemo(() => {
    if (isAgencia) return ['Pago a Comercializador'];
    return ['Compra de Tickets', 'Pago de Premios', 'Recibos Punto Venta', 'Pago a Comercializador'];
  }, [isAgencia]);

  // -------------------------------------------------------------
  // 5. REGISTRAR PAGO BANCARIO
  // -------------------------------------------------------------
  const handleRegisterBankPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDayClosed) {
      setFormError(`El día ${fechaPago} está cerrado. No se pueden registrar pagos.`);
      return;
    }

    const parsedMonto = typeof montoPago === 'number' ? montoPago : 0;
    if (parsedMonto <= 0) {
      setFormError('Ingrese un monto válido mayor a cero.');
      return;
    }

    if (!referenciaPago.trim()) {
      setFormError('Debe proporcionar un número de referencia o comprobante.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const nowIso = new Date().toISOString();
      const newRecord = {
        fecha: fechaPago,
        agencia: agencyName,
        metodo_pago: currentDestinoMeta.metodo,
        monto: Math.round(parsedMonto * 100) / 100,
        moneda: currentDestinoMeta.moneda,
        referencia: referenciaPago.trim().toUpperCase(),
        concepto: conceptoPago,
        datos_pagador: datosPagador.trim().toUpperCase() || 'N/A',
        pos_o_cuenta: selectedDestinoLabel,
        user_id: String(agency?.user_id || user?.user_id || user?.id || ''),
        cajero_id: user?.id ? String(user.id) : null,
        confirmado: false,
        rechazado: false,
        created_at: nowIso,
      };

      const { error } = await supabase.table('cda_pagos_bancarios').insert(newRecord);
      if (error) throw error;

      confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
      setFormSuccess(`✅ Pago por ${currentDestinoMeta.metodo} (Ref: ${referenciaPago.trim().toUpperCase()}) registrado exitosamente! En espera de confirmación.`);
      setMontoPago('');
      setReferenciaPago('');
      setDatosPagador('');

      // Recargar deudas, pagos del día e historial
      loadDebtMetrics(true);
      fetchDailyTransfers();
      fetchHistorial();
    } catch (err: any) {
      console.error('Error saving bank payment:', err);
      setFormError(err?.message || 'Error al registrar el pago bancario.');
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // 5.1 CARGAR PAGOS DEL DÍA PARA EL FORMULARIO DE REGISTRO
  // -------------------------------------------------------------
  const fetchDailyTransfers = useCallback(async () => {
    if (!agencyName) return;
    setLoadingDaily(true);
    try {
      let q = supabase
        .table('cda_pagos_bancarios')
        .select('*')
        .eq('fecha', fechaPago)
        .ilike('agencia', agencyName.trim());

      if (!isSupervisor && !isAgencia && user?.id) {
        q = q.eq('cajero_id', String(user.id));
      }

      const { data, error } = await q.order('id', { ascending: false });
      if (error) throw error;
      setDailyTransfers((data || []) as BankTransferRow[]);
    } catch (err) {
      console.error('Error fetching daily bank transfers:', err);
    } finally {
      setLoadingDaily(false);
    }
  }, [agencyName, fechaPago, isSupervisor, isAgencia, user?.id]);

  useEffect(() => {
    if (subTab === 'registrar') {
      fetchDailyTransfers();
    }
  }, [subTab, fetchDailyTransfers]);

  // -------------------------------------------------------------
  // 6. CARGAR HISTORIAL DE TRANSFERENCIAS BANCARIAS
  // -------------------------------------------------------------
  const fetchHistorial = useCallback(async () => {
    if (!agencyName) return;
    setLoadingHistorial(true);
    try {
      let q = supabase
        .table('cda_pagos_bancarios')
        .select('*')
        .eq('fecha', fechaHistorial)
        .ilike('agencia', agencyName.trim());

      if (!isSupervisor && !isAgencia && user?.id) {
        q = q.eq('cajero_id', String(user.id));
      }

      const { data, error } = await q.order('id', { ascending: false });
      if (error) throw error;
      setTransfers((data || []) as BankTransferRow[]);
    } catch (err) {
      console.error('Error fetching bank history:', err);
    } finally {
      setLoadingHistorial(false);
    }
  }, [agencyName, fechaHistorial, isSupervisor, isAgencia, user?.id]);

  useEffect(() => {
    if (subTab === 'historial') {
      fetchHistorial();
    }
  }, [subTab, fetchHistorial]);

  // Resumen métrico para el historial
  const historialMetrics = useMemo(() => {
    const valid = transfers.filter((t) => !t.rechazado);
    let totPos = 0;
    let totBiopago = 0;
    let totPm = 0;
    let totZelle = 0;
    let totTransf = 0;
    let totEfectivo = 0;
    let totGeneral = 0;

    valid.forEach((t) => {
      const m = Number(t.monto) || 0;
      const met = String(t.metodo_pago || '').toUpperCase();
      totGeneral += m;

      if (met === 'PUNTO DE VENTA') totPos += m;
      else if (met === 'BIOPAGO') totBiopago += m;
      else if (met === 'PAGO MÓVIL' || met === 'PAGO MOVIL') totPm += m;
      else if (met === 'ZELLE') totZelle += m;
      else if (met.includes('TRANSFERENCIA') || met.includes('DEPÓSITO') || met.includes('DEPOSITO')) totTransf += m;
      else if (met.includes('EFECTIVO')) totEfectivo += m;
    });

    return { totPos, totBiopago, totPm, totZelle, totTransf, totEfectivo, totGeneral };
  }, [transfers]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER SECTION MATCHING STREAMLIT */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <span>🏛️</span>
          <span>Gestión Bancaria</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Terminal: <span className="text-slate-200 font-bold">{agencyName || 'AGENCIA GENERAL'}</span>
        </p>
      </div>

      {/* SUB-TABS NAVIGATION BAR */}
      <div className="bg-[#0D1B22] p-2 rounded-2xl border border-slate-800 shadow-md flex flex-wrap items-center gap-1.5">
        {tabsConfig.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              subTab === t.id
                ? 'bg-emerald-500 text-black shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ========================================================= */}
      {/* SUBTAB 1: CUENTAS BANCARIAS ASIGNADAS                     */}
      {/* ========================================================= */}
      {subTab === 'cuentas' && (
        <div className="space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>🏛️</span>
              <span>Cuentas Bancarias Asignadas</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Consulta de cuentas bancarias registradas por el administrador y asignadas a esta taquilla.
            </p>
          </div>

          {/* 3 TARJETAS MÉTRICAS SUPERIORES */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-4 shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                TOTAL CUENTAS ASIGNADAS
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {accounts.length}
              </div>
            </div>

            <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-4 shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                CUENTAS ACTIVAS
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {accounts.filter((a) => a.estatus === 'ACTIVA' || a.estatus === 'ACTIVO').length}
              </div>
            </div>

            <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-4 shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                MONEDAS SOPORTADAS
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {new Set(accounts.map((a) => a.moneda)).size}
              </div>
            </div>
          </div>

          {/* TABLA DE CUENTAS BANCARIAS REGISTRADAS */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>📑</span>
                <span>Cuentas Bancarias Registradas</span>
              </h4>
              <button
                onClick={loadAccountsAndDevices}
                disabled={loadingData}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Refrescar cuentas"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400 font-semibold">
                    <th className="py-3 px-3 text-center w-12">N°</th>
                    <th className="py-3 px-4">Banco / Entidad</th>
                    <th className="py-3 px-4">Titular</th>
                    <th className="py-3 px-4">N° Cuenta / Tel / Email</th>
                    <th className="py-3 px-3">Moneda</th>
                    <th className="py-3 px-3">Tipo</th>
                    <th className="py-3 px-4">Agencia Asignada</th>
                    <th className="py-3 px-4 text-right">Saldo Inicial</th>
                    <th className="py-3 px-3 text-center">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-500 font-medium">
                        ℹ️ No hay cuentas bancarias asignadas a esta taquilla por la administración.
                      </td>
                    </tr>
                  ) : (
                    accounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 text-center font-mono text-slate-400">{acc.id}</td>
                        <td className="py-3 px-4 font-bold text-white">{acc.banco}</td>
                        <td className="py-3 px-4 text-slate-300">{acc.titular}</td>
                        <td className="py-3 px-4 font-mono text-sky-400">{acc.numero_cuenta}</td>
                        <td className="py-3 px-3 font-semibold text-slate-300">{acc.moneda}</td>
                        <td className="py-3 px-3 text-slate-400">{acc.tipo_cuenta}</td>
                        <td className="py-3 px-4 text-slate-300">{acc.agencia_asignada}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          {acc.saldo_inicial.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            acc.estatus === 'ACTIVA' || acc.estatus === 'ACTIVO'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {acc.estatus}
                          </span>
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

      {/* ========================================================= */}
      {/* SUBTAB 2: DISPOSITIVOS DE PAGO (SOLO SI EXISTEN)          */}
      {/* ========================================================= */}
      {subTab === 'dispositivos' && devices.length > 0 && (
        <div className="space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>📟</span>
              <span>Dispositivos de Pago Asignados (POS / Biopago)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Puntos de Venta (POS) y dispositivos de cobro asignados a esta taquilla por la administración.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-4 shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                TOTAL DISPOSITIVOS
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {devices.length}
              </div>
            </div>

            <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-4 shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                DISPOSITIVOS ACTIVOS
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {devices.filter((d) => d.estatus === 'ACTIVO' || d.estatus === 'ACTIVA').length}
              </div>
            </div>

            <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-4 shadow-md">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                TIPOS SOPORTADOS
              </div>
              <div className="text-xs font-bold text-emerald-400 mt-2">
                POS / Biopago / QR / Datáfono
              </div>
            </div>
          </div>

          <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400 font-semibold">
                    <th className="py-3 px-3 text-center w-12">N°</th>
                    <th className="py-3 px-4">Alias / Nombre</th>
                    <th className="py-3 px-4">Tipo Dispositivo</th>
                    <th className="py-3 px-4">Serial / TID</th>
                    <th className="py-3 px-4">Cuenta Asociada</th>
                    <th className="py-3 px-4">Agencia Asignada</th>
                    <th className="py-3 px-3">Moneda</th>
                    <th className="py-3 px-3 text-center">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {devices.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3 text-center font-mono text-slate-400">{d.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{d.alias_nombre}</td>
                      <td className="py-3 px-4 text-slate-300">{d.tipo_dispositivo}</td>
                      <td className="py-3 px-4 font-mono text-sky-400">{d.serial_tid}</td>
                      <td className="py-3 px-4 text-slate-400">{d.cuenta_asociada}</td>
                      <td className="py-3 px-4 text-slate-300">{d.agencia_asignada}</td>
                      <td className="py-3 px-3 font-semibold text-slate-300">{d.moneda}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {d.estatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUBTAB 3: REGISTRAR PAGO RECIBIDO                         */}
      {/* ========================================================= */}
      {subTab === 'registrar' && (
        <div className="space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>💸</span>
              <span>Registrar Pago Recibido</span>
            </h3>
          </div>

          {/* TARJETAS DE ESTADO DE DEUDA / SALDO PENDIENTE POR MONEDA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Estado de Deuda / Saldo Pendiente por Moneda</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Consulta en tiempo real cuánto debes en cada moneda asignada antes de registrar tu transferencia o pago bancario.
                </p>
              </div>
              <button
                onClick={() => loadDebtMetrics(true)}
                disabled={loadingMetrics}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Actualizar saldos de deuda"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {assignedCurrencies.map((cur) => {
                const normCur = normalizarMoneda(cur);
                const metrics = metricsByCurrency[normCur];

                const saldoOperativo = metrics?.resultadoOp ?? 0;
                const gastos = metrics?.gastos ?? 0;
                const saldoAnterior = metrics?.saldoAnterior ?? 0;
                const pagosAbonados = (metrics?.pagoEfectivo ?? 0) + (metrics?.pagoBanco ?? 0) - (metrics?.pagoPremios ?? 0);
                const saldoDeuda = metrics?.saldoActual ?? (saldoAnterior + saldoOperativo - gastos - pagosAbonados);

                const isDeuda = saldoDeuda > 0.009;
                const isFavor = saldoDeuda < -0.009;

                const badgeBg = isDeuda
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : isFavor
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-700/40 text-slate-300 border-slate-600';

                const badgeText = isDeuda
                  ? '🔴 DEUDA PENDIENTE'
                  : isFavor
                  ? '🟢 SALDO A FAVOR'
                  : '⚪ AL DÍA / SOLVENTE';

                const displayAmount = isFavor ? Math.abs(saldoDeuda) : saldoDeuda;

                return (
                  <div
                    key={normCur}
                    className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-extrabold text-white text-sm">Moneda: {normCur}</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${badgeBg}`}>
                          {badgeText}
                        </span>
                      </div>

                      <div className="text-xl sm:text-2xl font-black font-mono my-2 text-white">
                        {formatCurrency(displayAmount, normCur)}
                      </div>
                    </div>

                    <div className="bg-[#071217] rounded-xl p-2.5 space-y-1 text-[11px] font-mono border border-slate-800/80 text-slate-400 mt-2">
                      <div className="flex justify-between">
                        <span>Saldo Anterior:</span>
                        <span className="text-slate-300">{formatCurrency(saldoAnterior, normCur)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Res. Operativo:</span>
                        <span className={saldoOperativo >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {formatCurrency(saldoOperativo, normCur)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Gastos Aprobados:</span>
                        <span className="text-slate-300">-{formatCurrency(gastos, normCur)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-800 pt-1 text-slate-300">
                        <span>Pagos Abonados:</span>
                        <span className="text-emerald-400">-{formatCurrency(pagosAbonados, normCur)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FORMULARIO DE REGISTRO BANCARIO */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>Formulario de Depósito / Pago Bancario</span>
            </h4>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterBankPayment} className="space-y-4">
              {/* FILA 1: FECHA Y CUENTA/DISPOSITIVO DESTINO */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Fecha de Operación
                  </label>
                  <input
                    type="date"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                    className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Seleccione Dispositivo / Cuenta de Pago Asignado*
                  </label>
                  <select
                    value={selectedDestinoLabel}
                    onChange={(e) => setSelectedDestinoLabel(e.target.value)}
                    className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    {destinationOptions.map((opt, idx) => (
                      <option key={idx} value={opt.label}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* FILA 2: MONEDA Y MÉTODO AUTO-DETECTADOS (READONLY) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Moneda (Definida por la cuenta/dispositivo)*
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentDestinoMeta.moneda}
                    className="w-full bg-[#071217]/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-bold cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Método de Pago Asignado*
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentDestinoMeta.metodo}
                    className="w-full bg-[#071217]/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-bold cursor-not-allowed"
                  />
                </div>
              </div>

              {/* FILA 3: MONTO Y CONCEPTO */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Monto Recibido*
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={montoPago}
                    onChange={(e) => setMontoPago(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Concepto de Operación*
                  </label>
                  <select
                    value={conceptoPago}
                    onChange={(e) => setConceptoPago(e.target.value)}
                    className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                  >
                    {allowedConceptos.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* FILA 4: REFERENCIA Y DATOS PAGADOR */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Número de Referencia / Comprobante*
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 987654 / Últimos 6 dígitos"
                    value={referenciaPago}
                    onChange={(e) => setReferenciaPago(e.target.value)}
                    className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Datos del Pagador / Titular
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: V-14567890 / Pedro Pérez"
                    value={datosPagador}
                    onChange={(e) => setDatosPagador(e.target.value)}
                    className="w-full bg-[#071217] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* BOTÓN ANCHO GUARDAR PAGO BANCARIO */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || isDayClosed}
                  className="w-full py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'GUARDANDO PAGO...' : '💾 REGISTRAR PAGO BANCARIO'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* TABLA DE PAGOS REGISTRADOS EN ESTA FECHA */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Pagos Bancarios Registrados del Día ({dailyTransfers.length})</span>
              </h4>
              <button
                onClick={fetchDailyTransfers}
                disabled={loadingDaily}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Actualizar pagos de hoy"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDaily ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400 font-semibold">
                    <th className="py-3 px-3">Hora</th>
                    <th className="py-3 px-4">Método</th>
                    <th className="py-3 px-3 text-right">Monto</th>
                    <th className="py-3 px-2 text-center">Moneda</th>
                    <th className="py-3 px-4">Referencia</th>
                    <th className="py-3 px-4">POS / Cuenta Destino</th>
                    <th className="py-3 px-4">Concepto</th>
                    <th className="py-3 px-4">Datos Pagador</th>
                    <th className="py-3 px-3 text-center">Conf.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {dailyTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 font-medium">
                        ℹ️ No hay transacciones bancarias registradas para esta fecha.
                      </td>
                    </tr>
                  ) : (
                    dailyTransfers.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {t.created_at ? new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (t.hora || 'N/A')}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">{t.metodo_pago}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white">
                          {t.monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-2 text-center font-semibold text-slate-300">{t.moneda}</td>
                        <td className="py-3 px-4 font-mono font-bold text-sky-400">{t.referencia}</td>
                        <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate" title={t.pos_o_cuenta}>
                          {t.pos_o_cuenta || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-slate-400">{t.concepto}</td>
                        <td className="py-3 px-4 text-slate-300">{t.datos_pagador || 'N/A'}</td>
                        <td className="py-3 px-3 text-center">
                          {t.confirmado ? (
                            <span className="font-bold text-emerald-400 font-mono">
                              ✅ C
                            </span>
                          ) : t.rechazado ? (
                            <span className="font-bold text-rose-400">
                              ❌ Rechazado
                            </span>
                          ) : (
                            <span className="font-bold text-amber-400">
                              ⏳ Pendiente
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

      {/* ========================================================= */}
      {/* SUBTAB 4: HISTORIAL Y RESUMEN                             */}
      {/* ========================================================= */}
      {subTab === 'historial' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>📊</span>
                <span>Historial de Transacciones Bancarias</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Consulta y audita los depósitos y pagos por canal electrónico registrados para este terminal.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">📅 Filtrar por Fecha:</span>
              <input
                type="date"
                value={fechaHistorial}
                onChange={(e) => setFechaHistorial(e.target.value)}
                className="bg-[#071217] border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                onClick={fetchHistorial}
                disabled={loadingHistorial}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Actualizar historial"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistorial ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* 7 TARJETAS DE RESUMEN POR MÉTODO MATCHING STREAMLIT */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <div className="bg-[#0D1B22] border border-slate-800/80 rounded-xl p-2.5 text-center shadow-sm">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                📟 POS
              </div>
              <div className="text-xs sm:text-sm font-bold text-white font-mono">
                ${historialMetrics.totPos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-[#0D1B22] border border-slate-800/80 rounded-xl p-2.5 text-center shadow-sm">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                👆 BIOPAGO
              </div>
              <div className="text-xs sm:text-sm font-bold text-white font-mono">
                ${historialMetrics.totBiopago.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-[#0D1B22] border border-slate-800/80 rounded-xl p-2.5 text-center shadow-sm">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                📲 PAGO MÓVIL
              </div>
              <div className="text-xs sm:text-sm font-bold text-white font-mono">
                ${historialMetrics.totPm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-[#0D1B22] border border-slate-800/80 rounded-xl p-2.5 text-center shadow-sm">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                💵 ZELLE
              </div>
              <div className="text-xs sm:text-sm font-bold text-white font-mono">
                ${historialMetrics.totZelle.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-[#0D1B22] border border-slate-800/80 rounded-xl p-2.5 text-center shadow-sm">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                🏦 TRANSF/DEP
              </div>
              <div className="text-xs sm:text-sm font-bold text-white font-mono">
                ${historialMetrics.totTransf.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-[#0D1B22] border border-slate-800/80 rounded-xl p-2.5 text-center shadow-sm">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 truncate">
                💵 EFECTIVO (POR COBRAR)
              </div>
              <div className="text-xs sm:text-sm font-bold text-white font-mono">
                ${historialMetrics.totEfectivo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-[#0D1B22] border border-emerald-500/30 rounded-xl p-2.5 text-center shadow-sm">
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-0.5">
                🏛️ TOTAL GENERAL
              </div>
              <div className="text-xs sm:text-sm font-black text-emerald-400 font-mono">
                ${historialMetrics.totGeneral.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* TABLA DE HISTORIAL DE TRANSACCIONES */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Transacciones Bancarias ({transfers.length})</span>
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400 font-semibold">
                    <th className="py-3 px-3">fecha</th>
                    <th className="py-3 px-4">metodo_pago</th>
                    <th className="py-3 px-3 text-right">monto</th>
                    <th className="py-3 px-2 text-center">moneda</th>
                    <th className="py-3 px-4">referencia</th>
                    <th className="py-3 px-4">pos_o_cuenta</th>
                    <th className="py-3 px-4">concepto</th>
                    <th className="py-3 px-4">datos_pagador</th>
                    <th className="py-3 px-3 text-center">Conf.</th>
                    <th className="py-3 px-4">created_at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-500 font-medium">
                        ℹ️ No hay transacciones bancarias registradas el día {fechaHistorial}.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-300">{t.fecha}</td>
                        <td className="py-3 px-4 font-semibold text-white">{t.metodo_pago}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white">
                          {t.monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-2 text-center font-semibold text-slate-300">{t.moneda}</td>
                        <td className="py-3 px-4 font-mono font-bold text-sky-400">{t.referencia}</td>
                        <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate" title={t.pos_o_cuenta}>
                          {t.pos_o_cuenta || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-slate-400">{t.concepto}</td>
                        <td className="py-3 px-4 text-slate-300 font-medium">{t.datos_pagador || 'N/A'}</td>
                        <td className="py-3 px-3 text-center">
                          {t.confirmado ? (
                            <span className="font-bold text-emerald-400 font-mono">
                              ✅ C
                            </span>
                          ) : t.rechazado ? (
                            <span className="font-bold text-rose-400">
                              ❌ Rechazado
                            </span>
                          ) : (
                            <span className="font-bold text-amber-400">
                              ⏳ Pendiente
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {t.created_at || 'N/A'}
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
    </div>
  );
};
