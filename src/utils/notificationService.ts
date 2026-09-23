/**
 * Advanced Multi-Channel Notification Service for Taquilla POS
 * - Web Audio API synthesizer for rich acoustic chimes
 * - Auto-unlock AudioContext on first user interaction
 * - Desktop / OS Push Notifications
 * - In-App Floating Toast event emitter
 * - Browser Tab Title Blinking & Favicon Indicator
 * - Haptic Mobile Vibration
 * - 10-second deduplication cache
 */

export interface InAppToastPayload {
  id: string;
  title: string;
  body: string;
  type: 'payment' | 'cash' | 'success' | 'warning' | 'info';
  timestamp: number;
  data?: any;
}

type ToastListener = (toast: InAppToastPayload) => void;

class NotificationSoundService {
  private audioCtx: AudioContext | null = null;
  private isAudioUnlocked = false;
  private recentNotifications = new Map<string, number>();
  private titleBlinkInterval: any = null;
  private originalDocumentTitle: string = '';
  private toastListeners: Set<ToastListener> = new Set();

  constructor() {
    this.initAudioUnlockListeners();
  }

  /**
   * Automatically unlock AudioContext on the first user interaction
   */
  private initAudioUnlockListeners() {
    if (typeof window === 'undefined') return;

    this.originalDocumentTitle = typeof document !== 'undefined' ? document.title : '';

    const unlock = () => {
      this.unlockAudioContext();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });

    // Window focus listener to stop title blinking
    window.addEventListener('focus', () => {
      this.stopTitleBlink();
    });
  }

  /**
   * Explicitly create and resume the AudioContext
   */
  public async unlockAudioContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;

    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }

      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      if (this.audioCtx && this.audioCtx.state === 'running') {
        this.isAudioUnlocked = true;
      }
    } catch (e) {
      console.warn('[NotificationService] Audio unlock warning:', e);
    }

    return this.audioCtx;
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Synthesize crisp, pleasant, and audible acoustic chimes
   */
  public async playSound(type: 'new_payment' | 'confirmed' | 'rejected' | 'alert') {
    try {
      const ctx = (await this.unlockAudioContext()) || this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (type === 'new_payment') {
        // Doble campanilla brillante tipo cajero / banco (Ding - Dong resonante)
        this.playBellTone(ctx, 784, now, 0.45, 0.45); // G5
        this.playBellTone(ctx, 1175, now + 0.14, 0.65, 0.55); // D6
      } else if (type === 'confirmed') {
        // Melodía triunfal ascendente suave (Do - Mi - Sol - Do)
        this.playTone(ctx, 523.25, now, 0.12, 'sine', 0.35); // C5
        this.playTone(ctx, 659.25, now + 0.09, 0.14, 'sine', 0.38); // E5
        this.playTone(ctx, 783.99, now + 0.18, 0.16, 'sine', 0.42); // G5
        this.playBellTone(ctx, 1046.50, now + 0.27, 0.55, 0.5); // C6
      } else if (type === 'rejected') {
        // Tono grave doble de advertencia
        this.playTone(ctx, 330, now, 0.16, 'sawtooth', 0.25);
        this.playTone(ctx, 220, now + 0.15, 0.32, 'sawtooth', 0.3);
      } else {
        // Alerta general viva
        this.playBellTone(ctx, 880, now, 0.35, 0.4);
      }
    } catch (e) {
      console.warn('[NotificationService] Audio playback warning:', e);
    }
  }

  /**
   * Bell chime with rich harmonics and exponential decay
   */
  private playBellTone(ctx: AudioContext, freq: number, startTime: number, duration: number, maxVol: number = 0.4) {
    // Fundamental tone
    this.playTone(ctx, freq, startTime, duration, 'sine', maxVol);
    // Harmonic overtone for brilliance
    this.playTone(ctx, freq * 2, startTime, duration * 0.7, 'triangle', maxVol * 0.35);
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = 'sine',
    maxVol: number = 0.3
  ) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(maxVol, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {
      console.warn('[NotificationService] Tone generator error:', e);
    }
  }

  /**
   * Haptic vibration for mobile / tablet devices
   */
  public triggerVibrate(pattern: number[] = [200, 100, 200]) {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  }

  /**
   * Blink browser tab title when notification arrives
   */
  public startTitleBlink(message: string = '🔔 ¡CONFIRMACIÓN RECIBIDA!') {
    if (typeof document === 'undefined') return;

    if (!this.originalDocumentTitle) {
      this.originalDocumentTitle = document.title || 'Multibanca Express';
    }

    if (this.titleBlinkInterval) {
      clearInterval(this.titleBlinkInterval);
    }

    let isAlt = false;
    this.titleBlinkInterval = setInterval(() => {
      document.title = isAlt ? message : this.originalDocumentTitle;
      isAlt = !isAlt;
    }, 1000);
  }

  public stopTitleBlink() {
    if (typeof document === 'undefined') return;
    if (this.titleBlinkInterval) {
      clearInterval(this.titleBlinkInterval);
      this.titleBlinkInterval = null;
    }
    if (this.originalDocumentTitle) {
      document.title = this.originalDocumentTitle;
    }
  }

  /**
   * Subscribe to in-app floating toast notifications
   */
  public onToast(listener: ToastListener) {
    this.toastListeners.add(listener);
    return () => {
      this.toastListeners.delete(listener);
    };
  }

  private emitToast(toast: InAppToastPayload) {
    this.toastListeners.forEach((listener) => {
      try {
        listener(toast);
      } catch (err) {
        console.error('[NotificationService] Error in toast listener:', err);
      }
    });
  }

  public isNotificationSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!this.isNotificationSupported()) return 'unsupported';
    return Notification.permission;
  }

  public async requestPermission(): Promise<boolean> {
    if (!this.isNotificationSupported()) return false;
    try {
      // Also unlock audio context on this click gesture
      await this.unlockAudioContext();
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    } catch (e) {
      console.error('[NotificationService] Error requesting notification permission:', e);
      return false;
    }
  }

  /**
   * Multi-Channel Notification Trigger
   */
  public showNotification(
    title: string,
    options?: {
      body?: string;
      icon?: string;
      tag?: string;
      soundType?: 'new_payment' | 'confirmed' | 'rejected' | 'alert';
      toastType?: 'payment' | 'cash' | 'success' | 'warning' | 'info';
      toastData?: any;
      onClick?: () => void;
    }
  ) {
    const dedupeKey = options?.tag || `${title}_${options?.body || ''}`;
    const now = Date.now();

    // 10-second deduplication filter
    const lastTime = this.recentNotifications.get(dedupeKey);
    if (lastTime && now - lastTime < 10000) {
      return;
    }
    this.recentNotifications.set(dedupeKey, now);

    // Clean up old dedupe keys older than 30 seconds
    if (this.recentNotifications.size > 50) {
      this.recentNotifications.forEach((ts, key) => {
        if (now - ts > 30000) this.recentNotifications.delete(key);
      });
    }

    // 1. Reproducir sonido asociado
    if (options?.soundType) {
      this.playSound(options.soundType);
    }

    // 2. Disparar vibración en dispositivos móviles
    this.triggerVibrate();

    // 3. Titilar pestaña del navegador si está desenfocada
    if (typeof document !== 'undefined' && document.hidden) {
      this.startTitleBlink(`🔔 ${title}`);
    }

    // 4. Emitir Toast flotante in-app
    this.emitToast({
      id: options?.tag || `toast_${now}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      body: options?.body || '',
      type: options?.toastType || (options?.soundType === 'confirmed' ? 'success' : 'info'),
      timestamp: now,
      data: options?.toastData,
    });

    // 5. Disparar notificación push de escritorio nativa del SO
    if (this.isNotificationSupported() && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: options?.body,
          icon: options?.icon || '/logo.svg',
          tag: dedupeKey,
          silent: true,
        });

        notif.onclick = () => {
          if (typeof window !== 'undefined') {
            window.focus();
          }
          this.stopTitleBlink();
          if (options?.onClick) {
            options.onClick();
          }
          notif.close();
        };
      } catch (err) {
        console.warn('[NotificationService] Desktop notification warning:', err);
      }
    }
  }

  /**
   * Immediate Interactive Test for Audio + Notification + In-App Toast
   */
  public async testAlerts(): Promise<boolean> {
    await this.unlockAudioContext();
    const isGranted = this.getPermissionStatus() === 'granted';

    this.showNotification('🔔 Prueba de Alertas y Sonido', {
      body: isGranted
        ? '¡Audio, notificación push y avisos en vivo funcionando correctamente!'
        : 'Audio activado. Concede permisos de notificación para avisos en segundo plano.',
      soundType: 'confirmed',
      toastType: 'success',
      tag: `test_alert_${Date.now()}`,
    });

    return true;
  }
}

export const notificationService = new NotificationSoundService();
