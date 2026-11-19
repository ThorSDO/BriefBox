import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  LayoutGrid,
  Columns3,
  Clock,
  CheckCircle2,
  AlertCircle,
  Palette,
  Calendar,
  FileImage,
  MessageSquare,
  Plus,
  Filter,
  Building2,
  Users,
  X,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import {
  AppNotificationItem,
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettings,
  playNotificationChime,
  showDesktopNotification,
} from './lib/notifications';
import { AuthScreen } from './components/AuthScreen';
import { Navbar } from './components/Navbar';
import { NewBriefModal } from './components/NewBriefModal';
import { OrderDetailModal } from './components/OrderDetailModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import {
  ArtworkOrder,
  ORDER_STATUS_META,
  OrderStatus,
  URGENCY_META,
  UserProfile,
} from './types/briefbox';

const DESIGNATED_ADMIN_EMAILS = [
  'admin@briefbox.demo',
  'hellbluesboysdo@gmail.com',
];

type ViewMode = 'kanban' | 'grid';
type StatusFilter =
  | 'all'
  | 'quote_pay'
  | 'in_progress'
  | 'review'
  | 'revision'
  | 'completed';

const KANBAN_COLUMNS: {
  id: string;
  title: string;
  statuses: OrderStatus[];
  accent: string;
}[] = [
  {
    id: 'col-quote',
    title: 'รอประเมิน / รอชำระ',
    statuses: ['pending_quote', 'quoted'],
    accent: 'border-t-amber-500',
  },
  {
    id: 'col-design',
    title: 'คิวงาน / กำลังออกแบบ',
    statuses: ['in_queue', 'designing'],
    accent: 'border-t-indigo-500',
  },
  {
    id: 'col-review',
    title: 'รอตรวจ / แก้ไข Revision',
    statuses: ['review', 'revision'],
    accent: 'border-t-violet-500',
  },
  {
    id: 'col-done',
    title: 'เสร็จสมบูรณ์',
    statuses: ['completed'],
    accent: 'border-t-emerald-500',
  },
];

export function App() {
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<ArtworkOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [firestoreError, setFirestoreError] = useState('');

  // UI state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('briefbox-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [showNewBrief, setShowNewBrief] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState('');

  const notifSettingsRef = useRef<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS
  );
  useEffect(() => {
    notifSettingsRef.current = notifSettings;
  }, [notifSettings]);

  // Sync theme class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem('briefbox-theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Observe Firebase Auth state + real-time user profile listener
  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanupUserListener = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }
    };

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      cleanupUserListener();

      if (!fbUser) {
        setProfile(null);
        setOrders([]);
        setAuthReady(true);
        return;
      }

      const userRef = doc(db, 'users', fbUser.uid);
      unsubUserDoc = onSnapshot(
        userRef,
        (snap) => {
          // Wait for server acknowledgement so role changes commit before opening admin queries
          if (snap.metadata.hasPendingWrites) {
            return;
          }

          if (snap.exists()) {
            if (fallbackTimer) {
              clearTimeout(fallbackTimer);
              fallbackTimer = null;
            }
            setProfile(snap.data() as UserProfile);
            setAuthReady(true);
          } else if (!fallbackTimer) {
            // Wait briefly so AuthScreen's upsertProfile finishes without racing
            fallbackTimer = setTimeout(async () => {
              fallbackTimer = null;
              try {
                const isDesignatedAdmin = DESIGNATED_ADMIN_EMAILS.includes(
                  (fbUser.email || '').toLowerCase()
                );
                const fallback: UserProfile = {
                  uid: fbUser.uid,
                  email: fbUser.email || '',
                  displayName: isDesignatedAdmin
                    ? 'นักออกแบบ BriefBox Studio'
                    : fbUser.displayName || fbUser.email?.split('@')[0] || 'ผู้ใช้งาน',
                  brandName: isDesignatedAdmin ? 'BriefBox Studio' : 'My Brand',
                  contactInfo: '',
                  role: isDesignatedAdmin ? 'admin' : 'customer',
                  createdAt: new Date().toISOString(),
                };
                await setDoc(userRef, fallback);
              } catch (err: unknown) {
                setFirestoreError(
                  (err as Error)?.message || 'ไม่สามารถสร้างข้อมูลโปรไฟล์ผู้ใช้ได้'
                );
                setAuthReady(true);
              }
            }, 1500);
          }
        },
        (err) => {
          setFirestoreError(err.message || 'ไม่สามารถเชื่อมต่อฐานข้อมูลผู้ใช้ได้');
          setAuthReady(true);
        }
      );
    });

    return () => {
      cleanupUserListener();
      unsubAuth();
    };
  }, []);

  // Real-time Firestore listener for orders + Admin notification detection
  useEffect(() => {
    if (!profile) return;

    let unsub: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let attempts = 0;
    let initialLoaded = false;
    const prevOrdersMap = new Map<string, ArtworkOrder>();

    setOrdersLoading(true);
    setFirestoreError('');

    const ordersCol = collection(db, 'orders');
    const q =
      profile.role === 'admin'
        ? query(ordersCol)
        : query(ordersCol, where('customerId', '==', profile.uid));

    const emitAdminNotifications = (items: AppNotificationItem[]) => {
      if (items.length === 0) return;
      setNotifications((prev) => [...items, ...prev].slice(0, 30));
      const latest = items[0];
      showNotice(`${latest.title} — ${latest.message}`);
      const cfg = notifSettingsRef.current;
      if (cfg.enableSound) {
        playNotificationChime();
      }
      if (cfg.enableDesktop) {
        showDesktopNotification(latest.title, latest.message);
      }
    };

    const subscribe = () => {
      if (cancelled) return;
      if (unsub) {
        unsub();
        unsub = null;
      }

      unsub = onSnapshot(
        q,
        (snapshot) => {
          if (cancelled) return;
          attempts = 0;
          setFirestoreError('');

          const loaded: ArtworkOrder[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ArtworkOrder, 'id'>),
          }));

          if (profile.role === 'admin') {
            if (!initialLoaded) {
              loaded.forEach((o) => prevOrdersMap.set(o.id, o));
              initialLoaded = true;
            } else {
              const detected: AppNotificationItem[] = [];
              snapshot.docChanges().forEach((change) => {
                const order = {
                  id: change.doc.id,
                  ...(change.doc.data() as Omit<ArtworkOrder, 'id'>),
                };
                const prev = prevOrdersMap.get(order.id);
                const nowIso = new Date().toISOString();

                if (change.type === 'added' && !prev) {
                  detected.push({
                    id: `notif-${order.id}-${Date.now()}`,
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    type: 'new_order',
                    title: `🎨 ออเดอร์ใหม่ ${order.orderNumber}`,
                    message: `${order.title} • โดย ${order.customerBrand || order.customerName}`,
                    createdAt: nowIso,
                    read: false,
                  });
                } else if (change.type === 'modified' && prev) {
                  if (
                    prev.paymentStatus !== 'pending_verification' &&
                    order.paymentStatus === 'pending_verification'
                  ) {
                    detected.push({
                      id: `notif-slip-${order.id}-${Date.now()}`,
                      orderId: order.id,
                      orderNumber: order.orderNumber,
                      type: 'payment_slip',
                      title: `💳 ลูกค้าแนบสลิป ${order.orderNumber}`,
                      message: `${order.customerBrand || order.customerName} แจ้งชำระเงินสำหรับ "${order.title}"`,
                      createdAt: nowIso,
                      read: false,
                    });
                  } else if (prev.status !== 'revision' && order.status === 'revision') {
                    detected.push({
                      id: `notif-rev-${order.id}-${Date.now()}`,
                      orderId: order.id,
                      orderNumber: order.orderNumber,
                      type: 'revision',
                      title: `✏️ ขอแก้ไขงาน ${order.orderNumber}`,
                      message: `${order.customerBrand || order.customerName} ขอแก้ไขรอบที่ ${order.usedRevisions} • "${order.title}"`,
                      createdAt: nowIso,
                      read: false,
                    });
                  } else if (
                    prev.status !== 'completed' &&
                    order.status === 'completed'
                  ) {
                    detected.push({
                      id: `notif-done-${order.id}-${Date.now()}`,
                      orderId: order.id,
                      orderNumber: order.orderNumber,
                      type: 'approved',
                      title: `✅ ลูกค้าอนุมัติงาน ${order.orderNumber}`,
                      message: `${order.customerBrand || order.customerName} อนุมัติ "${order.title}" เรียบร้อย`,
                      createdAt: nowIso,
                      read: false,
                    });
                  } else if (order.comments.length > prev.comments.length) {
                    const lastComment = order.comments[order.comments.length - 1];
                    if (lastComment?.authorRole === 'customer') {
                      detected.push({
                        id: `notif-msg-${order.id}-${Date.now()}`,
                        orderId: order.id,
                        orderNumber: order.orderNumber,
                        type: 'comment',
                        title: `💬 ข้อความใหม่ (${order.orderNumber})`,
                        message: `${lastComment.authorName}: ${lastComment.message || '[ส่งรูปภาพประกอบ]'}`,
                        createdAt: nowIso,
                        read: false,
                      });
                    }
                  }
                }
                prevOrdersMap.set(order.id, order);
              });

              if (detected.length > 0) {
                emitAdminNotifications(detected);
              }
            }
          }

          loaded.sort(
            (a, b) =>
              new Date(b.updatedAt || b.createdAt).getTime() -
              new Date(a.updatedAt || a.createdAt).getTime()
          );
          setOrders(loaded);
          setOrdersLoading(false);
        },
        (err) => {
          if (cancelled) return;
          if (attempts < 4) {
            attempts += 1;
            retryTimer = setTimeout(subscribe, 500);
            return;
          }
          setFirestoreError(err.message);
          setOrdersLoading(false);
        }
      );
    };

    subscribe();

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (unsub) {
        unsub();
        unsub = null;
      }
    };
  }, [profile?.uid, profile?.role]);

  // Subscribe to notification settings for Admin
  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const unsub = onSnapshot(
      doc(db, 'settings', 'notifications'),
      (snap) => {
        if (snap.exists()) {
          setNotifSettings({
            ...DEFAULT_NOTIFICATION_SETTINGS,
            ...(snap.data() as Partial<NotificationSettings>),
          });
        }
      },
      () => {
        // ignore missing settings doc
      }
    );

    return () => unsub();
  }, [profile?.role]);

  // Real-time users directory listener for Admin
  useEffect(() => {
    if (profile?.role !== 'admin') {
      setAllUsers([]);
      return;
    }

    let unsub: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let attempts = 0;

    const subscribeUsers = () => {
      if (cancelled) return;
      if (unsub) {
        unsub();
        unsub = null;
      }

      unsub = onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          if (cancelled) return;
          attempts = 0;
          const usersList: UserProfile[] = snapshot.docs.map(
            (d) => d.data() as UserProfile
          );
          usersList.sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() -
              new Date(a.createdAt || 0).getTime()
          );
          setAllUsers(usersList);
        },
        () => {
          if (cancelled) return;
          if (attempts < 4) {
            attempts += 1;
            retryTimer = setTimeout(subscribeUsers, 500);
          }
        }
      );
    };

    subscribeUsers();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (unsub) unsub();
    };
  }, [profile?.uid, profile?.role]);

  const showNotice = (msg: string) => {
    setBannerNotice(msg);
    setTimeout(() => setBannerNotice(''), 4000);
  };

  const handleSelectNotification = (item: AppNotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    setSelectedOrderId(item.orderId);
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleDeleteUser = async (targetUser: UserProfile) => {
    if (!profile || profile.role !== 'admin' || targetUser.uid === profile.uid) {
      return;
    }
    if (
      !window.confirm(
        `ต้องการลบบัญชีลูกค้า "${targetUser.displayName}" (${targetUser.email}) ออกจากรายการสมาชิกหรือไม่?`
      )
    ) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', targetUser.uid));
      showNotice(`ลบข้อมูลบัญชี ${targetUser.displayName} เรียบร้อยแล้ว`);
    } catch (err: unknown) {
      setFirestoreError((err as Error)?.message || 'ไม่สามารถลบบัญชีได้');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setSelectedOrderId(null);
    setNotifications([]);
  };

  // Distinct customer brands for Admin filter
  const customerBrands = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.customerBrand) set.add(o.customerBrand);
    });
    return Array.from(set).sort();
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (profile?.role === 'admin' && customerFilter !== 'all') {
        if (order.customerBrand !== customerFilter) return false;
      }

      if (statusFilter === 'quote_pay') {
        if (order.status !== 'pending_quote' && order.status !== 'quoted') return false;
      } else if (statusFilter === 'in_progress') {
        if (order.status !== 'in_queue' && order.status !== 'designing') return false;
      } else if (statusFilter === 'review') {
        if (order.status !== 'review') return false;
      } else if (statusFilter === 'revision') {
        if (order.status !== 'revision') return false;
      } else if (statusFilter === 'completed') {
        if (order.status !== 'completed') return false;
      }

      if (searchQuery.trim()) {
        const needle = searchQuery.toLowerCase();
        const hay = `${order.orderNumber} ${order.title} ${order.customerName} ${order.customerBrand} ${order.artworkType}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      return true;
    });
  }, [orders, profile?.role, customerFilter, statusFilter, searchQuery]);

  // KPI summary
  const kpis = useMemo(() => {
    const isAdmin = profile?.role === 'admin';
    const total = orders.length;
    const actionRequired = orders.filter((o) =>
      isAdmin
        ? o.status === 'pending_quote' ||
          o.status === 'revision' ||
          o.paymentStatus === 'pending_verification'
        : o.status === 'quoted' || o.status === 'review'
    ).length;
    const activeDesign = orders.filter(
      (o) => o.status === 'in_queue' || o.status === 'designing'
    ).length;
    const completed = orders.filter((o) => o.status === 'completed').length;
    const paidAmount = orders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((acc, o) => acc + (o.quotedPrice || 0), 0);

    return { total, actionRequired, activeDesign, completed, paidAmount };
  }, [orders, profile?.role]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="mt-3 text-sm font-semibold text-slate-600">
            กำลังเชื่อมต่อ BriefBox & Firebase...
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <AuthScreen
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onAuthSuccess={(p) => setProfile(p)}
      />
    );
  }

  const isAdmin = profile.role === 'admin';

  const renderOrderCard = (order: ArtworkOrder) => {
    const statusMeta = ORDER_STATUS_META[order.status];
    const urgencyMeta = URGENCY_META[order.urgency];
    const latestDraft =
      order.drafts.length > 0 ? order.drafts[order.drafts.length - 1] : null;
    const needsMyAction = isAdmin
      ? order.status === 'pending_quote' ||
        order.status === 'revision' ||
        order.paymentStatus === 'pending_verification'
      : order.status === 'quoted' || order.status === 'review';

    return (
      <div
        key={order.id}
        onClick={() => setSelectedOrderId(order.id)}
        className={`group cursor-pointer rounded-2xl border bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md ${
          needsMyAction
            ? 'border-indigo-300 ring-2 ring-indigo-500/10'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
              {order.orderNumber}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.badgeClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
              {statusMeta.shortLabel}
            </span>
          </div>
          {needsMyAction && (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
              ต้องดำเนินการ
            </span>
          )}
        </div>

        {/* Optional Draft Thumbnail */}
        {latestDraft?.imageUrl && (
          <div className="mt-3 h-32 w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-100">
            <img
              src={latestDraft.imageUrl}
              alt={order.title}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          </div>
        )}

        <h3 className="mt-3 line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-indigo-700">
          {order.title}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
            <Building2 className="h-3 w-3 text-slate-400" />
            {order.customerBrand || order.customerName}
          </span>
          <span className="rounded-md bg-slate-50 px-2 py-0.5">{order.artworkType}</span>
          <span className="rounded-md bg-slate-50 px-2 py-0.5">{order.dimensions}</span>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {order.deadline}
            </span>
            <span className={`rounded px-1.5 py-0.5 font-semibold ${urgencyMeta.badgeClass}`}>
              {order.urgency === 'normal'
                ? 'ปกติ'
                : order.urgency === 'urgent'
                  ? 'ด่วน'
                  : '24ชม.'}
            </span>
          </div>

          <div className="flex items-center gap-2 font-bold text-slate-700">
            {order.drafts.length > 0 && (
              <span className="inline-flex items-center gap-0.5 text-violet-600">
                <FileImage className="h-3 w-3" />v{order.drafts.length}
              </span>
            )}
            {order.comments.length > 0 && (
              <span className="inline-flex items-center gap-0.5 text-slate-500">
                <MessageSquare className="h-3 w-3" />
                {order.comments.length}
              </span>
            )}
            {order.quotedPrice > 0 && (
              <span className="text-indigo-700">
                ฿{order.quotedPrice.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <Navbar
        profile={profile}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenNewBrief={() => setShowNewBrief(true)}
        onSignOut={handleSignOut}
        notifications={notifications}
        onSelectNotification={handleSelectNotification}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onOpenNotificationSettings={() => setShowNotifSettings(true)}
      />

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        {bannerNotice && (
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
            <span>✓ {bannerNotice}</span>
          </div>
        )}

        {firestoreError && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>ข้อผิดพลาด Firestore: {firestoreError}</span>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{isAdmin ? 'ออเดอร์ทั้งหมดในระบบ' : 'งานที่สั่งทั้งหมด'}</span>
              <Palette className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{kpis.total}</div>
            <p className="mt-0.5 text-[11px] text-slate-400">อัปเดตสถานะแบบ Real-time</p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
              <span>{isAdmin ? 'รอแอดมินจัดการ' : 'รอคุณตรวจสอบ / ชำระ'}</span>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-amber-900">
              {kpis.actionRequired}
            </div>
            <p className="mt-0.5 text-[11px] text-amber-700">
              {isAdmin ? 'รอประเมินราคา / ตรวจสลิป / แก้งาน' : 'รอดูดราฟต์หรือชำระค่าบริการ'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>กำลังออกแบบ</span>
              <Clock className="h-4 w-4 text-sky-500" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {kpis.activeDesign}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">อยู่ในคิว & กำลังทำภาพ</p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
              <span>{isAdmin ? 'ยอดชำระแล้ว (ปิดงาน ' + kpis.completed + ')' : 'งานเสร็จสมบูรณ์'}</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-emerald-900">
              {isAdmin ? `฿${kpis.paidAmount.toLocaleString()}` : kpis.completed}
            </div>
            <p className="mt-0.5 text-[11px] text-emerald-700">
              {isAdmin ? `งานเสร็จสมบูรณ์แล้ว ${kpis.completed} ชิ้น` : 'พร้อมดาวน์โหลดไฟล์ไฟนอล'}
            </p>
          </div>
        </div>

        {/* Filters & Controls Bar */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่องาน, รหัส BB-..., ชื่อแบรนด์..."
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-500"
              />
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="all">ลูกค้าทุกแบรนด์ ({orders.length})</option>
                    {customerBrands.map((brand) => (
                      <option key={brand} value={brand}>
                        แบรนด์: {brand}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowUsersModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>สมาชิกในระบบ ({allUsers.length} คน)</span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all' as StatusFilter, label: 'ทั้งหมด' },
                { id: 'quote_pay' as StatusFilter, label: 'ประเมิน/ชำระ' },
                { id: 'in_progress' as StatusFilter, label: 'กำลังออกแบบ' },
                { id: 'review' as StatusFilter, label: 'รอตรวจดราฟต์' },
                { id: 'revision' as StatusFilter, label: 'แก้ไข Revision' },
                { id: 'completed' as StatusFilter, label: 'เสร็จสมบูรณ์' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === f.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 self-end rounded-xl bg-slate-100 p-1 lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" />
              กระดานสถานะ
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              มุมมองการ์ด
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="mt-6">
          {ordersLoading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
              <p className="mt-3 text-xs font-semibold text-slate-500">
                กำลังโหลดรายการงาน Artwork จาก Cloud Firestore...
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Palette className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-lg font-extrabold text-slate-900">
                ยังไม่มีรายการสั่งงาน Artwork
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
                {isAdmin
                  ? 'ยังไม่มีออเดอร์จากลูกค้าในขณะนี้ เมื่อลูกค้ากรอกบรีฟสั่งงานเข้ามา ระบบจะแจ้งเตือนและแสดงรายการบนกระดานทันที'
                  : 'เริ่มต้นสั่งงานชิ้นแรกด้วยการกรอกบรีฟงาน Artwork เพื่อให้ทีมออกแบบประเมินราคาและเริ่มสร้างสรรค์ผลงานให้คุณ'}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewBrief(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  สั่งงาน Artwork ใหม่
                </button>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              ไม่พบรายการงานที่ตรงกับเงื่อนไขการค้นหา
            </div>
          ) : viewMode === 'kanban' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {KANBAN_COLUMNS.map((col) => {
                const colOrders = filteredOrders.filter((o) =>
                  col.statuses.includes(o.status)
                );
                return (
                  <div
                    key={col.id}
                    className={`flex flex-col rounded-2xl border border-slate-200 border-t-4 bg-slate-100/70 p-3 ${col.accent}`}
                  >
                    <div className="mb-3 flex items-center justify-between px-1">
                      <h3 className="text-xs font-extrabold text-slate-800">
                        {col.title}
                      </h3>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 shadow-2xs">
                        {colOrders.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {colOrders.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300/80 py-8 text-center text-[11px] text-slate-400">
                          ไม่มีงานในขั้นตอนนี้
                        </div>
                      ) : (
                        colOrders.map(renderOrderCard)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredOrders.map(renderOrderCard)}
            </div>
          )}
        </div>
      </main>

      {/* New Brief Modal */}
      {showNewBrief && (
        <NewBriefModal
          profile={profile}
          onClose={() => setShowNewBrief(false)}
          onCreated={(title) =>
            showNotice(`ส่งบรีฟงาน "${title}" เรียบร้อยแล้ว!`)
          }
        />
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          profile={profile}
          onClose={() => setSelectedOrderId(null)}
        />
      )}

      {/* Registered Users Directory Modal (Admin) */}
      {showUsersModal && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4 backdrop-blur-xs"
          onClick={() => setShowUsersModal(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    สมาชิกในระบบทั้งหมด ({allUsers.length} คน)
                  </h2>
                  <p className="text-xs text-slate-500">
                    รายชื่อบัญชีลูกค้าและแอดมินที่ลงทะเบียนใน Cloud Firestore
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUsersModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-6">
              {allUsers.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  ยังไม่มีข้อมูลสมาชิกในระบบ
                </p>
              ) : (
                allUsers.map((u) => {
                  const userOrderCount = orders.filter(
                    (o) => o.customerId === u.uid
                  ).length;
                  return (
                    <div
                      key={u.uid}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {u.displayName}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              u.role === 'admin'
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-sky-100 text-sky-700'
                            }`}
                          >
                            {u.role === 'admin' && (
                              <ShieldCheck className="h-3 w-3" />
                            )}
                            {u.role === 'admin' ? 'แอดมิน' : 'ลูกค้า'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            {u.brandName || '-'}
                          </span>
                          {u.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5 text-slate-400" />
                              {u.email}
                            </span>
                          )}
                          {u.contactInfo && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              {u.contactInfo}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">
                          {userOrderCount} งาน
                        </div>
                        {u.uid !== profile.uid && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="rounded-xl border border-rose-200 bg-rose-50 p-1.5 text-rose-600 transition hover:bg-rose-100"
                            title="ลบบัญชีผู้ใช้นี้"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notification Settings Modal (Admin) */}
      {showNotifSettings && isAdmin && (
        <NotificationSettingsModal
          onClose={() => setShowNotifSettings(false)}
          onSettingsUpdated={(updated) => setNotifSettings(updated)}
        />
      )}
    </div>
  );
}

export default App;
