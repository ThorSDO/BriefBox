import React, { useState, useRef, useEffect } from 'react';
import {
  Palette,
  LogOut,
  Plus,
  ShieldCheck,
  User as UserIcon,
  Sun,
  Moon,
  Bell,
  Settings,
  CheckCheck,
} from 'lucide-react';
import { UserProfile } from '../types/briefbox';
import { AppNotificationItem } from '../lib/notifications';

interface NavbarProps {
  profile: UserProfile;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenNewBrief: () => void;
  onSignOut: () => void;
  notifications: AppNotificationItem[];
  onSelectNotification: (item: AppNotificationItem) => void;
  onMarkAllNotificationsRead: () => void;
  onOpenNotificationSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  theme,
  onToggleTheme,
  onOpenNewBrief,
  onSignOut,
  notifications,
  onSelectNotification,
  onMarkAllNotificationsRead,
  onOpenNotificationSettings,
}) => {
  const isAdmin = profile.role === 'admin';
  const isDesigner = profile.role === 'designer';
  const isStaff = isAdmin || isDesigner;
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                BriefBox
              </span>
              <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                Artwork Studio
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isAdmin
                ? 'ศูนย์บริหารคิวงานกราฟิก & แจ้งเตือนคำสั่งงานลูกค้า'
                : isDesigner
                  ? 'พื้นที่ทำงานดีไซเนอร์: รับงาน ส่งดราฟต์ และตอบแชตลูกค้า'
                  : 'ระบบสั่งงาน ตรวจดราฟต์ และติดตามคิว Artwork'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            title={
              theme === 'dark'
                ? 'เปลี่ยนเป็นโหมดสว่าง'
                : 'เปลี่ยนเป็นโหมดมืดถนอมสายตา'
            }
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span>โหมดสว่าง</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-indigo-600" />
                <span>โหมดมืด</span>
              </>
            )}
          </button>

          {isStaff && (
            <>
              {/* Notification Bell Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setNotifOpen((prev) => !prev)}
                  className="relative inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  title="ศูนย์แจ้งเตือนคำสั่งงานลูกค้า"
                >
                  <Bell className="h-4 w-4 text-indigo-500" />
                  <span className="hidden sm:inline">แจ้งเตือน</span>
                  {unreadCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-extrabold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl z-50">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <h3 className="text-xs font-extrabold text-slate-900">
                          การแจ้งเตือนนักออกแบบ
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          อัปเดตสดเมื่อลูกค้าสั่งงาน แนบสลิป หรือขอแก้ไข
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={onMarkAllNotificationsRead}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200/70"
                          >
                            <CheckCheck className="h-3 w-3" />
                            อ่านหมด
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            onOpenNotificationSettings();
                          }}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                          title="ตั้งค่าเสียง / Desktop / Telegram"
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-slate-500">
                          ยังไม่มีแจ้งเตือนใหม่ในเซสชันนี้
                          <br />
                          <span className="text-[11px] opacity-80">
                            เมื่อลูกค้าส่งบรีฟหรือแก้ไขงานจะเด้งแจ้งเตือนทันที
                          </span>
                        </div>
                      ) : (
                        notifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setNotifOpen(false);
                              onSelectNotification(item);
                            }}
                            className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-slate-50 ${
                              !item.read ? 'bg-indigo-50/40' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {!item.read && (
                                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-rose-500" />
                                )}
                                {item.title}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {new Date(item.createdAt).toLocaleTimeString(
                                  'th-TH',
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 line-clamp-2">
                              {item.message}
                            </p>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          onOpenNotificationSettings();
                        }}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span>ตั้งค่าแจ้งเตือน (เสียง / Desktop / Telegram)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={onOpenNotificationSettings}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
                  title="ตั้งค่าแจ้งเตือนนักออกแบบ"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">ตั้งค่าแจ้งเตือน</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onOpenNewBrief}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>สั่งงาน Artwork ใหม่</span>
          </button>

          <div className="hidden h-6 w-px bg-slate-200 sm:block" />

          {/* User Profile Pill */}
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 py-1.5 pl-2.5 pr-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                isAdmin
                  ? 'bg-violet-600 text-white'
                  : isDesigner
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {isAdmin ? (
                <ShieldCheck className="h-4 w-4" />
              ) : isDesigner ? (
                <Palette className="h-4 w-4" />
              ) : (
                <UserIcon className="h-4 w-4" />
              )}
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="max-w-[120px] truncate text-xs font-bold text-slate-800">
                  {profile.displayName}
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                    isAdmin
                      ? 'bg-violet-100 text-violet-700'
                      : isDesigner
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-sky-100 text-sky-700'
                  }`}
                >
                  {isAdmin ? 'แอดมิน (เจ้าของ)' : isDesigner ? 'ดีไซเนอร์' : 'ลูกค้า'}
                </span>
              </div>
              <p className="max-w-[140px] truncate text-[11px] text-slate-500">
                {profile.brandName || profile.email}
              </p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="ml-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              title="ออกจากระบบ"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
