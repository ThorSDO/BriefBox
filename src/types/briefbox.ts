export type UserRole = 'customer' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  brandName: string;
  contactInfo: string;
  role: UserRole;
  createdAt: string;
}

export type OrderStatus =
  | 'pending_quote'
  | 'quoted'
  | 'in_queue'
  | 'designing'
  | 'review'
  | 'revision'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'pending_verification' | 'paid';

export type OrderUrgency = 'normal' | 'urgent' | 'express';

export interface ReferenceImage {
  id: string;
  name: string;
  dataUrl: string;
}

export interface ArtworkDraft {
  version: number;
  imageUrl: string;
  externalLink?: string;
  designerNote: string;
  submittedAt: string;
  status: 'pending_review' | 'revision_requested' | 'approved';
  customerFeedback?: string;
  reviewedAt?: string;
}

export interface OrderComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  message: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface ArtworkOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerBrand: string;
  customerContact: string;
  title: string;
  artworkType: string;
  dimensions: string;
  fileFormats: string[];
  moodAndTone: string;
  colorPalette: string[];
  headlineText: string;
  subText: string;
  briefDetails: string;
  referenceUrl: string;
  referenceImages: ReferenceImage[];
  deadline: string;
  urgency: OrderUrgency;
  maxRevisions: number;
  usedRevisions: number;
  status: OrderStatus;
  assignedDesigner: string;
  quotedPrice: number;
  quoteNote: string;
  paymentStatus: PaymentStatus;
  paymentSlipUrl: string;
  paymentPaidAt: string;
  drafts: ArtworkDraft[];
  finalDeliverableUrl: string;
  finalPreviewImage: string;
  finalNote: string;
  comments: OrderComment[];
  createdAt: string;
  updatedAt: string;
}

export const ORDER_STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
    dotClass: string;
    description: string;
  }
> = {
  pending_quote: {
    label: 'รอประเมินราคา',
    shortLabel: 'รอประเมิน',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
    description: 'ทีมกราฟิกกำลังตรวจสอบบรีฟเพื่อแจ้งใบเสนอราคา',
  },
  quoted: {
    label: 'แจ้งราคาแล้ว / รอชำระ',
    shortLabel: 'รอชำระเงิน',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
    description: 'กรุณาตรวจสอบใบเสนอราคาและแนบสลิปชำระเงินเพื่อเริ่มคิวงาน',
  },
  in_queue: {
    label: 'ยืนยันคิวงานแล้ว',
    shortLabel: 'ในคิวงาน',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    dotClass: 'bg-sky-500',
    description: 'ชำระเงินเรียบร้อย กำลังรอดีไซเนอร์รับเข้าสู่ขั้นตอนออกแบบ',
  },
  designing: {
    label: 'กำลังออกแบบ',
    shortLabel: 'กำลังออกแบบ',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dotClass: 'bg-indigo-500',
    description: 'ดีไซเนอร์กำลังสร้างสรรค์ผลงานตามบรีฟของคุณ',
  },
  review: {
    label: 'ส่งดราฟต์แล้ว / รอตรวจ',
    shortLabel: 'รอลูกค้าตรวจ',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
    dotClass: 'bg-violet-500',
    description: 'มีดราฟต์งานใหม่รอให้คุณตรวจสอบ อนุมัติ หรือสั่งแก้ไข',
  },
  revision: {
    label: 'กำลังแก้ไขงาน (Revision)',
    shortLabel: 'แก้ไขงาน',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
    description: 'ทีมกราฟิกได้รับคอมเมนต์แล้วและกำลังปรับแก้ผลงานตามคำขอ',
  },
  completed: {
    label: 'เสร็จสมบูรณ์',
    shortLabel: 'เสร็จสมบูรณ์',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
    description: 'อนุมัติงานเรียบร้อย พร้อมดาวน์โหลดไฟล์ Artwork ฉบับสมบูรณ์',
  },
  cancelled: {
    label: 'ยกเลิกงาน',
    shortLabel: 'ยกเลิก',
    badgeClass: 'bg-neutral-100 text-neutral-500 border-neutral-200',
    dotClass: 'bg-neutral-400',
    description: 'รายการสั่งงานนี้ถูกยกเลิกแล้ว',
  },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; badgeClass: string }
> = {
  unpaid: {
    label: 'ยังไม่ชำระเงิน',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  pending_verification: {
    label: 'รอแอดมินตรวจสลิป',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  paid: {
    label: 'ชำระเงินเรียบร้อย',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
};

export const URGENCY_META: Record<
  OrderUrgency,
  { label: string; badgeClass: string }
> = {
  normal: {
    label: 'ปกติ (3-5 วัน)',
    badgeClass: 'bg-slate-100 text-slate-700',
  },
  urgent: {
    label: 'ด่วน (1-2 วัน)',
    badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200',
  },
  express: {
    label: 'ด่วนพิเศษ (24 ชม.)',
    badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
  },
};

export const GRAPHIC_ARTWORK_TYPES = [
  'Social Media Post',
  'Banner / Ads',
  'Logo / CI',
  'Poster / สิ่งพิมพ์',
  'Packaging',
  'Rich Menu LINE OA',
  'Infographic',
  'อื่นๆ',
] as const;

export const VIDEO_ARTWORK_TYPES = [
  'วิดีโอสั้น (TikTok / Reels / Shorts)',
  'วิดีโอโฆษณา / ยิงแอด (Video Ads)',
  'Motion Graphic / แอนิเมชัน',
  'รีวิวสินค้า / แนะนำบริการ (Review)',
  'YouTube / วิดีโอยาว (16:9)',
  'วิดีโองานอีเวนต์ / Presentation',
  'วิดีโออื่นๆ',
] as const;

export const GRAPHIC_DIMENSION_PRESETS = [
  '1080x1080 px (1:1)',
  '1080x1350 px (4:5)',
  '1920x1080 px (16:9)',
  '1080x1920 px (Story/Reels)',
  '2500x1686 px (LINE Rich Menu)',
  'A4 (210x297 mm)',
] as const;

export const VIDEO_DIMENSION_PRESETS = [
  '1080x1920 px (9:16 แนวตั้ง - TikTok / Reels / Shorts)',
  '1920x1080 px (16:9 แนวนอน - YouTube / จอใหญ่)',
  '1080x1080 px (1:1 จัตุรัส - Video Feed Post)',
  '1080x1350 px (4:5 แนวตั้ง - IG / Facebook Video)',
] as const;

export const GRAPHIC_FILE_FORMAT_OPTIONS = [
  'PNG',
  'JPG',
  'PDF สำหรับพิมพ์',
  'AI / PSD ต้นฉบับ',
] as const;

export const VIDEO_FILE_FORMAT_OPTIONS = [
  'MP4 (Full HD)',
  'MP4 (4K)',
  'MOV (ProRes)',
  'PRPROJ / AEP ต้นฉบับ',
  'GIF (ภาพเคลื่อนไหว)',
  'JPG / PNG (หน้าปก Cover)',
] as const;

export const VIDEO_DURATION_PRESETS = [
  '< 15 วินาที (สั้นกระชับ)',
  '15 - 30 วินาที (Reels / TikTok / Ads)',
  '30 - 60 วินาที',
  '1 - 3 นาที',
  '> 3 นาที (วิดีโอยาว)',
] as const;

export const VIDEO_AUDIO_OPTIONS = [
  '🎙️ มีเสียงพากย์ (Voiceover)',
  '🎵 ดนตรีสนุกสนาน (Upbeat BGM)',
  '☕ ดนตรีฟังสบาย (Chill / Relax)',
  '⚡ เสียงเอฟเฟกต์ (SFX)',
  '💬 มีซับไตเติลภาษาไทย (Subtitles)',
  '🔇 ไม่ใส่เสียง (No Audio)',
] as const;

export function isVideoOrder(artworkType: string): boolean {
  if (!artworkType) return false;
  const lower = artworkType.toLowerCase();
  return (
    lower.includes('วิดีโอ') ||
    lower.includes('video') ||
    lower.includes('motion') ||
    lower.includes('reels') ||
    lower.includes('tiktok') ||
    lower.includes('shorts')
  );
}

