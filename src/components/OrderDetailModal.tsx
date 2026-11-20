import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  FileText,
  Receipt,
  Image as ImageIcon,
  MessageSquare,
  ExternalLink,
  Upload,
  CheckCircle2,
  RotateCcw,
  Download,
  Send,
  Sparkles,
  Trash2,
  Clock,
  AlertTriangle,
  UserCheck,
  Video,
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { compressImageToDataUrl, generateSampleArtworkDataUrl } from '../lib/imageUtils';
import { sendExternalWebhookNotification } from '../lib/notifications';
import {
  ArtworkDraft,
  ArtworkOrder,
  ORDER_STATUS_META,
  OrderComment,
  OrderStatus,
  PAYMENT_STATUS_META,
  URGENCY_META,
  UserProfile,
  isVideoOrder,
} from '../types/briefbox';

interface OrderDetailModalProps {
  order: ArtworkOrder;
  profile: UserProfile;
  onClose: () => void;
}

type DetailTab = 'brief' | 'quotation' | 'drafts' | 'chat';

const TIMELINE_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'pending_quote', label: 'รอประเมินราคา' },
  { key: 'quoted', label: 'แจ้งราคา/รอชำระ' },
  { key: 'in_queue', label: 'ในคิวงาน' },
  { key: 'designing', label: 'กำลังออกแบบ' },
  { key: 'review', label: 'ตรวจดราฟต์' },
  { key: 'completed', label: 'เสร็จสมบูรณ์' },
];

function getTimelineIndex(status: OrderStatus): number {
  if (status === 'revision') return 3; // back to designing/revision phase
  if (status === 'cancelled') return -1;
  return TIMELINE_STEPS.findIndex((s) => s.key === status);
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  profile,
  onClose,
}) => {
  const isAdmin = profile.role === 'admin';
  const isDesigner = profile.role === 'designer';
  const isStaff = isAdmin || isDesigner;
  const [activeTab, setActiveTab] = useState<DetailTab>('brief');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Admin: Status & Designer
  const [designerInput, setDesignerInput] = useState(order.assignedDesigner || '');
  const [statusInput, setStatusInput] = useState<OrderStatus>(order.status);

  // Admin: Quotation
  const [quotePriceInput, setQuotePriceInput] = useState(
    order.quotedPrice ? String(order.quotedPrice) : ''
  );
  const [maxRevisionsInput, setMaxRevisionsInput] = useState(
    String(order.maxRevisions || 3)
  );
  const [quoteNoteInput, setQuoteNoteInput] = useState(
    order.quoteNote ||
      'ธนาคารกสิกรไทย เลขที่ 012-3-45678-9 บจก. บรีฟบ็อกซ์ สตูดิโอ หรือ พร้อมเพย์ 089-999-8888'
  );

  // Customer: Slip upload
  const [uploadingSlip, setUploadingSlip] = useState(false);

  // Admin: Draft upload
  const [draftImageUrl, setDraftImageUrl] = useState('');
  const [draftExternalLink, setDraftExternalLink] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [uploadingDraftImg, setUploadingDraftImg] = useState(false);

  // Admin: Final deliverable
  const [finalUrlInput, setFinalUrlInput] = useState(order.finalDeliverableUrl || '');
  const [finalNoteInput, setFinalNoteInput] = useState(order.finalNote || '');
  const [finalPreviewInput, setFinalPreviewInput] = useState(order.finalPreviewImage || '');

  // Customer: Revision request
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionComment, setRevisionComment] = useState('');

  // Chat
  const [chatMessage, setChatMessage] = useState('');
  const [chatAttachment, setChatAttachment] = useState('');

  const orderRef = doc(db, 'orders', order.id);
  const statusMeta = ORDER_STATUS_META[order.status];
  const paymentMeta = PAYMENT_STATUS_META[order.paymentStatus];
  const urgencyMeta = URGENCY_META[order.urgency];
  const currentStepIndex = getTimelineIndex(order.status);

  const copyText = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  const handleAdminUpdateMeta = async () => {
    setSaving(true);
    try {
      await updateDoc(orderRef, {
        assignedDesigner: designerInput.trim(),
        status: statusInput,
        updatedAt: new Date().toISOString(),
      });
      showToast('อัปเดตสถานะและผู้รับผิดชอบงานเรียบร้อย');
    } catch (err: unknown) {
      showToast(`❌ ข้อผิดพลาด: ${(err as Error)?.message || 'ไม่สามารถอัปเดตได้'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAdminDeleteOrder = async () => {
    if (!window.confirm(`ยืนยันการลบออเดอร์ ${order.orderNumber} ใช่หรือไม่?`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteDoc(orderRef);
      onClose();
    } catch (err: unknown) {
      showToast(`❌ ข้อผิดพลาด: ${(err as Error)?.message || 'ไม่สามารถลบออเดอร์ได้'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAdminSendQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = Number(quotePriceInput);
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      showToast('กรุณาระบุราคาประเมินมากกว่า 0 บาท');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(orderRef, {
        quotedPrice: numericPrice,
        maxRevisions: Math.max(1, Number(maxRevisionsInput) || 3),
        quoteNote: quoteNoteInput.trim(),
        status: order.status === 'pending_quote' ? 'quoted' : order.status,
        updatedAt: new Date().toISOString(),
      });
      if (order.status === 'pending_quote') setStatusInput('quoted');
      showToast('ส่งใบเสนอราคาให้ลูกค้าเรียบร้อยแล้ว');
    } catch (err: unknown) {
      showToast(`❌ ข้อผิดพลาด: ${(err as Error)?.message || 'ไม่สามารถส่งใบเสนอราคาได้'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCustomerSlipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSlip(true);
    try {
      const slipDataUrl = await compressImageToDataUrl(file, 900, 0.72);
      await updateDoc(orderRef, {
        paymentSlipUrl: slipDataUrl,
        paymentStatus: 'pending_verification',
        paymentPaidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      void sendExternalWebhookNotification(
        `💳 [BriefBox] ลูกค้าแนบสลิปชำระเงินแล้ว!\n• รหัส: ${order.orderNumber} (${order.title})\n• ลูกค้า: ${order.customerName} (${order.customerBrand})\n• ยอดเสนอราคา: ฿${order.quotedPrice.toLocaleString()}`
      );
      showToast('แนบสลิปสำเร็จ! รอทีมงานตรวจสอบและรับเข้าคิวงาน');
    } catch (err: unknown) {
      showToast(`❌ ข้อผิดพลาด: ${(err as Error)?.message || 'ไม่สามารถอัปโหลดสลิปได้'}`);
    } finally {
      setUploadingSlip(false);
      e.target.value = '';
    }
  };

  const handleAdminConfirmPayment = async () => {
    setSaving(true);
    try {
      const nextStatus: OrderStatus =
        order.status === 'quoted' || order.status === 'pending_quote'
          ? 'in_queue'
          : order.status;
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        status: nextStatus,
        paymentPaidAt: order.paymentPaidAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setStatusInput(nextStatus);
      showToast('ยืนยันยอดชำระเงินและนำงานเข้าคิวเรียบร้อย');
    } catch (err: unknown) {
      showToast(`❌ ข้อผิดพลาด: ${(err as Error)?.message || 'ไม่สามารถยืนยันยอดชำระได้'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDraftFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDraftImg(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, 1000, 0.78);
      setDraftImageUrl(dataUrl);
    } catch (err: unknown) {
      showToast(`❌ ข้อผิดพลาด: ${(err as Error)?.message || 'ไม่สามารถประมวลผลรูปภาพได้'}`);
    } finally {
      setUploadingDraftImg(false);
      e.target.value = '';
    }
  };

  const handleGenerateSampleDraft = () => {
    const nextVersion = order.drafts.length + 1;
    const generated = generateSampleArtworkDataUrl({
      title: order.headlineText || order.title,
      brand: order.customerBrand || 'BriefBox',
      subtitle: order.subText || order.dimensions,
      accentColor: order.colorPalette[1] || '#4f46e5',
      bgColor: order.colorPalette[0] || '#0f172a',
      version: nextVersion,
    });
    setDraftImageUrl(generated);
    if (!draftNote) {
      setDraftNote(
        `ส่งดราฟต์ v${nextVersion} ตามโทนสี ${order.moodAndTone} ให้ลูกค้าตรวจสอบครับ`
      );
    }
  };

  const handleAdminSubmitDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftImageUrl && !draftExternalLink.trim()) {
      showToast('กรุณาอัปโหลดรูปดราฟต์หรือระบุลิงก์พรีวิว');
      return;
    }
    setSaving(true);
    try {
      const nextVersion = order.drafts.length + 1;
      const newDraft: ArtworkDraft = {
        version: nextVersion,
        imageUrl: draftImageUrl,
        externalLink: draftExternalLink.trim(),
        designerNote: draftNote.trim() || `ส่งดราฟต์ v${nextVersion} สำหรับตรวจสอบ`,
        submittedAt: new Date().toISOString(),
        status: 'pending_review',
      };
      await updateDoc(orderRef, {
        drafts: [...order.drafts, newDraft],
        status: 'review',
        assignedDesigner: order.assignedDesigner || profile.displayName,
        updatedAt: new Date().toISOString(),
      });
      setStatusInput('review');
      setDraftImageUrl('');
      setDraftExternalLink('');
      setDraftNote('');
      showToast(`ส่งดราฟต์ v${nextVersion} ให้ลูกค้าตรวจเรียบร้อย`);
    } catch (err: unknown) {
      showToast(`❌ ข้อผิดพลาด: ${(err as Error)?.message || 'ไม่สามารถส่งดราฟต์ได้'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCustomerApproveLatestDraft = async () => {
    if (order.drafts.length === 0) return;
    setSaving(true);
    try {
      const updatedDrafts = order.drafts.map((d, idx) =>
        idx === order.drafts.length - 1
          ? {
              ...d,
              status: 'approved' as const,
              reviewedAt: new Date().toISOString(),
              customerFeedback: 'อนุมัติผลงานเรียบร้อย',
            }
          : d
      );
      await updateDoc(orderRef, {
        drafts: updatedDrafts,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      });
      void sendExternalWebhookNotification(
        `✅ [BriefBox] ลูกค้าอนุมัติผลงานแล้ว!\n• รหัส: ${order.orderNumber} (${order.title})\n• ลูกค้า: ${order.customerName} (${order.customerBrand})`
      );
      setStatusInput('completed');
      showToast('อนุมัติผลงานเรียบร้อย! สถานะเปลี่ยนเป็นเสร็จสมบูรณ์');
    } catch (err: unknown) {
      showToast(`❌ ข้อผิดพลาด: ${(err as Error)?.message || 'ไม่สามารถอนุมัติได้'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCustomerRequestRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionComment.trim()) {
      showToast('กรุณาระบุรายละเอียดจุดที่ต้องการให้แก้ไข');
      return;
    }
    setSaving(true);
    try {
      const updatedDrafts = order.drafts.map((d, idx) =>
        idx === order.drafts.length - 1
          ? {
              ...d,
              status: 'revision_requested' as const,
              customerFeedback: revisionComment.trim(),
              reviewedAt: new Date().toISOString(),
            }
          : d
      );
      const commentObj: OrderComment = {
        id: `rev-${Date.now()}`,
        authorId: profile.uid,
        authorName: profile.displayName,
        authorRole: profile.role,
        message: `[ขอแก้ไขดราฟต์ v${order.drafts.length}] ${revisionComment.trim()}`,
        createdAt: new Date().toISOString(),
      };
      await updateDoc(orderRef, {
        drafts: updatedDrafts,
        usedRevisions: order.usedRevisions + 1,
        status: 'revision',
        comments: arrayUnion(commentObj),
        updatedAt: new Date().toISOString(),
      });
      void sendExternalWebhookNotification(
        `✏️ [BriefBox] ลูกค้าขอแก้ไขงาน (Revision ${order.usedRevisions + 1}/${order.maxRevisions})\n• รหัส: ${order.orderNumber} (${order.title})\n• ลูกค้า: ${order.customerName}\n• จุดที่ขอแก้: ${revisionComment.trim()}`
      );
      setStatusInput('revision');
      setShowRevisionForm(false);
      setRevisionComment('');
      showToast('ส่งคำขอแก้ไขงานให้ดีไซเนอร์เรียบร้อยแล้ว');
    } catch (err: unknown) {
      showToast(`❌ ข้อผิดพลาด: ${(err as Error)?.message || 'ไม่สามารถส่งคำขอแก้ไขได้'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAdminSaveFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const latestDraftImg = order.drafts[order.drafts.length - 1]?.imageUrl || '';
      await updateDoc(orderRef, {
        finalDeliverableUrl: finalUrlInput.trim(),
        finalPreviewImage: finalPreviewInput || order.finalPreviewImage || latestDraftImg,
        finalNote: finalNoteInput.trim() || 'ส่งมอบไฟล์ Artwork ฉบับสมบูรณ์เรียบร้อย',
        status: 'completed',
        updatedAt: new Date().toISOString(),
      });
      setStatusInput('completed');
      showToast('ส่งมอบไฟล์ไฟนอลและปิดงานเสร็จสมบูรณ์แล้ว');
    } catch (err: unknown) {
      showToast(`❌ ข้อผิดพลาด: ${(err as Error)?.message || 'ไม่สามารถส่งมอบงานได้'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() && !chatAttachment) return;
    setSaving(true);
    try {
      const newComment: OrderComment = {
        id: `msg-${Date.now()}`,
        authorId: profile.uid,
        authorName: profile.displayName,
        authorRole: profile.role,
        message: chatMessage.trim(),
        ...(chatAttachment ? { attachmentUrl: chatAttachment } : {}),
        createdAt: new Date().toISOString(),
      };
      await updateDoc(orderRef, {
        comments: arrayUnion(newComment),
        updatedAt: new Date().toISOString(),
      });
      if (profile.role === 'customer') {
        void sendExternalWebhookNotification(
          `💬 [BriefBox] ข้อความใหม่จากลูกค้า (${order.customerName})\n• งาน: ${order.orderNumber} (${order.title})\n• ข้อความ: ${chatMessage.trim() || '[ส่งรูปภาพประกอบ]'}`
        );
      }
      setChatMessage('');
      setChatAttachment('');
    } catch (err: unknown) {
      showToast(`❌ ข้อผิดพลาด: ${(err as Error)?.message || 'ไม่สามารถส่งข้อความได้'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChatImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressImageToDataUrl(file, 700, 0.7);
    setChatAttachment(dataUrl);
    e.target.value = '';
  };

  const latestDraft =
    order.drafts.length > 0 ? order.drafts[order.drafts.length - 1] : null;
  const reversedDrafts = [...order.drafts].reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-2 backdrop-blur-xs sm:p-5">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Top Modal Header */}
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                  {order.orderNumber}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.badgeClass}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
                  {statusMeta.label}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${urgencyMeta.badgeClass}`}>
                  {urgencyMeta.label}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${paymentMeta.badgeClass}`}
                >
                  {paymentMeta.label}
                </span>
              </div>
              <h2 className="mt-2 truncate text-lg font-extrabold text-slate-900 sm:text-xl">
                {order.title}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                แบรนด์: <strong className="text-slate-700">{order.customerBrand || '-'}</strong> • ลูกค้า:{' '}
                <strong className="text-slate-700">{order.customerName}</strong> • กำหนดส่ง:{' '}
                <strong className="text-indigo-700">{order.deadline}</strong>
                {order.assignedDesigner && (
                  <>
                    {' '}
                    • ผู้รับผิดชอบ:{' '}
                    <strong className="text-violet-700">{order.assignedDesigner}</strong>
                  </>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 6-step Progress Timeline */}
          {order.status !== 'cancelled' && (
            <div className="mt-4 hidden grid-cols-6 gap-2 sm:grid">
              {TIMELINE_STEPS.map((step, idx) => {
                const isDone = idx < currentStepIndex || order.status === 'completed';
                const isCurrent = idx === currentStepIndex && order.status !== 'completed';
                return (
                  <div key={step.key} className="flex flex-col items-center">
                    <div className="flex w-full items-center">
                      <div
                        className={`h-1.5 flex-1 rounded-full ${
                          idx === 0
                            ? 'bg-transparent'
                            : isDone || isCurrent
                              ? 'bg-indigo-600'
                              : 'bg-slate-200'
                        }`}
                      />
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          isDone
                            ? 'bg-emerald-500 text-white'
                            : isCurrent
                              ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                              : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                      </div>
                      <div
                        className={`h-1.5 flex-1 rounded-full ${
                          idx === TIMELINE_STEPS.length - 1
                            ? 'bg-transparent'
                            : isDone
                              ? 'bg-indigo-600'
                              : 'bg-slate-200'
                        }`}
                      />
                    </div>
                    <span
                      className={`mt-1.5 text-center text-[11px] font-semibold ${
                        isCurrent
                          ? 'text-indigo-700'
                          : isDone
                            ? 'text-emerald-700'
                            : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-200/70 pt-3">
            {[
              {
                id: 'brief' as DetailTab,
                label: 'รายละเอียดบรีฟ',
                icon: FileText,
              },
              {
                id: 'quotation' as DetailTab,
                label: `ใบเสนอราคา & ชำระเงิน${
                  order.quotedPrice > 0 ? ` (฿${order.quotedPrice.toLocaleString()})` : ''
                }`,
                icon: Receipt,
              },
              {
                id: 'drafts' as DetailTab,
                label: `ส่งดราฟต์ & แก้งาน (${order.drafts.length})`,
                icon: ImageIcon,
              },
              {
                id: 'chat' as DetailTab,
                label: `พูดคุยงาน (${order.comments.length})`,
                icon: MessageSquare,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toast Banner */}
        {feedbackMsg && (
          <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-2.5 text-xs font-semibold text-emerald-800">
            ✓ {feedbackMsg}
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {/* TAB 1: BRIEF DETAILS */}
          {activeTab === 'brief' && (
            <div className="space-y-6">
              {isStaff && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-900">
                      <UserCheck className="h-4 w-4" />
                      {isAdmin
                        ? 'เครื่องมือแอดมิน: อัปเดตคิวงาน & มอบหมายดีไซเนอร์'
                        : 'เครื่องมือดีไซเนอร์: อัปเดตคิวงาน & รับผิดชอบงาน'}
                    </h3>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleAdminDeleteOrder}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        ลบออเดอร์
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-violet-900">
                        สถานะงานปัจจุบัน
                      </label>
                      <select
                        value={statusInput}
                        onChange={(e) => setStatusInput(e.target.value as OrderStatus)}
                        className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-violet-500"
                      >
                        {Object.entries(ORDER_STATUS_META).map(([key, meta]) => (
                          <option key={key} value={key}>
                            {meta.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-violet-900">
                        ชื่อดีไซเนอร์ผู้รับผิดชอบ
                      </label>
                      <input
                        type="text"
                        value={designerInput}
                        onChange={(e) => setDesignerInput(e.target.value)}
                        placeholder="เช่น Designer มินท์"
                        className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleAdminUpdateMeta}
                        className="w-full rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
                      >
                        {saving ? 'กำลังบันทึก...' : 'บันทึกสถานะงาน'}
                      </button>
                    </div>
                  </div>

                  {order.drafts.length === 0 && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-300 bg-white p-3 text-xs text-violet-900 shadow-xs">
                      <div>
                        <span className="font-bold">🎨 ต้องการส่งไฟล์ภาพดราฟต์ให้ลูกค้าตรวจ?</span>
                        <p className="text-[11px] text-violet-700">
                          สามารถอัปโหลดรูปภาพงาน หรือวางลิงก์ Figma/Canva เพื่อให้ลูกค้าดูและกดอนุมัติได้ที่แท็บ "ส่งดราฟต์ & แก้งาน"
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('drafts')}
                        className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 font-bold text-white shadow-xs transition hover:bg-violet-700"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>ไปหน้าส่งดราฟต์ →</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Specs Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-[11px] font-semibold text-slate-500">ประเภทงาน</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-900">
                    {isVideoOrder(order.artworkType) && (
                      <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-bold text-violet-700">
                        <Video className="h-3 w-3" /> วิดีโอ
                      </span>
                    )}
                    <span>{order.artworkType}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-[11px] font-semibold text-slate-500">
                    {isVideoOrder(order.artworkType) ? 'สัดส่วนวิดีโอ' : 'ขนาด / สัดส่วน'}
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    {order.dimensions}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-[11px] font-semibold text-slate-500">Mood & Tone</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    {order.moodAndTone}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-[11px] font-semibold text-slate-500">
                    ไฟล์ที่ลูกค้าต้องการ
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {order.fileFormats.map((fmt) => (
                      <span
                        key={fmt}
                        className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200"
                      >
                        {fmt}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Copywriting / Video Brief Box */}
              <div className="rounded-2xl border border-slate-200 p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  {isVideoOrder(order.artworkType)
                    ? 'รายละเอียดคอนเทนต์ & สคริปต์ (Video Brief)'
                    : 'ข้อความที่ต้องการใส่ในภาพ (Copywriting)'}
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500">
                        {isVideoOrder(order.artworkType)
                          ? 'Hook 3 วินาทีแรก / ข้อความเปิดคลิป (Hook / Intro)'
                          : 'ข้อความหลัก (Headline)'}
                      </span>
                      {order.headlineText && (
                        <button
                          type="button"
                          onClick={() => copyText('headline', order.headlineText)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          {copiedField === 'headline' ? (
                            <>
                              <Check className="h-3 w-3" /> คัดลอกแล้ว
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> คัดลอก
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-slate-900">
                      {order.headlineText || '- ไม่ได้ระบุ -'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500">
                        {isVideoOrder(order.artworkType)
                          ? 'Call to Action / ข้อความปิดท้ายคลิป (Outro / CTA)'
                          : 'ข้อความรอง / รายละเอียด'}
                      </span>
                      {order.subText && (
                        <button
                          type="button"
                          onClick={() => copyText('subtext', order.subText)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          {copiedField === 'subtext' ? (
                            <>
                              <Check className="h-3 w-3" /> คัดลอกแล้ว
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> คัดลอก
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-slate-800">
                      {order.subText || '- ไม่ได้ระบุ -'}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {isVideoOrder(order.artworkType)
                      ? 'สคริปต์ & รายละเอียดบรีฟวิดีโอเพิ่มเติม'
                      : 'รายละเอียดบรีฟเพิ่มเติม'}
                  </span>
                  <p className="mt-1 whitespace-pre-line rounded-xl bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-700">
                    {order.briefDetails || '- ไม่มีรายละเอียดเพิ่มเติม -'}
                  </p>
                </div>

                {/* Color Palette */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    โทนสีที่กำหนด
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {order.colorPalette.map((color) => (
                      <div
                        key={color}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-700"
                      >
                        <span
                          className="h-4 w-4 rounded-md border border-slate-200"
                          style={{ backgroundColor: color }}
                        />
                        <span>{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* References & Customer Contact */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="text-xs font-bold text-slate-800">
                    ภาพ Reference & ลิงก์แนบ
                  </h4>
                  {order.referenceUrl && (
                    <a
                      href={order.referenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      เปิดลิงก์ Reference ภายนอก
                    </a>
                  )}
                  {order.referenceImages.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {order.referenceImages.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setLightboxImage(img.dataUrl)}
                          className="group relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200"
                        >
                          <img
                            src={img.dataUrl}
                            alt={img.name}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                        </button>
                      ))}
                    </div>
                  ) : (
                    !order.referenceUrl && (
                      <p className="mt-2 text-xs text-slate-400">
                        ลูกค้าไม่ได้แนบภาพ Reference เพิ่มเติม
                      </p>
                    )
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="text-xs font-bold text-slate-800">
                    ข้อมูลติดต่อลูกค้า
                  </h4>
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    <p>
                      ผู้สั่งงาน: <strong className="text-slate-900">{order.customerName}</strong>
                    </p>
                    <p>
                      แบรนด์/บริษัท:{' '}
                      <strong className="text-slate-900">{order.customerBrand}</strong>
                    </p>
                    <p>
                      ช่องทางติดต่อ:{' '}
                      <strong className="text-slate-900">
                        {order.customerContact || '-'}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: QUOTATION & PAYMENT */}
          {activeTab === 'quotation' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Quotation Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      ใบเสนอราคา (Quotation)
                    </h3>
                    <p className="text-xs text-slate-500">
                      เลขอ้างอิง: {order.orderNumber}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-bold ${paymentMeta.badgeClass}`}
                  >
                    {paymentMeta.label}
                  </span>
                </div>

                {order.quotedPrice > 0 ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-baseline justify-between rounded-2xl bg-indigo-50/70 p-4">
                      <span className="text-xs font-semibold text-indigo-900">
                        ยอดรวมค่าออกแบบ Artwork
                      </span>
                      <span className="text-2xl font-extrabold text-indigo-700">
                        ฿{order.quotedPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>โควตาแก้ไขงานฟรี (Revision)</span>
                      <strong className="text-slate-900">
                        {order.maxRevisions} ครั้ง
                      </strong>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
                      <div className="font-bold text-slate-900 mb-1">
                        ช่องทางชำระเงิน / หมายเหตุ:
                      </div>
                      {order.quoteNote || '-'}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <Clock className="mx-auto h-7 w-7 text-slate-400" />
                    <p className="mt-2 text-sm font-bold text-slate-700">
                      อยู่ระหว่างรอแอดมินประเมินราคา
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      ทีมงานจะตรวจสอบความซับซ้อนของบรีฟและแจ้งราคาให้ทราบโดยเร็ว
                    </p>
                  </div>
                )}

                {isStaff && (
                  <form
                    onSubmit={handleAdminSendQuote}
                    className="mt-5 space-y-3 border-t border-slate-100 pt-4"
                  >
                    <h4 className="text-xs font-bold text-violet-800">
                      [{isAdmin ? 'แอดมิน' : 'ดีไซเนอร์'}] กำหนด / แก้ไขใบเสนอราคา
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                          ราคาออกแบบ (บาท)
                        </label>
                        <input
                          type="number"
                          min={0}
                          required
                          value={quotePriceInput}
                          onChange={(e) => setQuotePriceInput(e.target.value)}
                          placeholder="1500"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                          สิทธิ์แก้งานฟรี (ครั้ง)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={maxRevisionsInput}
                          onChange={(e) => setMaxRevisionsInput(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                        เลขบัญชีโอนเงิน / เงื่อนไขใบเสนอราคา
                      </label>
                      <textarea
                        rows={2}
                        value={quoteNoteInput}
                        onChange={(e) => setQuoteNoteInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {order.quotedPrice > 0 ? 'อัปเดตใบเสนอราคา' : 'ส่งใบเสนอราคาให้ลูกค้า'}
                    </button>
                  </form>
                )}
              </div>

              {/* Payment Slip Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
                  แจ้งชำระเงิน & หลักฐานสลิปโอนเงิน
                </h3>

                {order.paymentSlipUrl ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-600">
                      ภาพสลิปที่ลูกค้าแนบไว้:
                    </p>
                    <button
                      type="button"
                      onClick={() => setLightboxImage(order.paymentSlipUrl)}
                      className="block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={order.paymentSlipUrl}
                        alt="Payment slip"
                        className="mx-auto max-h-64 object-contain"
                      />
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                    ยังไม่มีหลักฐานสลิปการโอนเงินในระบบ
                  </div>
                )}

                {order.paymentStatus !== 'paid' && order.quotedPrice > 0 && (
                  <div className="mt-4">
                    <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 py-3 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50">
                      <Upload className="h-4 w-4" />
                      <span>
                        {uploadingSlip
                          ? 'กำลังอัปโหลดสลิป...'
                          : order.paymentSlipUrl
                            ? 'อัปโหลดสลิปใหม่แทนของเดิม'
                            : 'แนบสลิปโอนเงินเพื่อยืนยันคิวงาน'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCustomerSlipUpload}
                        disabled={uploadingSlip}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {isStaff && order.paymentStatus !== 'paid' && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleAdminConfirmPayment}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>[{isAdmin ? 'แอดมิน' : 'ดีไซเนอร์'}] ยืนยันรับยอดชำระ & นำเข้าคิวงาน (In Queue)</span>
                  </button>
                )}

                {order.paymentStatus === 'paid' && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>ยืนยันการชำระเงินเรียบร้อยแล้ว</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DRAFTS, REVISIONS & FINAL FILES */}
          {activeTab === 'drafts' && (
            <div className="space-y-6">
              {/* Revision Quota Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <RotateCcw className="h-4 w-4 text-indigo-600" />
                  <span>
                    สิทธิ์การแก้ไขงาน (Revision): ใช้ไป {order.usedRevisions} /{' '}
                    {order.maxRevisions} ครั้ง
                  </span>
                </div>
                {order.usedRevisions >= order.maxRevisions && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                    <AlertTriangle className="h-3 w-3" /> ครบโควตาแก้ไขฟรีแล้ว
                  </span>
                )}
              </div>

              {/* Final Deliverable Box (when completed) */}
              {order.status === 'completed' && (
                <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-emerald-950">
                          งานเสร็จสมบูรณ์ — พร้อมดาวน์โหลดไฟล์ไฟนอล (Final Artwork)
                        </h3>
                        <p className="text-xs text-emerald-800">
                          {order.finalNote || 'ขอบคุณที่ไว้วางใจใช้บริการ BriefBox Studio'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(order.finalPreviewImage || latestDraft?.imageUrl) && (
                        <a
                          href={order.finalPreviewImage || latestDraft?.imageUrl}
                          download={`${order.orderNumber}-final.jpg`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                        >
                          <Download className="h-4 w-4" />
                          ดาวน์โหลดภาพไฟนอล
                        </a>
                      )}
                      {order.finalDeliverableUrl && (
                        <a
                          href={order.finalDeliverableUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                        >
                          <ExternalLink className="h-4 w-4" />
                          เปิดลิงก์ไฟล์ต้นฉบับ (AI/PSD/PDF)
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Admin/Designer: Upload Draft & Deliver Final */}
              {isStaff && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <form
                    onSubmit={handleAdminSubmitDraft}
                    className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 space-y-3"
                  >
                    <h3 className="text-xs font-bold text-violet-900">
                      [แอดมิน/ดีไซเนอร์] ส่งดราฟต์งาน v{order.drafts.length + 1} ให้ลูกค้าตรวจ
                    </h3>

                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50">
                        <Upload className="h-3.5 w-3.5" />
                        <span>
                          {uploadingDraftImg ? 'กำลังย่อภาพ...' : 'อัปโหลดรูปดราฟต์'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleDraftFileSelect}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateSampleDraft}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        สร้างภาพตัวอย่างอัตโนมัติ (Demo)
                      </button>
                    </div>

                    {draftImageUrl && (
                      <div className="relative overflow-hidden rounded-xl border border-violet-200 bg-white p-2">
                        <img
                          src={draftImageUrl}
                          alt="Draft preview"
                          className="mx-auto max-h-40 rounded-lg object-contain"
                        />
                      </div>
                    )}

                    <input
                      type="url"
                      value={draftExternalLink}
                      onChange={(e) => setDraftExternalLink(e.target.value)}
                      placeholder="หรือวางลิงก์ Canva / Figma / Google Drive (ไม่บังคับ)"
                      className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-500"
                    />

                    <textarea
                      rows={2}
                      value={draftNote}
                      onChange={(e) => setDraftNote(e.target.value)}
                      placeholder="โน้ตถึงลูกค้า เช่น ส่งดราฟต์แรกให้ตรวจโทนสีและการจัดวางครับ"
                      className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-500"
                    />

                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full rounded-xl bg-violet-600 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      ส่งดราฟต์ v{order.drafts.length + 1} ให้ลูกค้าตรวจ
                    </button>
                  </form>

                  <form
                    onSubmit={handleAdminSaveFinal}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3"
                  >
                    <h3 className="text-xs font-bold text-emerald-900">
                      [แอดมิน] ส่งมอบไฟล์ไฟนอล (Final Files) & ปิดงาน
                    </h3>
                    <input
                      type="url"
                      value={finalUrlInput}
                      onChange={(e) => setFinalUrlInput(e.target.value)}
                      placeholder="ลิงก์ดาวน์โหลดไฟล์ต้นฉบับ (Google Drive / Dropbox)"
                      className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500"
                    />
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">
                        <Upload className="h-3.5 w-3.5" />
                        <span>อัปโหลดภาพ Final (ถ้ามี)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              const url = await compressImageToDataUrl(f, 1100, 0.85);
                              setFinalPreviewInput(url);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      {finalPreviewInput && (
                        <span className="text-[11px] font-semibold text-emerald-700">
                          ✓ แนบภาพ Final แล้ว
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      value={finalNoteInput}
                      onChange={(e) => setFinalNoteInput(e.target.value)}
                      placeholder="ข้อความส่งมอบงาน เช่น แนบครบทั้ง PNG, JPG และ PDF CMYK ครับ"
                      className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      บันทึกส่งมอบงานเสร็จสมบูรณ์
                    </button>
                  </form>
                </div>
              )}

              {/* Draft List */}
              {reversedDrafts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                  <ImageIcon className="mx-auto h-9 w-9 text-slate-300" />
                  <p className="mt-2 text-sm font-bold text-slate-700">
                    {order.status === 'review'
                      ? 'กำลังจัดเตรียมไฟล์ดราฟต์ภาพ'
                      : 'ยังไม่มีดราฟต์งานถูกส่งเข้ามา'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {isStaff
                      ? 'คุณสามารถอัปโหลดภาพ หรือวางลิงก์ Figma/Canva/Drive ในกล่องแบบฟอร์มด้านบน แล้วกดปุ่ม "ส่งดราฟต์ v1 ให้ลูกค้าตรวจ" ได้เลยครับ'
                      : order.status === 'review'
                        ? 'ดีไซเนอร์กำลังอัปโหลดไฟล์ภาพดราฟต์เข้าระบบ เมื่อเสร็จแล้วภาพจะปรากฏที่นี่เพื่อให้คุณกดอนุมัติหรือขอแก้ไขครับ'
                        : 'เมื่อดีไซเนอร์ออกแบบเสร็จ ดราฟต์ภาพจะแสดงที่นี่เพื่อให้คุณตรวจและสั่งแก้ไข'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reversedDrafts.map((draft) => {
                    const isLatest = latestDraft && draft.version === latestDraft.version;
                    return (
                      <div
                        key={draft.version}
                        className={`rounded-2xl border p-5 ${
                          isLatest
                            ? 'border-indigo-200 bg-white shadow-sm'
                            : 'border-slate-200 bg-slate-50/60'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">
                              Draft v{draft.version}
                            </span>
                            <span className="text-xs text-slate-500">
                              ส่งเมื่อ{' '}
                              {new Date(draft.submittedAt).toLocaleString('th-TH', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              draft.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-700'
                                : draft.status === 'revision_requested'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {draft.status === 'approved'
                              ? 'อนุมัติแล้ว ✓'
                              : draft.status === 'revision_requested'
                                ? 'ลูกค้าขอแก้ไข'
                                : 'รอลูกค้าตรวจสอบ'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                          <div className="md:col-span-5">
                            {draft.imageUrl ? (
                              <button
                                type="button"
                                onClick={() => setLightboxImage(draft.imageUrl)}
                                className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                              >
                                <img
                                  src={draft.imageUrl}
                                  alt={`Draft v${draft.version}`}
                                  className="w-full max-h-72 object-contain transition hover:scale-[1.02]"
                                />
                              </button>
                            ) : (
                              <div className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs text-slate-500">
                                ส่งเป็นลิงก์ภายนอก
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col justify-between md:col-span-7 space-y-3">
                            <div className="space-y-3">
                              <div className="rounded-xl bg-slate-50 p-3.5">
                                <div className="text-[11px] font-semibold text-slate-500">
                                  โน้ตจากดีไซเนอร์:
                                </div>
                                <p className="mt-1 text-sm text-slate-800">
                                  {draft.designerNote}
                                </p>
                              </div>

                              {draft.externalLink && (
                                <a
                                  href={draft.externalLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  เปิดลิงก์พรีวิวดราฟต์
                                </a>
                              )}

                              {draft.customerFeedback && (
                                <div
                                  className={`rounded-xl border p-3.5 ${
                                    draft.status === 'approved'
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                      : 'border-rose-200 bg-rose-50 text-rose-900'
                                  }`}
                                >
                                  <div className="text-[11px] font-bold">
                                    ฟีดแบ็กจากลูกค้า:
                                  </div>
                                  <p className="mt-1 text-xs leading-relaxed">
                                    {draft.customerFeedback}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Customer Review Controls on Latest Pending Draft */}
                            {isLatest && draft.status === 'pending_review' && (
                              <div className="border-t border-slate-100 pt-3">
                                {!showRevisionForm ? (
                                  <div className="flex flex-wrap gap-2.5">
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={handleCustomerApproveLatestDraft}
                                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                      อนุมัติผลงานดราฟต์นี้ (Approve)
                                    </button>
                                    <button
                                      type="button"
                                      disabled={order.usedRevisions >= order.maxRevisions}
                                      onClick={() => setShowRevisionForm(true)}
                                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                      title={
                                        order.usedRevisions >= order.maxRevisions
                                          ? 'ใช้สิทธิ์แก้งานครบโควตาแล้ว กรุณาแจ้งแอดมินผ่านช่องพูดคุยงาน'
                                          : undefined
                                      }
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                      {order.usedRevisions >= order.maxRevisions
                                        ? 'ครบโควตาแก้งานแล้ว'
                                        : 'ขอแก้ไขงาน (Request Revision)'}
                                    </button>
                                  </div>
                                ) : (
                                  <form
                                    onSubmit={handleCustomerRequestRevision}
                                    className="space-y-2.5 rounded-xl border border-rose-200 bg-rose-50/60 p-3.5"
                                  >
                                    <label className="block text-xs font-bold text-rose-900">
                                      ระบุรายละเอียดจุดที่ต้องการแก้ไข (จะนับเป็น Revision ครั้งที่{' '}
                                      {order.usedRevisions + 1})
                                    </label>
                                    <textarea
                                      rows={3}
                                      required
                                      value={revisionComment}
                                      onChange={(e) => setRevisionComment(e.target.value)}
                                      placeholder="เช่น อยากให้ขยายหัวข้อโปรโมชั่นให้ใหญ่ขึ้น 20% และเปลี่ยนสีปุ่มเป็นสีส้ม..."
                                      className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs outline-none focus:border-rose-500"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setShowRevisionForm(false)}
                                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white"
                                      >
                                        ยกเลิก
                                      </button>
                                      <button
                                        type="submit"
                                        disabled={saving}
                                        className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                                      >
                                        ส่งคำขอแก้ไขงาน
                                      </button>
                                    </div>
                                  </form>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: COMMENTS / CHAT */}
          {activeTab === 'chat' && (
            <div className="flex h-[52vh] flex-col rounded-2xl border border-slate-200 bg-slate-50/50">
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {order.comments.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                    <MessageSquare className="mb-2 h-8 w-8 opacity-40" />
                    <p className="text-xs font-semibold">
                      ยังไม่มีข้อความพูดคุยในออเดอร์นี้
                    </p>
                    <p className="text-[11px]">
                      พิมพ์สอบถามหรือส่งข้อมูลเพิ่มเติมถึงดีไซเนอร์ได้เลย
                    </p>
                  </div>
                ) : (
                  order.comments.map((c) => {
                    const isMe = c.authorId === profile.uid;
                    return (
                      <div
                        key={c.id}
                        className={`flex flex-col ${
                          isMe ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-bold text-slate-700">{c.authorName}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              c.authorRole === 'admin'
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-sky-100 text-sky-700'
                            }`}
                          >
                            {c.authorRole === 'admin' ? 'ทีมกราฟิก' : 'ลูกค้า'}
                          </span>
                        </div>
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-xs ${
                            isMe
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-200 bg-white text-slate-800'
                          }`}
                        >
                          {c.message && <p className="whitespace-pre-line">{c.message}</p>}
                          {c.attachmentUrl && (
                            <button
                              type="button"
                              onClick={() => setLightboxImage(c.attachmentUrl!)}
                              className="mt-2 block overflow-hidden rounded-xl border border-white/20"
                            >
                              <img
                                src={c.attachmentUrl}
                                alt="Attachment"
                                className="max-h-48 object-contain"
                              />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={handleSendComment}
                className="border-t border-slate-200 bg-white p-3 rounded-b-2xl"
              >
                {chatAttachment && (
                  <div className="mb-2 flex items-center gap-2">
                    <img
                      src={chatAttachment}
                      alt="Preview"
                      className="h-12 w-12 rounded-lg object-cover border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setChatAttachment('')}
                      className="text-xs font-semibold text-rose-600"
                    >
                      ลบรูปที่แนบ
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 hover:text-indigo-600">
                    <Upload className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleChatImageSelect}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="พิมพ์ข้อความพูดคุยหรือแจ้งข้อมูลเพิ่มเติม..."
                    className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={saving || (!chatMessage.trim() && !chatAttachment)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    ส่ง
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Image Preview */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Full preview"
            className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
