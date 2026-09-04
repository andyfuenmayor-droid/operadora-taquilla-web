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
  cuentas_asignadas?: string | string[];
  sistemas?: string; // Comma-separated list of assigned systems (e.g. "BETM3,PARLEY,LOTERIAS")
  monedas?: string;  // Comma-separated list of assigned currencies (e.g. "BS,USD,COP")
  telefono?: string;
  telefono_whatsapp?: string;
  user_id?: string | number;
  saldo_actual?: number;
  activo?: boolean;
}

export interface SystemCycle {
  desde: string;
  hasta: string;
  tipo: string;
  semana: string;
}

export interface DailySale {
  id?: number;
  fecha: string;
  agencia?: string;
  nombre_agency?: string;
  cajero_id?: string | number;
  nombre_cajero?: string;
  sistema: string;
  monto_venta?: number;
  monto_ventas?: number;
  comision?: number;
  monto_anulaciones?: number;
  monto_premios?: number;
  neto?: number;
  monto_neto?: number;
  moneda?: string;
  user_id?: string | number;
  cerrado?: boolean;
  created_at?: string;
}

export interface AwardedTicket {
  id?: number;
  fecha: string;
  agencia: string;
  nombre_agency?: string;
  cajero_id?: string | number;
  user_id?: string | number;
  sistema: string;
  numero_ticket: string;
  monto: number;
  moneda?: string;
  estado?: string;
  created_at?: string;
}

export interface DailyExpense {
  id?: number;
  fecha: string;
  agencia?: string;
  nombre_agency?: string;
  cajero_id?: string | number;
  nombre_cajero?: string;
  user_id?: string | number;
  concepto: string;
  categoria?: string;
  monto: number;
  moneda: string;
  estado?: 'aprobado' | 'pendiente' | 'rechazado';
  confirmado?: boolean;
  rechazado?: boolean;
  motivo_rechazo?: string;
  comprobante_url?: string;
  created_at?: string;
}

export interface DailyPayment {
  id?: number;
  fecha: string;
  hora?: string;
  agencia?: string;
  nombre_agency?: string;
  cajero_id?: string | number;
  nombre_cajero?: string;
  user_id?: string | number;
  ticket_nro?: string;
  monto: number;
  moneda: string;
  tipo_pago?: string;
  metodo_pago?: string;
  concepto?: string;
  qr_token?: string;
  pin_6?: string;
  confirmado?: boolean;
  confirmado_supervisor?: boolean;
  rechazado?: boolean;
  estado?: 'pagado' | 'anulado' | 'cobrado';
  cobrado_por?: string;
  fecha_cobro?: string;
  created_at?: string;
}

export interface BankPayment {
  id?: number;
  fecha: string;
  hora?: string;
  agencia?: string;
  nombre_agency?: string;
  cajero_id?: string | number;
  nombre_cajero?: string;
  user_id?: string | number;
  banco_origen: string;
  banco_destino: string;
  referencia: string;
  monto: number;
  moneda: string;
  metodo_pago?: string;
  tipo?: string;
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
  documento?: string;
  tipo_cuenta?: string;
  moneda?: string;
  agencia_asignada?: string;
  saldo_inicial?: number;
  estatus?: string;
  activa?: boolean;
}

export interface PaymentDevice {
  id: number;
  alias_nombre: string;
  tipo_dispositivo: string;
  serial_tid: string;
  cuenta_asociada?: string;
  agencia_asignada?: string;
  moneda?: string;
  estatus?: string;
  notas?: string;
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
  moneda: string;
  metodoPago: string;
  concepto: string;
  qrPayload: string;
}
