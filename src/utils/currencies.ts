import { supabase } from '../lib/supabase';

export interface CurrencyConfig {
  id?: number;
  codigo: string;
  nombre: string;
  simbolo: string;
  decimales: number;
  es_default?: boolean;
  icono?: string;
}

export type DynamicCurrencyConfig = CurrencyConfig;

export const DEFAULT_CURRENCIES: CurrencyConfig[] = [
  { id: 1, codigo: 'BS', nombre: 'Bolívares', simbolo: 'Bs.', decimales: 2, es_default: true },
  { id: 2, codigo: 'USD', nombre: 'Dólares', simbolo: '$', decimales: 2, es_default: true },
  { id: 3, codigo: 'COP', nombre: 'Pesos Colombianos', simbolo: 'COP$', decimales: 0, es_default: true },
];

/**
 * Normaliza cualquier valor de divisa soportando alias comunes y respetando códigos dinámicos
 */
export function normalizeCurrency(mVal?: string | null): string {
  if (!mVal) return 'BS';
  const clean = String(mVal).trim().toUpperCase();
  if (['BS', 'VES', 'BOLIVARES', 'BOLÍVARES', 'BS.'].includes(clean)) return 'BS';
  if (['USD', 'DOLARES', 'DÓLARES', 'US$', '$'].includes(clean)) return 'USD';
  if (['COP', 'PESOS', 'COL'].includes(clean)) return 'COP';
  return clean;
}

/**
 * Devuelve la bandera o ícono representativo de la divisa
 */
export function getCurrencyFlag(currency: string): string {
  const norm = normalizeCurrency(currency);
  if (norm === 'BS') return '🇻🇪';
  if (norm === 'USD') return '🇺🇸';
  if (norm === 'COP') return '🇨🇴';
  if (norm === 'EUR') return '🇪🇺';
  if (norm === 'USDT') return '₮';
  if (norm === 'BRL') return '🇧🇷';
  return '🌐';
}

/**
 * Clases de estilo Tailwind para badges de monedas en Dual Mode
 */
export function getCurrencyBadgeClasses(currency: string): string {
  const norm = normalizeCurrency(currency);
  if (norm === 'BS') {
    return 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20';
  }
  if (norm === 'USD') {
    return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20';
  }
  if (norm === 'COP') {
    return 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20';
  }
  if (norm === 'EUR') {
    return 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20';
  }
  if (norm === 'USDT') {
    return 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20';
  }
  return 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20';
}

/**
 * Carga la lista completa de monedas activas desde config_sistema o localStorage
 */
export async function loadCurrencies(userId?: string): Promise<CurrencyConfig[]> {
  const localKey = userId ? `operadora_catalogo_monedas_${userId}` : 'operadora_catalogo_monedas_default';

  if (userId) {
    try {
      const { data: cfgRow, error: cfgErr } = await supabase
        .from('config_sistema')
        .select('valor')
        .eq('user_id', userId)
        .eq('parametro', 'catalogo_monedas')
        .maybeSingle();

      if (!cfgErr && cfgRow?.valor) {
        try {
          const parsed = JSON.parse(cfgRow.valor);
          if (Array.isArray(parsed) && parsed.length > 0) {
            try {
              localStorage.setItem(localKey, JSON.stringify(parsed));
            } catch (_) {}
            return parsed;
          }
        } catch (_) {}
      }
    } catch (e) {
      console.warn('Error fetching currencies from config_sistema:', e);
    }
  }

  try {
    const rawLocal = localStorage.getItem(localKey);
    if (rawLocal) {
      const parsedLocal = JSON.parse(rawLocal);
      if (Array.isArray(parsedLocal) && parsedLocal.length > 0) {
        return parsedLocal;
      }
    }
  } catch (e) {
    console.warn('Error reading currencies from localStorage:', e);
  }

  return DEFAULT_CURRENCIES.map((c) => ({ ...c }));
}
