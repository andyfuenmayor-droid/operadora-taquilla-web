import React, { useEffect, useState, useRef } from 'react';
import { 
  notificationService, 
  type InAppToastPayload 
} from '../../utils/notificationService';
import { 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Bell, 
  DollarSign, 
  Landmark,
  Sparkles,
  Send
} from 'lucide-react';

interface ToastItem extends InAppToastPayload {
  progress: number;
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const isPausedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const unsubscribe = notificationService.onToast((newToast) => {
      setToasts((prev) => {
        // Prevent exact duplicates already visible
        const exists = prev.some((t) => t.id === newToast.id);
        if (exists) return prev;
        return [{ ...newToast, progress: 100 }, ...prev.slice(0, 4)]; // Max 5 visible
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Timer for toast progress and auto-dismiss
  useEffect(() => {
    if (toasts.length === 0) return;

    const interval = setInterval(() => {
      setToasts((prev) => {
        return prev
          .map((t) => {
            if (isPausedRef.current[t.id]) return t;
            const newProgress = t.progress - 1.5; // ~6.6 seconds total
            return { ...t, progress: newProgress };
          })
          .filter((t) => t.progress > 0);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [toasts.length]);

  const handleDismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <aside 
      aria-label="Notificaciones de Taquilla"
      className="fixed top-4 right-4 z-[99999] pointer-events-none flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] sm:w-96 select-none"
    >
      {toasts.map((toast) => {
        const isPayment = toast.type === 'payment';
        const isCash = toast.type === 'cash';
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';

        // Config color / icons
        let themeStyles = {
          border: 'border-sky-500/40',
          bg: 'bg-[#081824]/95',
          glow: 'shadow-[0_12px_36px_rgba(14,165,233,0.3)]',
          badgeBg: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
          badgeText: 'TAQUILLA POS',
          progressBar: 'bg-sky-400',
          icon: <Bell className="w-4 h-4 text-sky-400 animate-bounce" />,
        };

        if (isSuccess) {
          themeStyles = {
            border: 'border-emerald-500/50 ring-1 ring-emerald-500/30',
            bg: 'bg-[#061c1b]/95',
            glow: 'shadow-[0_12px_40px_rgba(16,185,129,0.35)]',
            badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            badgeText: 'PAGO CONFIRMADO',
            progressBar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />,
          };
        } else if (isPayment) {
          themeStyles = {
            border: 'border-teal-500/50',
            bg: 'bg-[#061d19]/95',
            glow: 'shadow-[0_12px_36px_rgba(20,184,166,0.3)]',
            badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
            badgeText: 'GESTIÓN BANCARIA',
            progressBar: 'bg-teal-400',
            icon: <Landmark className="w-4 h-4 text-teal-400" />,
          };
        } else if (isWarning) {
          themeStyles = {
            border: 'border-rose-500/50 ring-1 ring-rose-500/30',
            bg: 'bg-[#1f090e]/95',
            glow: 'shadow-[0_12px_36px_rgba(244,63,94,0.3)]',
            badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
            badgeText: 'PAGO RECHAZADO',
            progressBar: 'bg-rose-500',
            icon: <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />,
          };
        } else if (isCash) {
          themeStyles = {
            border: 'border-amber-500/50 ring-1 ring-amber-500/30',
            bg: 'bg-[#1f1606]/95',
            glow: 'shadow-[0_12px_40px_rgba(245,158,11,0.35)]',
            badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
            badgeText: 'PAGO EN EFECTIVO',
            progressBar: 'bg-gradient-to-r from-amber-500 to-yellow-400',
            icon: <DollarSign className="w-4 h-4 text-amber-400" />,
          };
        }

        return (
          <div
            key={toast.id}
            onMouseEnter={() => {
              isPausedRef.current[toast.id] = true;
            }}
            onMouseLeave={() => {
              isPausedRef.current[toast.id] = false;
            }}
            className={`pointer-events-auto backdrop-blur-xl border rounded-2xl p-3.5 sm:p-4 text-white transition-all transform duration-300 ease-out translate-y-0 opacity-100 relative overflow-hidden flex flex-col gap-2 ${themeStyles.border} ${themeStyles.bg} ${themeStyles.glow}`}
          >
            {/* Top Bar: Icon + Badge + Dismiss */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center">
                  {themeStyles.icon}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${themeStyles.badgeBg}`}>
                  {themeStyles.badgeText}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-mono">Ahora</span>
                <button
                  type="button"
                  onClick={() => handleDismiss(toast.id)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="pr-1">
              <h4 className="text-sm font-black text-slate-100 leading-snug flex items-center gap-1.5">
                <span>{toast.title}</span>
                {isSuccess && <Sparkles className="w-3.5 h-3.5 text-amber-300 inline shrink-0" />}
              </h4>
              {toast.body && (
                <p className="text-xs text-slate-300 mt-1 leading-relaxed line-clamp-2">
                  {toast.body}
                </p>
              )}
            </div>

            {/* Progress Countdown Bar */}
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all duration-100 ease-linear rounded-full ${themeStyles.progressBar}`}
                style={{ width: `${Math.max(0, Math.min(100, toast.progress))}%` }}
              />
            </div>
          </div>
        );
      })}
    </aside>
  );
};
