import { supabase } from '../lib/supabase';

export type RealtimeEventType =
  | 'NEW_BANK_PAYMENT'
  | 'NEW_CASH_PAYMENT'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_REJECTED'
  | 'NEW_EXPENSE'
  | 'DATA_CHANGED';

export interface RealtimePayload {
  id?: number | string;
  tabla?: string;
  agencia?: string;
  monto?: number;
  moneda?: string;
  referencia?: string;
  metodo_pago?: string;
  pagador?: string;
  concepto?: string;
  confirmado_por?: string;
  rechazado_por?: string;
  motivo_rechazo?: string;
  cajero_id?: string;
  created_at?: string;
  timestamp?: number;
  [key: string]: any;
}

type EventCallback = (payload: RealtimePayload) => void;

class RealtimeBroadcastService {
  private channel: any = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private isSubscribed: boolean = false;
  private pendingBroadcastQueue: Array<{ type: RealtimeEventType; data: RealtimePayload }> = [];

  constructor() {
    this.initChannel();
  }

  private initChannel() {
    if (typeof window === 'undefined') return;

    try {
      this.channel = supabase.channel('multibanca_global_sync', {
        config: {
          broadcast: { self: false },
        },
      });

      this.channel
        .on(
          'broadcast',
          { event: 'GLOBAL_EVENT' },
          (envelope: { payload: { type: RealtimeEventType; data: RealtimePayload } }) => {
            const { type, data } = envelope.payload || {};
            if (!type) return;

            console.log(`[Realtime Socket Received]: ${type}`, data);

            const set = this.listeners.get(type);
            if (set) {
              set.forEach((cb) => {
                try {
                  cb(data);
                } catch (err) {
                  console.error(`[Realtime Socket] Error in listener for ${type}:`, err);
                }
              });
            }

            // Wildcard listener
            const allSet = this.listeners.get('*');
            if (allSet) {
              allSet.forEach((cb) => {
                try {
                  cb({ ...data, _type: type });
                } catch (err) {
                  console.error('[Realtime Socket] Error in wildcard listener:', err);
                }
              });
            }
          }
        )
        .subscribe((status: string) => {
          console.log('[Realtime Socket Status]:', status);
          this.isSubscribed = status === 'SUBSCRIBED';

          if (this.isSubscribed && this.pendingBroadcastQueue.length > 0) {
            const queue = [...this.pendingBroadcastQueue];
            this.pendingBroadcastQueue = [];
            queue.forEach((item) => this.broadcast(item.type, item.data));
          }
        });
    } catch (e) {
      console.warn('[Realtime Socket] Failed to initialize channel:', e);
    }
  }

  /**
   * Subscribe to a specific socket broadcast event
   */
  public subscribe(eventType: RealtimeEventType | '*', callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Broadcast an event to all connected clients over WebSockets
   */
  public async broadcast(type: RealtimeEventType, data: RealtimePayload) {
    try {
      if (!this.channel) {
        this.initChannel();
      }

      if (!this.isSubscribed) {
        this.pendingBroadcastQueue.push({ type, data });
      }

      const res = await this.channel.send({
        type: 'broadcast',
        event: 'GLOBAL_EVENT',
        payload: {
          type,
          data: {
            ...data,
            timestamp: Date.now(),
          },
        },
      });

      console.log(`[Realtime Socket Sent]: ${type}`, data, res);
    } catch (err) {
      console.warn(`[Realtime Socket] Failed to broadcast ${type}:`, err);
    }
  }
}

export const realtimeBroadcast = new RealtimeBroadcastService();
