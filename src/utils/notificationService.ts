/**
 * Service for Native Web Audio synthesis and Browser Push / Desktop Notifications
 * Operates without external mp3 files or third-party servers.
 */

class NotificationSoundService {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
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
   * Synthesize pleasant chimes for different system events
   */
  public playSound(type: 'new_payment' | 'confirmed' | 'rejected' | 'alert') {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (type === 'new_payment') {
        // Doble tono tipo campanilla (Ding-Dong)
        this.playTone(ctx, 587.33, now, 0.15, 'sine'); // D5
        this.playTone(ctx, 880.00, now + 0.12, 0.35, 'sine'); // A5
      } else if (type === 'confirmed') {
        // Tono triunfal ascendente suave (Éxito / Aprobado)
        this.playTone(ctx, 523.25, now, 0.1, 'triangle'); // C5
        this.playTone(ctx, 659.25, now + 0.08, 0.12, 'triangle'); // E5
        this.playTone(ctx, 783.99, now + 0.16, 0.15, 'triangle'); // G5
        this.playTone(ctx, 1046.50, now + 0.24, 0.4, 'sine'); // C6
      } else if (type === 'rejected') {
        // Tono grave doble de advertencia
        this.playTone(ctx, 330, now, 0.15, 'sawtooth', 0.15);
        this.playTone(ctx, 220, now + 0.14, 0.3, 'sawtooth', 0.2);
      } else {
        // Alerta general corta
        this.playTone(ctx, 800, now, 0.2, 'sine');
      }
    } catch (e) {
      console.warn('Audio notification could not be played:', e);
    }
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = 'sine',
    maxVol: number = 0.25
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(maxVol, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  /**
   * Check if the browser supports notifications and if permission is granted
   */
  public isNotificationSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!this.isNotificationSupported()) return 'unsupported';
    return Notification.permission;
  }

  /**
   * Request permission for desktop push notifications
   */
  public async requestPermission(): Promise<boolean> {
    if (!this.isNotificationSupported()) return false;
    try {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      return false;
    }
  }

  /**
   * Trigger a desktop notification with optional sound
   */
  public showNotification(
    title: string,
    options?: {
      body?: string;
      icon?: string;
      tag?: string;
      soundType?: 'new_payment' | 'confirmed' | 'rejected' | 'alert';
      onClick?: () => void;
    }
  ) {
    // 1. Reproducir sonido asociado si se solicita
    if (options?.soundType) {
      this.playSound(options.soundType);
    }

    // 2. Disparar notificación push del sistema si está autorizado
    if (this.isNotificationSupported() && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: options?.body,
          icon: options?.icon || '/favicon.png',
          tag: options?.tag,
        });

        notif.onclick = () => {
          window.focus();
          if (options?.onClick) {
            options.onClick();
          }
          notif.close();
        };
      } catch (err) {
        console.warn('Could not spawn desktop notification:', err);
      }
    }
  }
}

export const notificationService = new NotificationSoundService();
