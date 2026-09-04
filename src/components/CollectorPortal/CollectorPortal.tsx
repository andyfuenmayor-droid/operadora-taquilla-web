import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { DailyPayment } from '../../types';
import { formatCurrency, formatTime, normalizarMoneda } from '../../utils/formatters';
import { 
  Camera, 
  CameraOff, 
  CheckCircle2, 
  AlertTriangle, 
  QrCode, 
  Receipt,
  RotateCcw,
  MapPin,
  Coins,
  MessageCircle,
  KeyRound,
  HandCoins
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AgencyRouteItem {
  nombre_agencia: string;
  telefono_whatsapp?: string;
  telefono?: string;
}

export const CollectorPortal: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'scan' | 'route' | 'custody'>('scan');

  // Scanner & PIN state
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [verifiedTicket, setVerifiedTicket] = useState<DailyPayment | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);

  // Data lists
  const [pendingCollections, setPendingCollections] = useState<DailyPayment[]>([]);
  const [collectedHistory, setCollectedHistory] = useState<DailyPayment[]>([]);
  const [assignedAgencies, setAssignedAgencies] = useState<AgencyRouteItem[]>([]);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const collectorName = user?.nombre || user?.usuario || 'Cobrador Ruta';
  const collectorId = user?.id;

  // Load collector's route agencies, pending handoffs, and collected history
  const loadCollectorData = async () => {
    try {
      // 1. Load assigned agencies from cda_cobrador_agencias or all agencias
      let agList: AgencyRouteItem[] = [];
      if (collectorId) {
        const { data: asigData } = await supabase
          .table('cda_cobrador_agencias')
          .select('nombre_agencia')
          .eq('cobrador_id', String(collectorId));

        if (asigData && asigData.length > 0) {
          const agencyNames = asigData.map((a: any) => a.nombre_agencia);
          const { data: agsDetails } = await supabase
            .table('agencias')
            .select('nombre_agencia, telefono_whatsapp, telefono')
            .in('nombre_agencia', agencyNames);

          agList = agsDetails || asigData.map((a: any) => ({ nombre_agencia: a.nombre_agencia }));
        }
      }

      if (agList.length === 0) {
        // Fallback: list all active agencies
        const { data: allAgs } = await supabase
          .table('agencias')
          .select('nombre_agencia, telefono_whatsapp, telefono')
          .limit(20);
        agList = allAgs || [];
      }
      setAssignedAgencies(agList);

      // 2. Load pending handoffs (payments of type COBRADOR or with qr_token that have not been collected)
      const { data: pends } = await supabase
        .table('cda_pagos_diarios')
        .select('*')
        .neq('estado', 'cobrado')
        .order('id', { ascending: false })
        .limit(50);

      // Filter for those with qr_token or metodo_pago containing cobrador/efectivo
      const filteredPends = (pends || []).filter(
        (p: any) => p.qr_token || (p.metodo_pago && p.metodo_pago.toUpperCase().includes('COBRADOR'))
      );
      setPendingCollections(filteredPends);

      // 3. Load collections made by this collector
      const { data: history } = await supabase
        .table('cda_pagos_diarios')
        .select('*')
        .eq('estado', 'cobrado')
        .order('id', { ascending: false })
        .limit(100);

      setCollectedHistory(history || []);
    } catch (err) {
      console.error('Error loading collector data:', err);
    }
  };

  useEffect(() => {
    loadCollectorData();
  }, [collectorId]);

  const verifyTicketPayload = async (rawText: string) => {
    setLoadingVerify(true);
    setErrorStatus(null);
    setVerifiedTicket(null);

    try {
      const cleanToken = rawText.trim();
      let ticketToFind = cleanToken;

      if (cleanToken.includes('TK:')) {
        const match = cleanToken.match(/TK:([A-Z0-9\-_]+)/i);
        if (match && match[1]) ticketToFind = match[1];
      }

      // Query by ticket_nro, exact qr_token, or PIN matching
      const { data: directMatch } = await supabase
        .table('cda_pagos_diarios')
        .select('*')
        .or(`ticket_nro.eq.${ticketToFind},qr_token.eq.${cleanToken}`)
        .maybeSingle();

      let targetTicket = directMatch;

      // If not found directly and looks like a PIN (e.g. 6 digits), search ilike on qr_token
      if (!targetTicket && cleanToken.length >= 4) {
        const { data: pinMatch } = await supabase
          .table('cda_pagos_diarios')
          .select('*')
          .ilike('qr_token', `%${cleanToken}%`)
          .limit(1);

        if (pinMatch && pinMatch.length > 0) {
          targetTicket = pinMatch[0];
        }
      }

      if (!targetTicket) {
        setErrorStatus(`No se encontró comprobante asociado a "${cleanToken}". Verifique el código o PIN dictado.`);
        return;
      }

      setVerifiedTicket(targetTicket);
    } catch (err: unknown) {
      console.error('Error verifying ticket:', err);
      setErrorStatus(err instanceof Error ? err.message : 'Error al verificar el ticket.');
    } finally {
      setLoadingVerify(false);
    }
  };

  const startScanner = async () => {
    setErrorStatus(null);
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader-container');
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          stopScanner();
          verifyTicketPayload(decodedText);
        },
        () => {}
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Failed to start camera:', err);
      setErrorStatus('No se pudo acceder a la cámara. Ingrese el código PIN manualmente.');
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    verifyTicketPayload(manualCode.trim());
  };

  const handleConfirmCollection = async (ticket: DailyPayment) => {
    if (!ticket?.id) return;
    setLoadingConfirm(true);

    try {
      const now = new Date();
      const { error } = await supabase
        .table('cda_pagos_diarios')
        .update({
          estado: 'cobrado',
          cobrado_por: collectorName,
          cobrador_id: collectorId ? String(collectorId) : null,
          cobrador_nombre: collectorName,
          fecha_cobro: now.toISOString(),
          fecha_escaneo_cobrador: now.toISOString(),
          confirmado: true,
          confirmado_supervisor: true,
        })
        .eq('id', ticket.id);

      if (error) throw error;

      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#00C853', '#38BDF8'],
      });

      const updated = {
        ...ticket,
        estado: 'cobrado' as const,
        cobrado_por: collectorName,
      };

      setVerifiedTicket(updated);
      setCollectedHistory((prev) => [updated, ...prev]);
      setPendingCollections((prev) => prev.filter((p) => p.id !== ticket.id));
      alert('¡Cobro registrado y validado con éxito!');
    } catch (err: unknown) {
      console.error('Error confirming collection:', err);
      alert(err instanceof Error ? err.message : 'Error al liquidar cobro.');
    } finally {
      setLoadingConfirm(false);
    }
  };

  // Compute active custody metrics per currency
  const custodyBS = collectedHistory
    .filter((h) => normalizarMoneda(h.moneda) === 'BS')
    .reduce((acc, h) => acc + (Number(h.monto) || 0), 0);

  const custodyUSD = collectedHistory
    .filter((h) => normalizarMoneda(h.moneda) === 'USD')
    .reduce((acc, h) => acc + (Number(h.monto) || 0), 0);

  const custodyCOP = collectedHistory
    .filter((h) => normalizarMoneda(h.moneda) === 'COP')
    .reduce((acc, h) => acc + (Number(h.monto) || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-[#0D1B22] to-sky-950/40 border border-emerald-500/30 p-5 rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <QrCode className="w-7 h-7" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-400">
                Portal Móvil de Cobranza & Validación
              </div>
              <h2 className="text-xl font-black text-white">
                Hola, {collectorName}
              </h2>
              <div className="text-xs text-slate-400">
                Validación instantánea de entregas y custodia de fondos en ruta
              </div>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            🟢 EN TURNO ACTIVO
          </div>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="flex items-center gap-2 mt-5 border-t border-slate-800/80 pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'scan'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Validar PIN / Escáner QR</span>
          </button>

          <button
            onClick={() => setActiveTab('route')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'route'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Mi Ruta ({assignedAgencies.length} Agencias)</span>
          </button>

          <button
            onClick={() => setActiveTab('custody')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'custody'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Fondos en Custodia ({collectedHistory.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: SCANNER & PIN VALIDATION */}
      {/* ========================================================= */}
      {activeTab === 'scan' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Camera Box */}
            <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center min-h-[290px]">
              <div
                id="qr-reader-container"
                className="w-full max-w-[260px] h-[220px] rounded-xl overflow-hidden bg-black/40 border border-slate-700/60 flex items-center justify-center relative mb-4"
              >
                {!isScanning && (
                  <div className="text-center p-4">
                    <Camera className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <span className="text-xs text-slate-400">Cámara Inactiva</span>
                  </div>
                )}
              </div>

              <div className="w-full flex gap-3">
                {!isScanning ? (
                  <button
                    onClick={startScanner}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Activar Cámara QR</span>
                  </button>
                ) : (
                  <button
                    onClick={stopScanner}
                    className="w-full bg-rose-500 hover:bg-rose-400 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <CameraOff className="w-4 h-4" />
                    <span>Detener Cámara</span>
                  </button>
                )}
              </div>
            </div>

            {/* Manual PIN / Ticket Input */}
            <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-sky-400" />
                  Validación Rápida por Código PIN (6 Dígitos)
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Ingresa el código PIN de 6 dígitos que te dictó o generó la taquilla:
                </p>

                <form onSubmit={handleManualSearch} className="space-y-3">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Ej. 482910 o TK-9382"
                    className="w-full bg-[#071217] border border-slate-700 rounded-xl px-4 py-3 text-lg text-white font-mono font-bold uppercase focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={loadingVerify || !manualCode.trim()}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black py-3 px-4 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loadingVerify ? 'Verificando...' : '⚡ VALIDAR PIN / TICKET'}
                  </button>
                </form>
              </div>

              {errorStatus && (
                <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>{errorStatus}</div>
                </div>
              )}
            </div>
          </div>

          {/* Verified Ticket Card */}
          {verifiedTicket && (
            <div className="bg-[#0D1B22] border-2 border-emerald-500/50 rounded-2xl p-6 shadow-2xl animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Comprobante Autenticado
                  </span>
                  <h3 className="text-2xl font-mono font-black text-white">
                    #{verifiedTicket.ticket_nro || verifiedTicket.qr_token || verifiedTicket.id}
                  </h3>
                </div>
                <button
                  onClick={() => setVerifiedTicket(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Limpiar"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div>
                  <div className="text-[11px] text-slate-400">Agencia</div>
                  <div className="font-bold text-white text-sm">{verifiedTicket.agencia}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Fecha y Hora</div>
                  <div className="font-mono text-slate-300 text-sm">
                    {verifiedTicket.fecha} {verifiedTicket.hora ? formatTime(verifiedTicket.hora) : ''}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Tipo de Entrega</div>
                  <div className="font-semibold text-sky-400 text-sm">{verifiedTicket.metodo_pago || 'Efectivo Ruta'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Monto</div>
                  <div className="font-mono font-black text-emerald-400 text-xl">
                    {formatCurrency(verifiedTicket.monto, verifiedTicket.moneda)}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#071217] border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-400">Estado:</div>
                  <div className="text-sm font-bold mt-0.5">
                    {verifiedTicket.estado === 'cobrado' ? (
                      <span className="text-amber-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Ya cobrado por: {verifiedTicket.cobrado_por || collectorName}
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Listo para Recibir Efectivo
                      </span>
                    )}
                  </div>
                </div>

                {verifiedTicket.estado !== 'cobrado' && (
                  <button
                    onClick={() => handleConfirmCollection(verifiedTicket)}
                    disabled={loadingConfirm}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-6 py-3 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loadingConfirm ? 'Registrando...' : '🤝 CONFIRMAR RECEPCIÓN DE EFECTIVO'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Pending Collections in Route */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-emerald-400" />
                Entregas en Efectivo Pendientes por Cobrar ({pendingCollections.length})
              </h3>
              <button
                onClick={loadCollectorData}
                className="text-xs text-slate-400 hover:text-white"
              >
                Actualizar
              </button>
            </div>

            {pendingCollections.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs bg-[#071217] rounded-xl border border-slate-800">
                ✅ ¡Al día! No hay entregas pendientes de confirmación en tus agencias asignadas.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCollections.map((item) => {
                  const pinCode = item.qr_token ? item.qr_token.replace('QR-REC-', '') : item.ticket_nro;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#071217] border border-slate-800/80 hover:border-slate-700 transition-colors"
                    >
                      <div>
                        <div className="text-sm font-black text-white">🏢 {item.agencia}</div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>📅 {item.fecha}</span>
                          <span>&bull;</span>
                          <span>PIN: <strong className="font-mono text-sky-400">{pinCode}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs text-slate-400 font-semibold uppercase">Monto a Recibir</div>
                          <div className="text-lg font-black font-mono text-emerald-400">
                            {formatCurrency(item.monto, item.moneda)}
                          </div>
                        </div>

                        <button
                          onClick={() => handleConfirmCollection(item)}
                          className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
                        >
                          🤝 Recibir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: MI RUTA DE AGENCIAS */}
      {/* ========================================================= */}
      {activeTab === 'route' && (
        <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-sky-400" />
              Directorio de Agencias en Ruta
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Puntos de venta configurados para visitas de cobranza física:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {assignedAgencies.length === 0 ? (
              <div className="col-span-2 text-center text-xs text-slate-500 py-6">
                No tienes agencias asignadas a tu ruta actualmente.
              </div>
            ) : (
              assignedAgencies.map((ag, idx) => {
                const phone = ag.telefono_whatsapp || ag.telefono;
                const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
                const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('0') ? '58' + cleanPhone.slice(1) : cleanPhone}` : null;

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#071217] border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-white text-sm">🏢 {ag.nombre_agencia}</div>
                      <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                        🟢 Habilitada en Ruta
                      </div>
                    </div>

                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/30 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-500">Sin teléfono</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: MIS RECAUDACIONES Y CUSTODIA */}
      {/* ========================================================= */}
      {activeTab === 'custody' && (
        <div className="space-y-6">
          {/* Custody Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0D1B22] border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                Custodia Bolívares (BS)
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400">
                {formatCurrency(custodyBS, 'BS')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Recaudación en efectivo Bs.</div>
            </div>

            <div className="bg-[#0D1B22] border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                Custodia Dólares (USD)
              </div>
              <div className="text-2xl font-black font-mono text-sky-400">
                {formatCurrency(custodyUSD, 'USD')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Recaudación en efectivo USD</div>
            </div>

            <div className="bg-[#0D1B22] border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                Custodia Pesos (COP)
              </div>
              <div className="text-2xl font-black font-mono text-amber-400">
                {formatCurrency(custodyCOP, 'COP')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Recaudación en efectivo COP</div>
            </div>
          </div>

          {/* Detailed Collected History Table */}
          <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                Historial de Recaudaciones Liquidadas ({collectedHistory.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Ticket / PIN</th>
                    <th className="py-3 px-4 font-semibold">Agencia</th>
                    <th className="py-3 px-4 font-semibold">Fecha y Hora</th>
                    <th className="py-3 px-4 font-semibold text-right">Monto</th>
                    <th className="py-3 px-4 font-semibold text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {collectedHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        Aún no se han registrado cobros liquidados.
                      </td>
                    </tr>
                  ) : (
                    collectedHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          {h.ticket_nro || (h.qr_token ? h.qr_token.replace('QR-REC-', '') : `ID-${h.id}`)}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {h.agencia}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {h.fecha} {h.hora ? formatTime(h.hora) : ''}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {formatCurrency(h.monto, h.moneda)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Liquidado
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
    </div>
  );
};
