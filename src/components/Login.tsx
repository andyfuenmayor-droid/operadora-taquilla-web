import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Lock, User, ArrowRight, Zap } from 'lucide-react';
import { Logo } from './Common/Logo';
import { ThemeToggle } from './Common/ThemeToggle';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { isLight } = useTheme();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !clave.trim()) {
      setErrorMsg('Por favor complete todos los campos.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const result = await login(usuario, clave);
    if (!result.success) {
      setErrorMsg(result.message || 'Credenciales inválidas.');
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden transition-colors ${
        isLight ? 'bg-slate-50 text-slate-800' : 'bg-[#071217] text-slate-100'
      }`}
    >
      {/* Floating Theme Switcher */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <ThemeToggle showLabel />
      </div>

      {/* Ambient background glow */}
      <div
        className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-opacity ${
          isLight ? 'bg-emerald-200/40 opacity-70' : 'bg-emerald-500/10'
        }`}
      />
      <div
        className={`absolute bottom-10 right-10 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-opacity ${
          isLight ? 'bg-sky-200/40 opacity-70' : 'bg-sky-500/10'
        }`}
      />

      <div
        className={`w-full max-w-md border rounded-3xl p-8 shadow-2xl relative z-10 transition-all ${
          isLight
            ? 'bg-white border-slate-200/90 shadow-slate-300/40'
            : 'bg-[#0D1B22]/90 border-slate-800/80 backdrop-blur-md'
        }`}
      >
        {/* Top Accent line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-400 via-emerald-500 to-teal-400 rounded-t-3xl" />

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo className="h-12 w-auto" />
          </div>
          <h1
            className={`text-2xl font-black tracking-tight flex items-center justify-center gap-2 ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
          >
            Taquilla Web POS
            <span
              className={`text-xs uppercase px-2 py-0.5 rounded font-bold border ${
                isLight
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
            >
              v2.0
            </span>
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Sistema de Cobro y Cierre en Tiempo Real
          </p>
          <div
            className={`inline-flex items-center gap-1.5 text-xs font-mono mt-2 px-2.5 py-1 rounded-full border ${
              isLight
                ? 'text-sky-700 bg-sky-50 border-sky-200'
                : 'text-sky-400 bg-sky-500/10 border-sky-500/20'
            }`}
          >
            <Zap className={`w-3 h-3 ${isLight ? 'text-sky-600' : 'text-sky-400'}`} />
            taq.multibancaexpress.com
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm flex items-start gap-2.5 animate-fadeIn">
            <span className="text-base font-bold">⚠️</span>
            <div className="leading-snug">{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                isLight ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              Usuario o Terminal
            </label>
            <div className="relative">
              <div
                className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${
                  isLight ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Ej. agencia1 o cajero_01"
                autoComplete="username"
                className={`w-full rounded-xl pl-10 pr-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                  isLight
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-500'
                    : 'bg-[#071217] border border-slate-700/70 text-white placeholder-slate-500 focus:border-emerald-500'
                }`}
              />
            </div>
          </div>

          <div>
            <label
              className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                isLight ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              Clave de Acceso
            </label>
            <div className="relative">
              <div
                className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${
                  isLight ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className={`w-full rounded-xl pl-10 pr-4 py-3 text-sm transition-all font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                  isLight
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-500'
                    : 'bg-[#071217] border border-slate-700/70 text-white placeholder-slate-500 focus:border-emerald-500'
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Verificando acceso...</span>
              </div>
            ) : (
              <>
                <span>Iniciar Sesión</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className={`mt-8 pt-6 border-t text-center ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          <p className="text-xs text-slate-500">
            Multibanca Express &bull; Alta Velocidad &bull; Seguridad Cifrada
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
