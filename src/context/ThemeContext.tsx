import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type AppTheme = 'dark' | 'light';

interface ThemeContextType {
  theme: AppTheme;
  isLight: boolean;
  toggleTheme: () => void;
  setTheme: (newTheme: AppTheme) => void;
  resetToAutoTheme?: () => void;
}

const THEME_STORAGE_KEY = 'app_theme_mode';

/**
 * Verifica si la hora local se encuentra en el rango nocturno (entre 7:00 PM y 7:00 AM).
 * 7:00 PM = hora 19 (19:00 a 23:59)
 * 7:00 AM = hora 7 (00:00 a 06:59)
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
 * Determina el tema inicial según:
 * 1. Preferencia guardada previamente en el explorador (localStorage).
 * 2. Si no la tiene guardada, verifica la configuración de modos del explorador (prefers-color-scheme).
 * 3. Si el explorador tiene modo oscuro configurado, retorna 'dark'.
 * 4. Si el explorador no tiene preferencia definida (o no tiene modo oscuro configurado):
 *    - Entre 7:00 PM y 7:00 AM mantiene modo oscuro por defecto ('dark').
 *    - En horario diurno (7:00 AM a 6:59 PM) usa modo claro por defecto ('light').
 */
export const getInitialTheme = (): AppTheme => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch (e) {
    console.warn('Error reading theme from localStorage:', e);
  }

  // Verificar la configuración de modos del explorador
  if (typeof window !== 'undefined' && window.matchMedia) {
    try {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        return 'dark';
      }
    } catch (e) {
      console.warn('Error checking prefers-color-scheme from browser:', e);
    }
  }

  // Si no tiene configuración guardada y es entre 7pm y 7am mantener modo oscuro por defecto
  return isNightTime() ? 'dark' : 'light';
};

/**
 * Aplica las clases CSS correspondientes en el elemento <html>
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
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        // Solo ajustar automáticamente si el usuario no ha fijado una preferencia manual en localStorage
        if (!stored) {
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

  // Verificación periódica del horario (entre 7pm y 7am) si no hay preferencia manual guardada
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (!stored) {
          const autoTheme = getInitialTheme();
          setThemeState((prev) => (prev !== autoTheme ? autoTheme : prev));
        }
      } catch {
        // Ignorar
      }
    }, 60000); // Cada minuto

    return () => clearInterval(interval);
  }, []);

  // Si existe configuración guardada en config_sistema, leerla
  useEffect(() => {
    const fetchConfigTheme = async () => {
      try {
        const { data: config } = await supabase
          .from('config_sistema')
          .select('valor')
          .eq('parametro', 'tema')
          .maybeSingle();

        if (config?.valor) {
          const val = String(config.valor).toLowerCase().trim();
          if (val === 'claro' || val === 'light') {
            setThemeState('light');
          } else if (val === 'oscuro' || val === 'dark') {
            setThemeState('dark');
          }
        }
      } catch (err) {
        // Fallback silencioso
      }
    };
    fetchConfigTheme();
  }, []);

  const setTheme = useCallback(async (newTheme: AppTheme) => {
    setThemeState(newTheme);
    applyThemeToDOM(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      const dbVal = newTheme === 'light' ? 'Claro' : 'Oscuro';
      await supabase
        .from('config_sistema')
        .upsert(
          { parametro: 'tema', valor: dbVal },
          { onConflict: 'user_id,parametro' }
        );
    } catch (e) {
      // Ignorar si no tiene permisos de admin
    }
  }, []);

  const resetToAutoTheme = useCallback(() => {
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch (e) {
      console.warn('Error clearing theme from localStorage:', e);
    }
    const autoTheme = getInitialTheme();
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
