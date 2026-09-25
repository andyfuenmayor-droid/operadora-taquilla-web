export function normalizarMoneda(mon?: string): string {
  const m = String(mon || '').toUpperCase().trim();
  if (['BS', 'VES', 'BOLIVARES', 'BOLÍVARES', 'BS.', 'BOLIVAR', 'VES.'].includes(m)) {
    return 'BS';
  }
  if (['USD', 'DOLARES', 'DÓLARES', '$', 'DOLAR', 'USD.', 'USDT'].includes(m)) {
    return 'USD';
  }
  if (['COP', 'PESOS', 'PESO', 'COP.'].includes(m)) {
    return 'COP';
  }
  return m || 'BS';
}

export function formatCurrency(amount: number | string, currency = 'USD'): string {
  let num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount || 0;
  if (Math.abs(num) < 0.005) num = 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const norm = normalizarMoneda(currency);

  if (norm === 'USD') {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absNum);
    return isNegative ? `-${formatted}` : formatted;
  } else if (norm === 'BS') {
    const formatted = new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absNum);
    return isNegative ? `-${formatted} Bs.` : `${formatted} Bs.`;
  } else if (norm === 'COP') {
    const formatted = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(absNum);
    return isNegative ? `-COP $${formatted}` : `COP $${formatted}`;
  } else {
    return isNegative ? `-${norm} ${absNum.toFixed(2)}` : `${norm} ${absNum.toFixed(2)}`;
  }
}

export function formatMoney(amount: number | string, currency = 'BS'): string {
  let num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount || 0;
  if (Math.abs(num) < 0.005) num = 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const norm = normalizarMoneda(currency);
  const numStr = absNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (norm === 'BS') return isNegative ? `-Bs. ${numStr}` : `Bs. ${numStr}`;
  if (norm === 'USD') return isNegative ? `-$${numStr}` : `$${numStr}`;
  if (norm === 'COP') {
    const copStr = Math.round(absNum).toLocaleString('en-US');
    return isNegative ? `-COP $${copStr}` : `COP $${copStr}`;
  }
  return isNegative ? `-${norm} ${numStr}` : `${norm} ${numStr}`;
}

export function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return '';
  if (typeof dateStr === 'string') {
    const clean = dateStr.trim();
    const matchYMD = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchYMD) {
      const [, y, m, d] = matchYMD;
      return `${d}/${m}/${y}`;
    }
    const matchDMY = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (matchDMY) {
      const [, d, m, y] = matchDMY;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTime(timeStr?: string | Date): string {
  if (!timeStr) return '';
  if (typeof timeStr === 'string' && timeStr.includes(':')) {
    return timeStr.slice(0, 8);
  }
  const d = typeof timeStr === 'string' ? new Date(timeStr) : timeStr;
  if (isNaN(d.getTime())) return String(timeStr);
  return d.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateTicketNumber(prefix = 'TK'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${timestamp}-${random}`;
}
