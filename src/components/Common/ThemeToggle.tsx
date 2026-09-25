import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { isLight, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
        isLight
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20'
          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
      } ${className}`}
      title={isLight ? 'Cambiar a Modo Oscuro (Original)' : 'Cambiar a Vista Clara'}
      aria-label={isLight ? 'Cambiar a Modo Oscuro' : 'Cambiar a Vista Clara'}
    >
      {isLight ? (
        <>
          <Moon className="w-3.5 h-3.5 text-indigo-500" />
          {showLabel && <span>Modo Oscuro</span>}
          {!showLabel && <span className="hidden sm:inline text-[11px]">Oscuro</span>}
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          {showLabel && <span>Vista Clara</span>}
          {!showLabel && <span className="hidden sm:inline text-[11px]">Claro</span>}
        </>
      )}
    </button>
  );
};
