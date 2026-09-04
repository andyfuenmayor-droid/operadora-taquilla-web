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
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount || 0;
  const norm = normalizarMoneda(currency);

  if (norm === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } else if (norm === 'BS') {
    const formatted = new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
    return `${formatted} Bs.`;
  } else if (norm === 'COP') {
    return `COP $${new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)}`;
  } else {
    return `${norm} ${num.toFixed(2)}`;
  }
}

export function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return '';
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
