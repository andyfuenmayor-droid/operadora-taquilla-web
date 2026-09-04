import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { DailyPayment } from '../../types';
import { formatCurrency, getTodayDateString, formatTime } from '../../utils/formatters';
import { 
  Camera, 
  CameraOff, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  QrCode, 
  Receipt,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const CollectorPortal: React.FC = () => {
  const { user } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [verifiedTicket, setVerifiedTicket] = useState<DailyPayment | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [collectedHistory, setCollectedHistory] = useState<DailyPayment[]>([]);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Load collector's collection history for today
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const today = getTodayDateString();
        const { data } = await supabase
          .table('cda_pagos_diarios')
          .select('*')
          .eq('fecha', today)
          .eq('estado', 'cobrado')
          .order('id', { ascending: false });

        setCollectedHistory(data || []);
      } catch (e) {
        console.error('Error fetching collector history:', e);
      }
    };
    fetchHistory();
  }, []);

  const verifyTicketPayload = async (rawText: string) => {
    setLoadingVerify(true);
    setErrorStatus(null);
    setVerifiedTicket(null);

    try {
      // Extract ticket number if format is TK:TK-XYZ... or raw ticket number
      let ticketToFind = rawText.trim();
      if (rawText.includes('TK:')) {
        const match = rawText.match(/TK:([A-Z0-9\-_]+)/i);
        if (match && match[1]) {
          ticketToFind = match[1];
        }
      }

      // 1. Query by ticket_nro or qr_token
      const { data, error } = await supabase
        .table('cda_pagos_diarios')
        .select('*')
        .or(`ticket_nro.eq.${ticketToFind},qr_token.eq.${rawText}`)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setErrorStatus(`Ticket no encontrado en el sistema (${ticketToFind}). Verifique el código.`);
        return;
      }

      setVerifiedTicket(data);
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
        {
          fps: 15,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          stopScanner();
          verifyTicketPayload(decodedText);
        },
        () => {
          // scanning frame loop (ignored)
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Failed to start camera:', err);
      setErrorStatus('No se pudo acceder a la cámara. Ingrese el código manualmente o verifique los permisos.');
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

  const handleConfirmCollection = async () => {
    if (!verifiedTicket?.id) return;
    setLoadingConfirm(true);

    try {
      const now = new Date();
      const collectorName = user?.nombre || user?.usuario || 'Cobrador Ruta';

      const { error } = await supabase
        .table('cda_pagos_diarios')
        .update({
          estado: 'cobrado',
          cobrado_por: collectorName,
          fecha_cobro: now.toISOString(),
        })
        .eq('id', verifiedTicket.id);

      if (error) throw error;

      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#00C853', '#38BDF8'],
      });

      const updated = {
        ...verifiedTicket,
        estado: 'cobrado' as const,
        cobrado_por: collectorName,
      };

      setVerifiedTicket(updated);
      setCollectedHistory((prev) => [updated, ...prev]);
    } catch (err: unknown) {
      console.error('Error confirming collection:', err);
      alert(err instanceof Error ? err.message : 'Error al liquidar cobro');
    } finally {
      setLoadingConfirm(false);
    }
  };

  const resetVerification = () => {
    setVerifiedTicket(null);
    setErrorStatus(null);
    setManualCode('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div className="bg-[#0D1B22] p-5 rounded-2xl border border-slate-800 text-center">
        <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
          <QrCode className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-white">
          Portal de Cobranza en Ruta & Escáner QR
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Validación instantánea de tickets de taquilla (&lt; 0.05s) por cámara web o móvil
        </p>
      </div>

      {/* Scanner & Manual Input Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Camera Scanner Box */}
        <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center min-h-[300px]">
          <div
            id="qr-reader-container"
            className="w-full max-w-[280px] h-[250px] rounded-xl overflow-hidden bg-black/40 border border-slate-700/60 flex items-center justify-center relative mb-4"
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

        {/* Manual Code Input */}
        <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-sky-400" />
              Búsqueda Manual de Ticket
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Si el ticket está doblado o la cámara no enfoca, digite el número de ticket:
            </p>

            <form onSubmit={handleManualSearch} className="space-y-3">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ej. TK-MLK-9382"
                className="w-full bg-[#071217] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={loadingVerify || !manualCode.trim()}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {loadingVerify ? 'Verificando...' : 'Consultar Ticket'}
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

      {/* Ticket Verification Card */}
      {verifiedTicket && (
        <div className="bg-[#0D1B22] border-2 border-emerald-500/50 rounded-2xl p-6 shadow-2xl animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4 mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Ticket Autenticado
              </span>
              <h3 className="text-2xl font-mono font-black text-white">
                #{verifiedTicket.ticket_nro}
              </h3>
            </div>
            <button
              onClick={resetVerification}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Limpiar"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div>
              <div className="text-[11px] text-slate-400">Agencia Emisora</div>
              <div className="font-bold text-white text-sm">{verifiedTicket.agencia}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Fecha y Hora</div>
              <div className="font-mono text-slate-300 text-sm">
                {verifiedTicket.fecha} {formatTime(verifiedTicket.hora)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Método de Pago</div>
              <div className="font-semibold text-sky-400 text-sm">{verifiedTicket.metodo_pago}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Monto del Ticket</div>
              <div className="font-mono font-black text-emerald-400 text-xl">
                {formatCurrency(verifiedTicket.monto, verifiedTicket.moneda)}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#071217] border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Estado del Ticket:</div>
              <div className="text-sm font-bold mt-0.5">
                {verifiedTicket.estado === 'cobrado' ? (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Ya cobrado en ruta por: {verifiedTicket.cobrado_por || 'Cobrador'}
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Válido para Cobro Inmediato
                  </span>
                )}
              </div>
            </div>

            {verifiedTicket.estado !== 'cobrado' && (
              <button
                onClick={handleConfirmCollection}
                disabled={loadingConfirm}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-6 py-3 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {loadingConfirm ? 'Registrando...' : 'Marcar como Cobrado'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Collector Today's History */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            Historial de Cobros Liquidados Hoy ({collectedHistory.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400">
                <th className="py-3 px-4 font-semibold">Ticket #</th>
                <th className="py-3 px-4 font-semibold">Agencia</th>
                <th className="py-3 px-4 font-semibold">Cobrado Por</th>
                <th className="py-3 px-4 font-semibold text-right">Monto</th>
                <th className="py-3 px-4 font-semibold text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {collectedHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Aún no has liquidado tickets hoy.
                  </td>
                </tr>
              ) : (
                collectedHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {h.ticket_nro}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {h.agencia}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {h.cobrado_por || user?.nombre}
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
  );
};
