export type UserRole = 'cajero' | 'supervisor' | 'agencia' | 'cobrador' | 'admin';

export interface UserSession {
  id: string | number;
  usuario: string;
  nombre: string;
  rol: UserRole;
  agencia_id?: string | number;
  terminal_id?: string | number;
  user_id?: string | number;
  cedula_identidad?: string;
  telefono?: string;
  activo?: boolean;
}

export interface Agency {
  id: number | string;
  nombre_agencia: string;
  usuario_taquilla?: string;
  clave_taquilla?: string;
  grupo?: string;
  cuentas_asignadas?: string[];
  saldo_actual?: number;
  activo?: boolean;
}

export interface DailySale {
  id?: number;
  fecha: string;
  agencia: string;
  cajero_id?: string | number;
  nombre_cajero?: string;
  sistema: string;
  monto_ventas: number;
  monto_anulaciones: number;
  monto_premios: number;
  monto_neto?: number;
  cerrado?: boolean;
  created_at?: string;
}

export interface DailyExpense {
  id?: number;
  fecha: string;
  agencia: string;
  cajero_id?: string | number;
  nombre_cajero?: string;
  concepto: string;
  categoria: string;
  monto: number;
  moneda: 'USD' | 'VES';
  estado?: 'aprobado' | 'pendiente' | 'rechazado';
  comprobante_url?: string;
  created_at?: string;
}

export interface DailyPayment {
  id?: number;
  fecha: string;
  hora: string;
  agencia: string;
  cajero_id?: string | number;
  nombre_cajero?: string;
  ticket_nro: string;
  monto: number;
  moneda: 'USD' | 'VES';
  metodo_pago: 'Efectivo' | 'Transferencia' | 'Punto de Venta';
  concepto?: string;
  qr_token: string;
  estado?: 'pagado' | 'anulado' | 'cobrado';
  cobrado_por?: string;
  fecha_cobro?: string;
  created_at?: string;
}

export interface BankPayment {
  id?: number;
  fecha: string;
  hora: string;
  agencia: string;
  cajero_id?: string | number;
  nombre_cajero?: string;
  banco_origen: string;
  banco_destino: string;
  referencia: string;
  monto: number;
  moneda: 'USD' | 'VES';
  tipo?: 'deposito' | 'transferencia' | 'pago_movil';
  confirmado: boolean;
  rechazado?: boolean;
  motivo_rechazo?: string;
  rechazado_por?: string;
  fecha_confirmacion?: string;
  captura_url?: string;
  created_at?: string;
}

export interface CashClosure {
  id?: number;
  fecha: string;
  nombre_agency: string;
  cajero_id?: string | number;
  nombre_cajero?: string;
  saldo_inicial: number;
  total_ventas: number;
  total_premios: number;
  total_gastos: number;
  total_banco: number;
  total_efectivo: number;
  saldo_restante: number;
  sobrante_faltante?: number;
  cerrado: boolean;
  observaciones?: string;
  created_at?: string;
}

export interface BankAccount {
  id: number;
  banco: string;
  numero_cuenta: string;
  titular: string;
  documento: string;
  tipo?: string;
  activa: boolean;
}

export interface ThermalReceiptData {
  titulo: string;
  agencia: string;
  terminal?: string;
  cajero: string;
  ticketNro: string;
  fecha: string;
  hora: string;
  monto: number;
  moneda: 'USD' | 'VES';
  metodoPago: string;
  concepto: string;
  qrPayload: string;
}
