import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type AppTheme = 'dark' | 'light';

interface ThemeContextType {
  theme: AppTheme;
  isLight: boolean;
  toggleTheme: () => void;
  setTheme: (newTheme: AppTheme) => void;
  resetToAutoTheme: () => void;
  isManualTheme: boolean;
}

const THEME_STORAGE_KEY = 'app_theme_mode';
const THEME_MANUAL_FLAG = 'app_theme_is_manual';

/**
 * Verifica si la hora local se encuentra en el rango nocturno (entre 7:00 PM y 7:00 AM).
 * 7:00 PM = hora 19 (19:00 a 23:59) -> true (Modo oscuro)
 * 7:00 AM = hora 7 (00:00 a 06:59) -> true (Modo oscuro)
 * Horario diurno = horas 7 a 18 (07:00 a 18:59) -> false (Modo claro)
 */
export const isNightTime = (): boolean => {
  try {
    const hour = new Date().getHours();
    return hour >= 19 || hour < 7;
  } catch {
    return false;
  }
};

/**
 * Calcula el tema automático basado en:
 * 1. Configuración de modos del explorador/sistema (prefers-color-scheme: dark).
 * 2. Si el explorador no tiene preferencia definida (o no está en modo oscuro):
 *    - Entre 7:00 PM (19:00) y 7:00 AM (07:00): Modo oscuro por defecto ('dark').
 *    - Horario diurno (7:00 AM a 6:59 PM): Modo claro por defecto ('light').
 */
export const resolveAutoTheme = (): AppTheme => {
  // 1. Si el explorador/sistema tiene explícitamente configurado modo oscuro
  if (typeof window !== 'undefined' && window.matchMedia) {
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch (e) {
      console.warn('Error checking prefers-color-scheme:', e);
    }
  }

  // 2. Si el explorador no tiene preferencia definida o no está en modo oscuro:
  // Horario nocturno (19:00 - 06:59) -> dark
  // Horario diurno (07:00 - 18:59) -> light
  return isNightTime() ? 'dark' : 'light';
};

/**
 * Determina el tema inicial:
 * - Si el usuario seleccionó explícitamente un tema manual, se respeta.
 * - De lo contrario, se calcula el tema automático según explorador y horario.
 */
export const getInitialTheme = (): AppTheme => {
  try {
    const isManual = localStorage.getItem(THEME_MANUAL_FLAG) === 'true';
    if (isManual) {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } else {
      // Limpiar cualquier residuo de versiones anteriores en localStorage
      // que pudiera estar forzando 'dark' permanentemente
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Error reading theme from localStorage:', e);
  }

  return resolveAutoTheme();
};

/**
 * Aplica las clases CSS en el elemento <html>
 */
export const applyThemeToDOM = (currentTheme: AppTheme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (currentTheme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }
};

// Aplicar inmediatamente al DOM para evitar parpadeos visuales al cargar
try {
  applyThemeToDOM(getInitialTheme());
} catch {
  // Ignorar en entornos sin DOM
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(getInitialTheme);
  const [isManualTheme, setIsManualTheme] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_MANUAL_FLAG) === 'true';
    } catch {
      return false;
    }
  });

  // Aplica los cambios de tema al elemento <html>
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // Escuchar cambios en la configuración de modos del explorador en tiempo real
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      try {
        const isManual = localStorage.getItem(THEME_MANUAL_FLAG) === 'true';
        if (!isManual) {
          if (e.matches) {
            setThemeState('dark');
          } else {
            setThemeState(isNightTime() ? 'dark' : 'light');
          }
        }
      } catch (err) {
        console.warn('Error en listener de prefers-color-scheme:', err);
      }
    };

    try {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } catch {
      try {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      } catch {}
    }
  }, []);

  // Verificación periódica del horario (cada 30s) para alternar automáticamente
  // entre horario diurno (7am a 7pm) y nocturno (7pm a 7am) si no hay tema manual
  useEffect(() => {
    const checkSchedule = () => {
      try {
        const isManual = localStorage.getItem(THEME_MANUAL_FLAG) === 'true';
        if (!isManual) {
          const autoTheme = resolveAutoTheme();
          setThemeState((prev) => (prev !== autoTheme ? autoTheme : prev));
        }
      } catch {
        // Ignorar
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 30000);

    return () => clearInterval(interval);
  }, []);

  const setTheme = useCallback((newTheme: AppTheme) => {
    setThemeState(newTheme);
    setIsManualTheme(true);
    applyThemeToDOM(newTheme);
    try {
      localStorage.setItem(THEME_MANUAL_FLAG, 'true');
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {
      console.warn('Error saving theme to localStorage:', e);
    }
  }, []);

  const resetToAutoTheme = useCallback(() => {
    try {
      localStorage.removeItem(THEME_MANUAL_FLAG);
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch (e) {
      console.warn('Error clearing theme from localStorage:', e);
    }
    setIsManualTheme(false);
    const autoTheme = resolveAutoTheme();
    setThemeState(autoTheme);
    applyThemeToDOM(autoTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = {
    theme,
    isLight: theme === 'light',
    toggleTheme,
    setTheme,
    resetToAutoTheme,
    isManualTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
