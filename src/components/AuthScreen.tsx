import React, { useState } from 'react';
import {
  Palette,
  Mail,
  Lock,
  User as UserIcon,
  Building2,
  Phone,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types/briefbox';

const DESIGNATED_ADMIN_EMAILS = [
  'admin@briefbox.demo',
  'hellbluesboysdo@gmail.com',
];

function resolveRoleForEmail(email: string): UserRole {
  return DESIGNATED_ADMIN_EMAILS.includes(email.trim().toLowerCase())
    ? 'admin'
    : 'customer';
}

interface AuthScreenProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onAuthSuccess: (profile: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  theme,
  onToggleTheme,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const upsertProfile = async (
    uid: string,
    payload: Omit<UserProfile, 'uid' | 'createdAt'>
  ): Promise<UserProfile> => {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const existing = snap.data() as UserProfile;
      const updates = {
        email: payload.email || existing.email || '',
        displayName: payload.displayName || existing.displayName || 'ผู้ใช้งาน',
        brandName: payload.brandName || existing.brandName || '',
        contactInfo: payload.contactInfo || existing.contactInfo || '',
        role: payload.role,
      };
      await updateDoc(userRef, updates);
      return {
        ...existing,
        ...updates,
      };
    }

    const profile: UserProfile = {
      uid,
      email: payload.email || '',
      displayName: payload.displayName || 'ผู้ใช้งาน',
      brandName: payload.brandName || '',
      contactInfo: payload.contactInfo || '',
      role: payload.role,
      createdAt: new Date().toISOString(),
    };
    await setDoc(userRef, profile);
    return profile;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const normalizedEmail = email.trim();
      const resolvedRole = resolveRoleForEmail(normalizedEmail);

      if (mode === 'login') {
        const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        const userRef = doc(db, 'users', cred.user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const existing = snap.data() as UserProfile;
          if (existing.role !== resolvedRole) {
            await updateDoc(userRef, { role: resolvedRole });
            onAuthSuccess({ ...existing, role: resolvedRole });
          } else {
            onAuthSuccess(existing);
          }
        } else {
          const fallbackProfile = await upsertProfile(cred.user.uid, {
            email: cred.user.email || normalizedEmail,
            displayName:
              resolvedRole === 'admin'
                ? 'นักออกแบบ BriefBox Studio'
                : cred.user.email?.split('@')[0] || 'ลูกค้า',
            brandName: resolvedRole === 'admin' ? 'BriefBox Studio' : 'My Brand',
            contactInfo: '',
            role: resolvedRole,
          });
          onAuthSuccess(fallbackProfile);
        }
      } else {
        if (!displayName.trim()) {
          throw new Error('กรุณากรอกชื่อผู้ติดต่อ');
        }
        const cred = await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );
        const newProfile = await upsertProfile(cred.user.uid, {
          email: normalizedEmail,
          displayName: displayName.trim(),
          brandName: brandName.trim() || 'บุคคลทั่วไป',
          contactInfo: contactInfo.trim(),
          role: resolvedRole,
        });
        onAuthSuccess(newProfile);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setErrorMsg('อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg('อีเมลนี้ถูกใช้งานแล้ว กรุณากดแท็บ "เข้าสู่ระบบ"');
      } else if (code === 'auth/weak-password') {
        setErrorMsg('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      } else {
        setErrorMsg((err as Error)?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl lg:grid-cols-12">
        {/* Left Hero Panel */}
        <div className="relative flex flex-col justify-between bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-8 text-white lg:col-span-5 lg:p-10">
          <div>
            <div className="inline-flex items-center gap-2.5 rounded-2xl bg-white/15 px-3.5 py-2 backdrop-blur-sm">
              <Palette className="h-5 w-5 text-amber-300" />
              <span className="text-base font-extrabold tracking-tight">
                BriefBox Studio
              </span>
            </div>

            <h1 className="mt-6 text-2xl font-extrabold leading-snug sm:text-3xl">
              ระบบสั่งงาน Artwork ออนไลน์สำหรับลูกค้า
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-indigo-100">
              รวมทุกขั้นตอนตั้งแต่ส่งบรีฟ แนบภาพ Reference รับใบเสนอราคา แนบสลิป
              ตรวจดราฟต์ แจ้งแก้ไข (Revision) ไปจนถึงดาวน์โหลดไฟล์ไฟนอลไว้ในที่เดียว
            </p>

            <div className="mt-8 space-y-3.5 text-sm">
              {[
                'บัญชีลูกค้าแยกเป็นส่วนตัว เห็นและจัดการเฉพาะงานของคุณ 100%',
                'ติดตามสถานะคิวงานได้แบบ Real-time ทุกขั้นตอน',
                'ตรวจภาพดราฟต์ v1, v2 พร้อมคอมเมนต์ขอแก้ไขและพูดคุยกับนักออกแบบได้ทันที',
                'เก็บประวัติบรีฟและไฟล์งานทั้งหมดไว้ในระบบคลาวด์อย่างปลอดภัย',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span className="text-indigo-50">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-4 text-xs text-indigo-100">
            <p className="font-semibold text-white">👋 สำหรับลูกค้าที่เข้ามาใช้งานครั้งแรก</p>
            <p className="mt-1">
              กดแท็บ <strong>"สมัครสมาชิกใหม่"</strong> ด้านขวา กรอกชื่อ แบรนด์ และอีเมลของคุณ
              เพื่อเริ่มต้นสั่งงาน Artwork ได้ทันทีครับ
            </p>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-7 lg:p-10">
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
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
          </div>

          {/* Tabs */}
          <div className="flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
              }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              สมัครสมาชิกใหม่
            </button>
          </div>

          {errorMsg && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === 'register' && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      ชื่อผู้ติดต่อ *
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="เช่น คุณพลอย"
                        className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      ชื่อแบรนด์ / บริษัท
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="เช่น Bloom Café"
                        className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    เบอร์โทร / LINE ID สำหรับติดต่อ
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={contactInfo}
                      onChange={(e) => setContactInfo(e.target.value)}
                      placeholder="เช่น LINE: @mybrand / 089-123-4567"
                      className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                อีเมล *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                รหัสผ่าน *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-60"
            >
              <span>
                {loading
                  ? 'กำลังดำเนินการ...'
                  : mode === 'login'
                    ? 'เข้าสู่ระบบ'
                    : 'สร้างบัญชีและเริ่มสั่งงาน'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
