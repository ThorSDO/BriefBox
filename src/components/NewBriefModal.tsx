import React, { useState } from 'react';
import {
  X,
  ImagePlus,
  Trash2,
  Calendar,
  Sparkles,
  Layers,
  Palette,
  Type as TypeIcon,
  Link2,
  Check,
  Video,
  Film,
  Clock,
  Volume2,
} from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { compressImageToDataUrl } from '../lib/imageUtils';
import { sendExternalWebhookNotification } from '../lib/notifications';
import {
  ArtworkOrder,
  OrderUrgency,
  ReferenceImage,
  UserProfile,
  GRAPHIC_ARTWORK_TYPES,
  VIDEO_ARTWORK_TYPES,
  GRAPHIC_DIMENSION_PRESETS,
  VIDEO_DIMENSION_PRESETS,
  GRAPHIC_FILE_FORMAT_OPTIONS,
  VIDEO_FILE_FORMAT_OPTIONS,
  VIDEO_DURATION_PRESETS,
  VIDEO_AUDIO_OPTIONS,
} from '../types/briefbox';

interface NewBriefModalProps {
  profile: UserProfile;
  onClose: () => void;
  onCreated: (orderTitle: string) => void;
}

const MOOD_PRESETS = [
  'Minimal / สะอาดตา',
  'Luxury / พรีเมียม',
  'สดใส / สนุกสนาน',
  'ทางการ / น่าเชื่อถือ',
  'โมเดิร์น / เทคโนโลยี',
  'วินเทจ / อบอุ่น',
];

const COLOR_PALETTE_PRESETS = [
  { name: 'Indigo Studio', colors: ['#1e1b4b', '#4f46e5', '#eef2ff', '#ffffff'] },
  { name: 'Matcha Earth', colors: ['#064e3b', '#10b981', '#ecfdf5', '#fef3c7'] },
  { name: 'Luxury Gold', colors: ['#18181b', '#d4af37', '#f8fafc', '#71717a'] },
  { name: 'Coral Pop', colors: ['#881337', '#f43f5e', '#fff1f2', '#fbbf24'] },
];

export const NewBriefModal: React.FC<NewBriefModalProps> = ({
  profile,
  onClose,
  onCreated,
}) => {
  const defaultDeadline = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Work category: Graphic vs Video
  const [workCategory, setWorkCategory] = useState<'graphic' | 'video'>('graphic');

  // Admin can optionally enter custom customer info if creating on behalf of a customer
  const [customerName, setCustomerName] = useState(profile.displayName);
  const [customerBrand, setCustomerBrand] = useState(profile.brandName || '');
  const [customerContact, setCustomerContact] = useState(profile.contactInfo || '');

  // Section 1: Specs
  const [title, setTitle] = useState('');
  const [artworkType, setArtworkType] = useState<string>(GRAPHIC_ARTWORK_TYPES[0]);
  const [dimensions, setDimensions] = useState<string>(GRAPHIC_DIMENSION_PRESETS[0]);
  const [customDimension, setCustomDimension] = useState('');
  const [fileFormats, setFileFormats] = useState<string[]>(['PNG', 'JPG']);

  // Video-specific states
  const [videoDuration, setVideoDuration] = useState<string>(VIDEO_DURATION_PRESETS[1]);
  const [customVideoDuration, setCustomVideoDuration] = useState('');
  const [videoAudioOptions, setVideoAudioOptions] = useState<string[]>([
    '🎵 ดนตรีสนุกสนาน (Upbeat BGM)',
    '💬 มีซับไตเติลภาษาไทย (Subtitles)',
  ]);

  // Section 2: Mood & Content
  const [moodAndTone, setMoodAndTone] = useState(MOOD_PRESETS[0]);
  const [colorPalette, setColorPalette] = useState<string[]>(['#4f46e5', '#0f172a', '#ffffff']);
  const [newColorInput, setNewColorInput] = useState('#10b981');
  const [headlineText, setHeadlineText] = useState('');
  const [subText, setSubText] = useState('');
  const [briefDetails, setBriefDetails] = useState('');

  // Section 3: References & Deadline
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [referenceUrl, setReferenceUrl] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [urgency, setUrgency] = useState<OrderUrgency>('normal');

  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle switching category between Graphic and Video
  const handleCategoryChange = (category: 'graphic' | 'video') => {
    setWorkCategory(category);
    if (category === 'video') {
      setArtworkType(VIDEO_ARTWORK_TYPES[0]);
      setDimensions(VIDEO_DIMENSION_PRESETS[0]);
      setFileFormats(['MP4 (Full HD)']);
    } else {
      setArtworkType(GRAPHIC_ARTWORK_TYPES[0]);
      setDimensions(GRAPHIC_DIMENSION_PRESETS[0]);
      setFileFormats(['PNG', 'JPG']);
    }
  };

  const toggleFormat = (fmt: string) => {
    setFileFormats((prev) =>
      prev.includes(fmt) ? prev.filter((item) => item !== fmt) : [...prev, fmt]
    );
  };

  const toggleAudioOption = (opt: string) => {
    setVideoAudioOptions((prev) =>
      prev.includes(opt) ? prev.filter((item) => item !== opt) : [...prev, opt]
    );
  };

  const handleAddColor = () => {
    if (!colorPalette.includes(newColorInput) && colorPalette.length < 6) {
      setColorPalette([...colorPalette, newColorInput]);
    }
  };

  const handleRemoveColor = (color: string) => {
    setColorPalette(colorPalette.filter((c) => c !== color));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (referenceImages.length + files.length > 3) {
      setErrorMsg('สามารถแนบภาพ Reference ได้สูงสุด 3 ภาพต่อออเดอร์');
      return;
    }

    setErrorMsg('');
    setUploadingImage(true);
    try {
      const added: ReferenceImage[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const dataUrl = await compressImageToDataUrl(file, 850, 0.7);
        added.push({
          id: `${Date.now()}-${i}`,
          name: file.name,
          dataUrl,
        });
      }
      setReferenceImages((prev) => [...prev, ...added]);
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'อัปโหลดรูปภาพไม่สำเร็จ');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg(
        workCategory === 'video'
          ? 'กรุณาระบุชื่องาน / วิดีโอ'
          : 'กรุณาระบุชื่องาน Artwork'
      );
      return;
    }

    setErrorMsg('');
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const finalDimensions =
        dimensions === 'custom'
          ? customDimension.trim() || 'ตามที่ระบุในบรีฟ'
          : dimensions;

      // Compose brief details for video if video category
      const resolvedDuration =
        videoDuration === 'custom'
          ? customVideoDuration.trim() || 'ตามระบุในบรีฟ'
          : videoDuration;

      let finalBriefDetails = briefDetails.trim();
      if (workCategory === 'video') {
        const videoSpecs = [
          resolvedDuration ? `⏱️ ความยาววิดีโอ: ${resolvedDuration}` : '',
          videoAudioOptions.length > 0
            ? `🔊 รูปแบบเสียง/ซาวด์: ${videoAudioOptions.join(', ')}`
            : '',
          briefDetails.trim()
            ? `🎬 สคริปต์ & รายละเอียดเพิ่มเติม:\n${briefDetails.trim()}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n');
        finalBriefDetails = videoSpecs;
      }

      const defaultFormat = workCategory === 'video' ? 'MP4 (Full HD)' : 'PNG';

      const newOrder: Omit<ArtworkOrder, 'id'> = {
        orderNumber: `BB-${Math.floor(1000 + Math.random() * 9000)}`,
        customerId: profile.uid,
        customerName: customerName.trim() || profile.displayName,
        customerBrand: customerBrand.trim() || profile.brandName || 'ลูกค้าทั่วไป',
        customerContact: customerContact.trim() || profile.contactInfo || '',
        title: title.trim(),
        artworkType,
        dimensions: finalDimensions,
        fileFormats: fileFormats.length > 0 ? fileFormats : [defaultFormat],
        moodAndTone,
        colorPalette,
        headlineText: headlineText.trim(),
        subText: subText.trim(),
        briefDetails: finalBriefDetails,
        referenceUrl: referenceUrl.trim(),
        referenceImages,
        deadline,
        urgency,
        maxRevisions: 3,
        usedRevisions: 0,
        status: 'pending_quote',
        assignedDesigner: '',
        quotedPrice: 0,
        quoteNote: '',
        paymentStatus: 'unpaid',
        paymentSlipUrl: '',
        paymentPaidAt: '',
        drafts: [],
        finalDeliverableUrl: '',
        finalPreviewImage: '',
        finalNote: '',
        comments: [],
        createdAt: now,
        updatedAt: now,
      };

      await addDoc(collection(db, 'orders'), newOrder);
      const icon = workCategory === 'video' ? '🎬' : '🎨';
      void sendExternalWebhookNotification(
        `${icon} [BriefBox] มีออเดอร์ใหม่!\n• รหัส: ${newOrder.orderNumber}\n• ชื่องาน: ${newOrder.title}\n• ลูกค้า: ${newOrder.customerName} (${newOrder.customerBrand})\n• ประเภท: ${newOrder.artworkType} (${newOrder.dimensions})\n• กำหนดส่ง: ${newOrder.deadline} (${newOrder.urgency})`
      );
      onCreated(newOrder.title);
      onClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'บันทึกบรีฟงานไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  const isVideo = workCategory === 'video';
  const currentArtworkTypes = isVideo ? VIDEO_ARTWORK_TYPES : GRAPHIC_ARTWORK_TYPES;
  const currentDimensions = isVideo ? VIDEO_DIMENSION_PRESETS : GRAPHIC_DIMENSION_PRESETS;
  const currentFormats = isVideo ? VIDEO_FILE_FORMAT_OPTIONS : GRAPHIC_FILE_FORMAT_OPTIONS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-xs sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              {isVideo ? (
                <Film className="h-5 w-5 text-amber-300" />
              ) : (
                <Sparkles className="h-5 w-5 text-amber-300" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                {isVideo
                  ? 'สั่งงานวิดีโอ & โมชัน (Video Brief)'
                  : 'สั่งงาน Artwork ใหม่ (Creative Brief)'}
              </h2>
              <p className="text-xs text-indigo-100">
                {isVideo
                  ? 'กรอกรายละเอียดบรีฟวิดีโอ สัดส่วน ความยาว และสคริปต์ เพื่อให้ทีมตัดต่อประเมินราคาได้ตรงใจที่สุด'
                  : 'กรอกรายละเอียดบรีฟให้ครบถ้วนเพื่อให้ดีไซเนอร์ประเมินราคาและออกแบบได้ตรงใจที่สุด'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto p-6">
          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* Work Category Selector */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5">
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleCategoryChange('graphic')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition ${
                  !isVideo
                    ? 'border border-indigo-200 bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Palette className="h-4 w-4 text-indigo-600" />
                <span>🎨 งานภาพนิ่ง / กราฟิก (Graphic)</span>
              </button>
              <button
                type="button"
                onClick={() => handleCategoryChange('video')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition ${
                  isVideo
                    ? 'border border-violet-200 bg-white text-violet-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Video className="h-4 w-4 text-violet-600" />
                <span>🎬 งานวิดีโอ & โมชัน (Video / Reels)</span>
              </button>
            </div>
          </div>

          {/* Customer Info (editable when admin creates on behalf of client) */}
          {profile.role === 'admin' && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
              <p className="mb-2.5 text-xs font-bold text-violet-800">
                ข้อมูลลูกค้า (โหมดแอดมิน: สามารถระบุชื่อลูกค้า/แบรนด์ที่สั่งงานได้)
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="ชื่อลูกค้า"
                  className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-500"
                />
                <input
                  type="text"
                  value={customerBrand}
                  onChange={(e) => setCustomerBrand(e.target.value)}
                  placeholder="ชื่อแบรนด์ / ร้าน"
                  className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-500"
                />
                <input
                  type="text"
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                  placeholder="เบอร์โทร / LINE ID"
                  className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-500"
                />
              </div>
            </div>
          )}

          {/* Section 1: Specs */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                {isVideo
                  ? 'ส่วนที่ 1: ข้อมูลชิ้นงานวิดีโอ & สัดส่วน'
                  : 'ส่วนที่ 1: ข้อมูลชิ้นงาน & ขนาด'}
              </h3>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {isVideo ? 'ชื่องานวิดีโอ / โปรเจกต์ *' : 'ชื่องาน Artwork / โปรเจกต์ *'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  isVideo
                    ? 'เช่น คลิปสั้น TikTok รีวิวสินค้าโปร 11.11, วิดีโอโฆษณายิงแอด Facebook Reels'
                    : 'เช่น แบนเนอร์โปรโมชั่น 11.11 ลด 50%, โปสเตอร์เมนูใหม่ Matcha Latte'
                }
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {isVideo ? 'ประเภทงานวิดีโอ' : 'ประเภทงาน Artwork'}
              </label>
              <div className="flex flex-wrap gap-2">
                {currentArtworkTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setArtworkType(type)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      artworkType === type
                        ? isVideo
                          ? 'border-violet-600 bg-violet-50 text-violet-700'
                          : 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {isVideo ? 'ขนาดและสัดส่วนวิดีโอ (Aspect Ratio)' : 'ขนาดและสัดส่วนภาพ'}
              </label>
              <div className="flex flex-wrap gap-2">
                {currentDimensions.map((dim) => (
                  <button
                    key={dim}
                    type="button"
                    onClick={() => setDimensions(dim)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                      dimensions === dim
                        ? isVideo
                          ? 'border-violet-600 bg-violet-50 font-semibold text-violet-700'
                          : 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {dim}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDimensions('custom')}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                    dimensions === 'custom'
                      ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  กำหนดขนาดเอง
                </button>
              </div>
              {dimensions === 'custom' && (
                <input
                  type="text"
                  value={customDimension}
                  onChange={(e) => setCustomDimension(e.target.value)}
                  placeholder={
                    isVideo
                      ? 'ระบุสัดส่วนหรือความละเอียด เช่น 1920x1920 px หรือ จอ LED หน้าร้าน 2560x1440'
                      : 'ระบุขนาด เช่น 1200x628 px หรือ กว้าง 80 x สูง 200 cm (Roll-up)'
                  }
                  className="mt-2.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500"
                />
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                นามสกุลไฟล์ที่ต้องการรับ (เลือกได้มากกว่า 1)
              </label>
              <div className="flex flex-wrap gap-2">
                {currentFormats.map((fmt) => {
                  const selected = fileFormats.includes(fmt);
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => toggleFormat(fmt)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        selected
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                      <span>{fmt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Section 2: Style, Copywriting / Video Details */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              {isVideo ? (
                <Video className="h-4 w-4 text-violet-600" />
              ) : (
                <Palette className="h-4 w-4 text-indigo-600" />
              )}
              <h3 className="text-sm font-bold text-slate-900">
                {isVideo
                  ? 'ส่วนที่ 2: ความยาว, สไตล์, สคริปต์ & รายละเอียดวิดีโอ (Video Brief)'
                  : 'ส่วนที่ 2: สไตล์ โทนสี & ข้อความในภาพ (Copywriting)'}
              </h3>
            </div>

            {/* Video-specific duration & audio preferences */}
            {isVideo && (
              <div className="space-y-4 rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
                {/* Duration */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-violet-900">
                    <Clock className="h-3.5 w-3.5 text-violet-600" />
                    <span>ความยาววิดีโอที่ต้องการ</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {VIDEO_DURATION_PRESETS.map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setVideoDuration(dur)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          videoDuration === dur
                            ? 'border-violet-600 bg-violet-600 text-white shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-violet-50'
                        }`}
                      >
                        {dur}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setVideoDuration('custom')}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        videoDuration === 'custom'
                          ? 'border-violet-600 bg-violet-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-violet-50'
                      }`}
                    >
                      กำหนดเอง
                    </button>
                  </div>
                  {videoDuration === 'custom' && (
                    <input
                      type="text"
                      value={customVideoDuration}
                      onChange={(e) => setCustomVideoDuration(e.target.value)}
                      placeholder="ระบุความยาว เช่น 45 วินาที หรือ ประมาณ 5 นาที"
                      className="mt-2.5 w-full rounded-xl border border-violet-200 bg-white px-3.5 py-2 text-xs outline-none focus:border-violet-500"
                    />
                  )}
                </div>

                {/* Audio & Subtitles */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-violet-900">
                    <Volume2 className="h-3.5 w-3.5 text-violet-600" />
                    <span>รูปแบบเสียง, ดนตรี และคำบรรยาย (เลือกได้มากกว่า 1)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {VIDEO_AUDIO_OPTIONS.map((opt) => {
                      const selected = videoAudioOptions.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleAudioOption(opt)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                            selected
                              ? 'border-violet-600 bg-violet-100/90 text-violet-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {selected && <Check className="h-3.5 w-3.5 text-violet-700" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {isVideo ? 'Mood & Tone ของวิดีโอ' : 'Mood & Tone ที่ต้องการ'}
              </label>
              <div className="flex flex-wrap gap-2">
                {MOOD_PRESETS.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => setMoodAndTone(mood)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      moodAndTone === mood
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {isVideo
                  ? 'โทนสีของแบรนด์ / โทนสีภาพวิดีโอ (Color Grading)'
                  : 'โทนสีของแบรนด์ / สีที่ต้องการเน้น'}
              </label>
              <div className="mb-2.5 flex flex-wrap gap-2">
                {COLOR_PALETTE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setColorPalette(preset.colors)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <span className="flex -space-x-1">
                      {preset.colors.map((c) => (
                        <span
                          key={c}
                          className="h-3.5 w-3.5 rounded-full border border-white shadow-xs"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {colorPalette.map((color) => (
                  <div
                    key={color}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white py-1 pl-1.5 pr-2 text-xs font-mono"
                  >
                    <span
                      className="h-4 w-4 rounded-md border border-slate-200"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-slate-700">{color}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(color)}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-2 py-1">
                  <input
                    type="color"
                    value={newColorInput}
                    onChange={(e) => setNewColorInput(e.target.value)}
                    className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <button
                    type="button"
                    onClick={handleAddColor}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    + เพิ่มสี
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <TypeIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {isVideo
                      ? 'Hook 3 วินาทีแรก / ข้อความเปิดคลิป (Hook / Intro)'
                      : 'ข้อความหลักในภาพ (Headline)'}
                  </span>
                </label>
                <input
                  type="text"
                  value={headlineText}
                  onChange={(e) => setHeadlineText(e.target.value)}
                  placeholder={
                    isVideo
                      ? 'เช่น "รู้หรือไม่! 3 ข้อผิดพลาดคนทำธุรกิจ..." หรือ ตัวหนังสือเปิดคลิป'
                      : 'เช่น ลดแรง 50% เฉพาะสัปดาห์นี้!'
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  {isVideo
                    ? 'Call to Action / ข้อความปิดท้ายคลิป (Outro / CTA)'
                    : 'ข้อความรอง / ราคา / ช่องทางติดต่อในภาพ'}
                </label>
                <input
                  type="text"
                  value={subText}
                  onChange={(e) => setSubText(e.target.value)}
                  placeholder={
                    isVideo
                      ? 'เช่น "กดตะกร้าสั่งซื้อด่วน!", "สอบถามข้อมูลเพิ่ม LINE @bloomcafe"'
                      : 'เช่น วันนี้ - 30 พ.ย. • LINE @bloomcafe'
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {isVideo
                  ? 'ลำดับเรื่องราว / สคริปต์ / รายละเอียดวิดีโอ (Script & Storyboard)'
                  : 'รายละเอียดบรีฟเพิ่มเติม (สิ่งที่อยากเน้น หรือสิ่งที่ห้ามใส่)'}
              </label>
              <textarea
                rows={isVideo ? 4 : 3}
                value={briefDetails}
                onChange={(e) => setBriefDetails(e.target.value)}
                placeholder={
                  isVideo
                    ? 'ระบุลำดับเหตุการณ์หรือบทพูดในคลิป เช่น:\n- วินาที 0-3: โชว์ปัญหาหน้าหมองคล้ำ\n- วินาที 4-15: โชว์สินค้าและวิธีใช้\n- วินาที 16-30: สรุปโปรโมชั่นและ CTA หรือสิ่งที่ห้ามใส่ในวิดีโอ'
                    : 'อธิบายภาพรวมที่ต้องการ เช่น อยากให้สินค้าอยู่ตรงกลาง มีแสงเงาดูพรีเมียม ตัวหนังสืออ่านง่ายบนมือถือ...'
                }
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </section>

          {/* Section 3: References & Deadline */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                {isVideo
                  ? 'ส่วนที่ 3: ไฟล์ Reference / ลิงก์ฟุตเทจ & กำหนดส่งงาน'
                  : 'ส่วนที่ 3: ภาพตัวอย่าง (Reference) & กำหนดส่งงาน'}
              </h3>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {isVideo
                  ? 'แนบภาพตัวอย่าง / สตอรี่บอร์ด / โลโก้ / แคปหน้าจอวิดีโอตัวอย่าง (สูงสุด 3 ภาพ)'
                  : 'แนบภาพตัวอย่าง / โลโก้ / ภาพสินค้า (สูงสุด 3 ภาพ)'}
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {referenceImages.map((img) => (
                  <div
                    key={img.id}
                    className="group relative h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setReferenceImages((prev) =>
                          prev.filter((item) => item.id !== img.id)
                        )
                      }
                      className="absolute right-1 top-1 rounded-lg bg-slate-900/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {referenceImages.length < 3 && (
                  <label className="flex h-24 w-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 text-xs font-semibold text-slate-500 transition hover:border-indigo-400 hover:bg-indigo-50/40 hover:text-indigo-600">
                    <ImagePlus className="mb-1 h-5 w-5" />
                    <span>{uploadingImage ? 'กำลังย่อภาพ...' : 'อัปโหลดรูปภาพ'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Link2 className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  {isVideo
                    ? 'ลิงก์คลิป Reference (TikTok, YouTube) หรือ Google Drive วิดีโอฟุตเทจ/สคริปต์'
                    : 'ลิงก์ Reference หรือ Google Drive โลโก้/ไฟล์สินค้า (ถ้ามี)'}
                </span>
              </label>
              <input
                type="url"
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                placeholder={
                  isVideo
                    ? 'https://drive.google.com/... หรือ https://www.tiktok.com/@... หรือ ลิงก์ YouTube'
                    : 'https://drive.google.com/... หรือ https://pinterest.com/...'
                }
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  วันที่ต้องการรับงาน (Deadline)
                </label>
                <input
                  type="date"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  ความเร่งด่วน
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'normal' as OrderUrgency, label: 'ปกติ (3-5 วัน)' },
                    { value: 'urgent' as OrderUrgency, label: 'ด่วน (1-2 วัน)' },
                    { value: 'express' as OrderUrgency, label: 'ด่วนมาก (24ชม.)' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setUrgency(opt.value)}
                      className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                        urgency === opt.value
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploadingImage}
            className={`rounded-xl px-5 py-2 text-sm font-bold text-white shadow-md transition disabled:opacity-60 ${
              isVideo
                ? 'bg-violet-600 shadow-violet-600/20 hover:bg-violet-700'
                : 'bg-indigo-600 shadow-indigo-600/20 hover:bg-indigo-700'
            }`}
          >
            {submitting
              ? 'กำลังส่งบรีฟ...'
              : isVideo
                ? 'ส่งบรีฟสั่งงานวิดีโอ (Video Brief)'
                : 'ส่งบรีฟสั่งงาน Artwork'}
          </button>
        </div>
      </div>
    </div>
  );
};
