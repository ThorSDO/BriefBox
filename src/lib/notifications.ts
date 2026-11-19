import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface NotificationSettings {
  enableSound: boolean;
  enableDesktop: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  discordWebhookUrl: string;
  updatedAt: string;
}

export interface AppNotificationItem {
  id: string;
  orderId: string;
  orderNumber: string;
  type: 'new_order' | 'payment_slip' | 'revision' | 'approved' | 'comment';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enableSound: true,
  enableDesktop: true,
  telegramBotToken: '',
  telegramChatId: '',
  discordWebhookUrl: '',
  updatedAt: '',
};

export function playNotificationChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Two-tone pleasant chime (C6 -> E6)
    const tones = [
      { freq: 1046.5, start: 0, duration: 0.16 },
      { freq: 1318.5, start: 0.14, duration: 0.28 },
    ];

    tones.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.02);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 800);
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

export function showDesktopNotification(title: string, body: string): void {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        tag: `briefbox-${Date.now()}`,
      });
    }
  } catch {
    // Ignore browser notification errors
  }
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'notifications'));
    if (snap.exists()) {
      return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(snap.data() as Partial<NotificationSettings>),
      };
    }
  } catch {
    // Ignore read errors
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

export async function sendExternalWebhookNotification(
  eventText: string,
  overrideSettings?: NotificationSettings
): Promise<{ telegramSent: boolean; discordSent: boolean }> {
  const result = { telegramSent: false, discordSent: false };
  try {
    const settings = overrideSettings || (await getNotificationSettings());

    const token = settings.telegramBotToken?.trim();
    const chatId = settings.telegramChatId?.trim();
    if (token && chatId) {
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: eventText,
            }),
          }
        );
        if (res.ok) result.telegramSent = true;
      } catch {
        // Never block caller on webhook error
      }
    }

    const discordUrl = settings.discordWebhookUrl?.trim();
    if (discordUrl) {
      try {
        const res = await fetch(discordUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: eventText }),
        });
        if (res.ok) result.discordSent = true;
      } catch {
        // Never block caller on webhook error
      }
    }
  } catch {
    // Never block customer actions on notification failures
  }
  return result;
}
