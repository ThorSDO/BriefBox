import React, { useEffect, useState } from 'react';
import {
  X,
  Bell,
  Volume2,
  Monitor,
  Send,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettings,
  playNotificationChime,
  sendExternalWebhookNotification,
  showDesktopNotification,
} from '../lib/notifications';

interface NotificationSettingsModalProps {
  onClose: () => void;
  onSettingsUpdated?: (settings: NotificationSettings) => void;
}

export const NotificationSettingsModal: React.FC<
  NotificationSettingsModalProps
> = ({ onClose, onSettingsUpdated }) => {
  const [settings, setSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [permissionState, setPermissionState] = useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'notifications'));
        if (active && snap.exists()) {
          setSettings({
            ...DEFAULT_NOTIFICATION_SETTINGS,
            ...(snap.data() as Partial<NotificationSettings>),
          });
        }
      } catch {
        // ignore load error
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleRequestDesktopPermission = async () => {
    if (typeof Notification === 'undefined') {
      setErrorMsg('เบราว์เซอร์นี้ไม่รองรับ Desktop Notification');
      return;
    }
    const perm = await Notification.requestPermission();
    setPermissionState(perm);
    if (perm === 'granted') {
      showDesktopNotification(
        'BriefBox Studio — เปิดแจ้งเตือนสำเร็จ',
        'ระบบจะเด้งแจ้งเตือนทันทีเมื่อลูกค้าสั่งงานหรือส่งข้อความเข้ามา'
      );
      setStatusMsg('เปิดใช้งาน Desktop Notification เรียบร้อยแล้ว');
    } else {
      setErrorMsg('เบราว์เซอร์ปฏิเสธสิทธิ์แจ้งเตือน กรุณาอนุญาตที่ไอคอนข้างแถบ URL');
    }
  };

  const handleTestSoundAndDesktop = () => {
    setErrorMsg('');
    playNotificationChime();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      showDesktopNotification(
        '🔔 ทดสอบแจ้งเตือน BriefBox',
        'ตัวอย่างการแจ้งเตือนเมื่อมีลูกค้าสั่งงาน Artwork ใหม่!'
      );
      setStatusMsg('เล่นเสียงแจ้งเตือนและส่งป๊อปอัปบนหน้าจอเรียบร้อย');
    } else {
      setStatusMsg('เล่นเสียงแจ้งเตือนเรียบร้อย (ยังไม่ได้เปิดสิทธิ์ Desktop Notification)');
    }
  };

  const handleTestWebhook = async () => {
    setErrorMsg('');
    setStatusMsg('');
    if (
      (!settings.telegramBotToken.trim() || !settings.telegramChatId.trim()) &&
      !settings.discordWebhookUrl.trim()
    ) {
      setErrorMsg('กรุณากรอกข้อมูล Telegram Bot หรือ Discord Webhook ก่อนทดสอบ');
      return;
    }
    setTestingWebhook(true);
    try {
      const res = await sendExternalWebhookNotification(
        '🎨 [BriefBox Studio] ทดสอบการแจ้งเตือนสำเร็จ! ระบบพร้อมแจ้งเตือนทันทีเมื่อลูกค้าสั่งงาน Artwork ใหม่เข้ามา',
        settings
      );
      if (res.telegramSent || res.discordSent) {
        setStatusMsg(
          `ส่งทดสอบสำเร็จ (${[
            res.telegramSent ? 'Telegram' : '',
            res.discordSent ? 'Discord' : '',
          ]
            .filter(Boolean)
            .join(' & ')})`
        );
      } else {
        setErrorMsg('ส่งแจ้งเตือนไม่สำเร็จ กรุณาตรวจสอบ Bot Token / Chat ID / Webhook URL');
      }
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    setSaving(true);
    try {
      const payload: NotificationSettings = {
        enableSound: settings.enableSound,
        enableDesktop: settings.enableDesktop,
        telegramBotToken: settings.telegramBotToken.trim(),
        telegramChatId: settings.telegramChatId.trim(),
        discordWebhookUrl: settings.discordWebhookUrl.trim(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'settings', 'notifications'), payload);
      onSettingsUpdated?.(payload);
      setStatusMsg('บันทึกการตั้งค่าแจ้งเตือนเรียบร้อยแล้ว');
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'บันทึกการตั้งค่าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3 backdrop-blur-xs sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Bell className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-extrabold">
                ตั้งค่าการแจ้งเตือนนักออกแบบ
              </h2>
              <p className="text-xs text-indigo-100">
                รับแจ้งเตือนทันทีเมื่อลูกค้าสั่งงานใหม่ แนบสลิป หรือขอแก้ไขงาน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 space-y-5 overflow-y-auto p-6">
          {loading && (
            <p className="text-xs text-slate-500">กำลังโหลดการตั้งค่า...</p>
          )}

          {statusMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Browser Sound & Desktop Alerts */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">
              1. แจ้งเตือนบนคอมพิวเตอร์ (ระหว่างเปิดหน้าเว็บทิ้งไว้)
            </h3>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Volume2 className="h-4 w-4 text-indigo-600" />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    เปิดเสียงแจ้งเตือน (Sound Alert)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    ส่งเสียงกระดิ่งอัตโนมัติเมื่อมีออเดอร์หรือข้อความใหม่
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.enableSound}
                onChange={(e) =>
                  setSettings({ ...settings, enableSound: e.target.checked })
                }
                className="h-4 w-4 accent-indigo-600"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Monitor className="h-4 w-4 text-violet-600" />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    แจ้งเตือนเด้งมุมจอ (Desktop Push Notification)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    สถานะสิทธิ์เบราว์เซอร์:{' '}
                    <strong>
                      {permissionState === 'granted'
                        ? 'อนุญาตแล้ว ✓'
                        : permissionState === 'denied'
                          ? 'ถูกบล็อก (ต้องปลดล็อกที่แถบ URL)'
                          : 'ยังไม่ได้ขอสิทธิ์'}
                    </strong>
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.enableDesktop}
                onChange={(e) =>
                  setSettings({ ...settings, enableDesktop: e.target.checked })
                }
                className="h-4 w-4 accent-indigo-600"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {permissionState !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestDesktopPermission}
                  className="rounded-xl border border-indigo-300 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                >
                  ขอสิทธิ์เปิดแจ้งเตือนบนเบราว์เซอร์
                </button>
              )}
              <button
                type="button"
                onClick={handleTestSoundAndDesktop}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                🔊 ทดสอบเสียง & ป๊อปอัปบนจอ
              </button>
            </div>
          </div>

          {/* Telegram & Discord Webhooks */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-sky-500" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                2. แจ้งเตือนเข้ามือถือ / แชท (แม้ปิดหน้าเว็บไปแล้ว)
              </h3>
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-[11px] leading-relaxed text-sky-900">
              <strong>วิธีตั้งค่า Telegram ฟรีใน 1 นาที:</strong>
              <br />
              1. ทักแชท <strong>@BotFather</strong> ใน Telegram แล้วพิมพ์{' '}
              <code>/newbot</code> เพื่อรับ <strong>Bot Token</strong>
              <br />
              2. ทักแชท <strong>@userinfobot</strong> เพื่อดูเลข{' '}
              <strong>Chat ID</strong> ของคุณ (และอย่าลืมกดปุ่ม Start ในบอทของคุณเอง 1 ครั้ง)
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Telegram Bot Token
                </label>
                <input
                  type="text"
                  value={settings.telegramBotToken}
                  onChange={(e) =>
                    setSettings({ ...settings, telegramBotToken: e.target.value })
                  }
                  placeholder="123456789:AAH..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Telegram Chat ID
                </label>
                <input
                  type="text"
                  value={settings.telegramChatId}
                  onChange={(e) =>
                    setSettings({ ...settings, telegramChatId: e.target.value })
                  }
                  placeholder="เช่น 987654321"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Discord Webhook URL (ทางเลือกเพิ่มเติม)
              </label>
              <input
                type="url"
                value={settings.discordWebhookUrl}
                onChange={(e) =>
                  setSettings({ ...settings, discordWebhookUrl: e.target.value })
                }
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="button"
              disabled={testingWebhook}
              onClick={handleTestWebhook}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>
                {testingWebhook
                  ? 'กำลังส่งทดสอบ...'
                  : '📨 ทดสอบส่งแจ้งเตือนเข้า Telegram / Discord'}
              </span>
            </button>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            ปิดหน้าต่าง
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </button>
        </div>
      </div>
    </div>
  );
};
