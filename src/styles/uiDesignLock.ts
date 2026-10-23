/**
 * LEY PERMANENTE E INMUTABLE DE DISEÑO VISUAL - MULTIBANCA EXPRESS TAQUILLA WEB POS
 * Design System Tokens & Classes para Paridad Dual Modo Claro / Modo Oscuro
 * y Estructura Jerárquica Unificada en todos los Módulos de Taquilla.
 */

export const UI_LOCK = {
  // 1. Fondos y Contenedores Principales
  pageContainer: 'space-y-6 max-w-7xl mx-auto px-4 py-6',
  card: 'bg-white dark:bg-[#0D1B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-slate-900 dark:text-slate-100 shadow-sm transition-colors',
  cardCompact: 'bg-white dark:bg-[#0D1B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-slate-900 dark:text-slate-100 shadow-sm transition-colors',
  cardSubtle: 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4',

  // 2. Bloque 1 - Cabecera Estándar de Módulo
  headerCard: 'bg-white dark:bg-[#0D1B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors',
  headerIconWrap: 'w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-xs',
  headerTitle: 'text-xl font-bold tracking-tight text-slate-900 dark:text-white',
  headerSubtitle: 'text-sm text-slate-500 dark:text-slate-400 mt-0.5',
  headerActions: 'flex items-center gap-2.5 flex-wrap',

  // 3. Bloque 2 - Grid Dinámico de KPIs / Monedas
  kpiGrid: (colsCount: number) => {
    if (colsCount <= 1) return 'grid grid-cols-1 gap-4';
    if (colsCount === 2) return 'grid grid-cols-1 sm:grid-cols-2 gap-4';
    if (colsCount === 3) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';
    return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4';
  },
  kpiCard: 'bg-white dark:bg-[#0D1B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm transition-all hover:border-emerald-500/40 dark:hover:border-emerald-500/40 flex flex-col justify-between',
  kpiLabel: 'text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider',
  kpiValue: 'text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1',

  // 4. Bloque 3 - Formulario Operativo y Filtros
  formContainer: 'bg-white dark:bg-[#0D1B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4',
  filtersBar: 'bg-white dark:bg-[#0D1B22] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3',
  input: 'w-full bg-slate-50 dark:bg-[#071217] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all',
  select: 'w-full bg-slate-50 dark:bg-[#071217] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer',
  label: 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider',

  // Píldoras de Filtro
  filterPillActive: 'px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-sm transition-all cursor-pointer',
  filterPillInactive: 'px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer',

  // 5. Botones Estandarizados (LEY CORPORATIVA ESMERALDA)
  buttonPrimary: 'inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl px-5 py-2.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm active:scale-[0.99]',
  buttonSecondary: 'inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl px-4 py-2.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 text-sm',
  buttonRefresh: 'p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-xs',
  buttonDanger: 'inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl px-4 py-2 text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50',

  // 6. Bloque 4 - Tablas y Filas
  tableContainer: 'bg-white dark:bg-[#0D1B22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-colors',
  table: 'w-full text-left border-collapse text-sm',
  tableThead: 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-bold tracking-wider',
  tableTheadTh: 'px-4 py-3.5',
  tableTh: 'px-4 py-3.5',
  tableRow: 'bg-white hover:bg-slate-50/80 dark:bg-[#0D1B22] dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200 divide-y divide-slate-200 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800/60 transition-colors',
  tableTr: 'bg-white hover:bg-slate-50/80 dark:bg-[#0D1B22] dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200 divide-y divide-slate-200 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800/60 transition-colors',
  tableCell: 'px-4 py-3.5 text-slate-800 dark:text-slate-200',
  tableTd: 'px-4 py-3.5 text-slate-800 dark:text-slate-200',

  // 7. Banners Informativos / Alertas (Modo Claro & Oscuro Dual)
  warningBanner: 'rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 transition-colors bg-amber-50 border border-amber-300 text-amber-900 dark:bg-amber-950/30 dark:border-amber-700/60 dark:text-amber-200',
  warningBannerTitle: 'text-sm font-bold text-amber-900 dark:text-amber-200',
  warningBannerText: 'text-xs text-amber-800 dark:text-amber-300/90 mt-1 leading-relaxed',

  infoBanner: 'rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 transition-colors bg-blue-50 border border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-700/60 dark:text-blue-200',
  successBanner: 'rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 transition-colors bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-700/60 dark:text-emerald-200',
  errorBanner: 'rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 transition-colors bg-rose-50 border border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:border-rose-700/60 dark:text-rose-200',

  // 8. Modales Estandarizados
  modalBackdrop: 'fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto',
  modalContent: 'bg-white dark:bg-[#0D1B22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl p-6 text-slate-900 dark:text-slate-100 relative transition-all',
  modalHeader: 'flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4',
  modalTitle: 'text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2',
  modalFooter: 'flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 mt-6',
};
