import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ArtworkOrder, UserProfile } from '../types/briefbox';
import { generateSampleArtworkDataUrl } from './imageUtils';

export async function seedDemoOrdersForUser(profile: UserProfile): Promise<number> {
  const now = new Date();
  const daysFromNow = (days: number) => {
    const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  };
  const hoursAgo = (hours: number) => {
    return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
  };

  const draftBloomV1 = generateSampleArtworkDataUrl({
    title: 'SUMMER MATCHA LATTE 1 FREE 1',
    brand: 'Bloom Café',
    subtitle: 'FRESH CEREMONIAL UJI MATCHA • ONLY THIS WEEK',
    accentColor: '#10b981',
    bgColor: '#064e3b',
    version: 1,
  });

  const draftBloomV2 = generateSampleArtworkDataUrl({
    title: 'SUMMER MATCHA 1 GET 1 FREE!',
    brand: 'Bloom Café',
    subtitle: '15 - 30 NOV • ALL BRANCHES & LINE MAN',
    accentColor: '#059669',
    bgColor: '#022c22',
    version: 2,
  });

  const finalKenshin = generateSampleArtworkDataUrl({
    title: 'OMAKASE GRAND OPENING',
    brand: 'Kenshin Izakaya',
    subtitle: '20% OFF EARLY BIRD RESERVATION',
    accentColor: '#e11d48',
    bgColor: '#18181b',
    version: 1,
  });

  const isAdmin = profile.role === 'admin';
  const baseCustomerId = profile.uid;

  const sampleOrders: Omit<ArtworkOrder, 'id'>[] = [
    {
      orderNumber: `BB-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: baseCustomerId,
      customerName: isAdmin ? 'คุณพลอย (Bloom Café)' : profile.displayName,
      customerBrand: isAdmin ? 'Bloom Café' : profile.brandName || 'Bloom Café',
      customerContact: isAdmin ? 'LINE: @bloomcafe / 089-123-4567' : profile.contactInfo,
      title: 'โปรโมชั่น Matcha Latte ซื้อ 1 แถม 1 (IG & Facebook Post)',
      artworkType: 'Social Media Post',
      dimensions: '1080x1080 px (1:1)',
      fileFormats: ['PNG', 'JPG'],
      moodAndTone: 'Minimal / สะอาดตา',
      colorPalette: ['#064e3b', '#10b981', '#ecfdf5', '#ffffff'],
      headlineText: 'SUMMER MATCHA 1 แถม 1',
      subText: 'เฉพาะวันที่ 15-30 นี้เท่านั้น ที่ Bloom Café ทุกสาขา และ LINE MAN',
      briefDetails:
        'อยากได้ฟีลญี่ปุ่นโมเดิร์น สะอาดตา เน้นสีเขียวมัทฉะตัดกับพื้นหลังเข้มให้ตัวหนังสือเด่น อ่านง่ายบนมือถือ',
      referenceUrl: 'https://www.pinterest.com/search/pins/?q=matcha%20poster%20minimal',
      referenceImages: [],
      deadline: daysFromNow(3),
      urgency: 'urgent',
      maxRevisions: 3,
      usedRevisions: 1,
      status: 'review',
      assignedDesigner: 'Designer มินท์',
      quotedPrice: 1200,
      quoteNote: 'โอนชำระเข้าบัญชี กสิกรไทย 012-3-45678-9 บจก. บรีฟบ็อกซ์ สตูดิโอ',
      paymentStatus: 'paid',
      paymentSlipUrl: '',
      paymentPaidAt: hoursAgo(26),
      drafts: [
        {
          version: 1,
          imageUrl: draftBloomV1,
          designerNote: 'ส่งดราฟต์แรก เน้นโทนเขียวมัทฉะเข้มและวางป้ายแบรนด์มุมบนซ้ายครับ',
          submittedAt: hoursAgo(18),
          status: 'revision_requested',
          customerFeedback: 'ชอบโทนสีค่ะ แต่อยากให้เพิ่มวันที่โปรโมชั่นและข้อความชัดเจนขึ้นอีกนิดค่ะ',
          reviewedAt: hoursAgo(12),
        },
        {
          version: 2,
          imageUrl: draftBloomV2,
          designerNote: 'ปรับแก้เพิ่มวันที่ 15-30 และเน้นคำว่า 1 GET 1 FREE ให้ชัดขึ้นแล้วครับ',
          submittedAt: hoursAgo(3),
          status: 'pending_review',
        },
      ],
      finalDeliverableUrl: '',
      finalPreviewImage: '',
      finalNote: '',
      comments: [
        {
          id: 'c1',
          authorId: baseCustomerId,
          authorName: isAdmin ? 'คุณพลอย (Bloom Café)' : profile.displayName,
          authorRole: 'customer',
          message: 'รบกวนช่วยเน้นวันที่ให้ชัดหน่อยนะคะ จะนำไปยิงแอดค่ะ',
          createdAt: hoursAgo(12),
        },
        {
          id: 'c2',
          authorId: 'studio-admin',
          authorName: 'Designer มินท์',
          authorRole: 'admin',
          message: 'อัปเดตดราฟต์ v2 ให้เรียบร้อยครับ ลองตรวจดูได้เลย',
          createdAt: hoursAgo(3),
        },
      ],
      createdAt: hoursAgo(36),
      updatedAt: hoursAgo(3),
    },
    {
      orderNumber: `BB-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: isAdmin ? 'demo-customer-aura' : baseCustomerId,
      customerName: isAdmin ? 'คุณนนท์ (Aura Clinic)' : profile.displayName,
      customerBrand: isAdmin ? 'Aura Aesthetic Clinic' : profile.brandName || 'My Brand',
      customerContact: isAdmin ? 'LINE: @auraclinic / 081-987-6543' : profile.contactInfo,
      title: 'แบนเนอร์โปรโมชั่น Ulthera ยกกระชับหน้าเรียว',
      artworkType: 'Banner / Ads',
      dimensions: '1080x1350 px (4:5)',
      fileFormats: ['PNG', 'PSD ต้นฉบับ'],
      moodAndTone: 'Luxury / พรีเมียม',
      colorPalette: ['#1e1b4b', '#c084fc', '#f8fafc', '#d4af37'],
      headlineText: 'LIFT & GLOW • ULTHERA PRIME',
      subText: 'ลดพิเศษ 30% เฉพาะ 20 ท่านแรก • ปรึกษาแพทย์ผู้เชี่ยวชาญฟรี',
      briefDetails:
        'ขอภาพลักษณ์คลินิกความงามระดับไฮเอนด์ ไม่รก เน้นตัวอักษรเรียบหรู มีพื้นที่เว้นขอบด้านล่างสำหรับใส่โลโก้สาขา',
      referenceUrl: '',
      referenceImages: [],
      deadline: daysFromNow(2),
      urgency: 'express',
      maxRevisions: 3,
      usedRevisions: 0,
      status: 'quoted',
      assignedDesigner: 'Designer เจมส์',
      quotedPrice: 1800,
      quoteNote: 'รวมไฟล์ต้นฉบับ PSD + งานด่วน 48 ชม. ชำระผ่านพร้อมเพย์ 089-999-8888 (บรีฟบ็อกซ์)',
      paymentStatus: 'unpaid',
      paymentSlipUrl: '',
      paymentPaidAt: '',
      drafts: [],
      finalDeliverableUrl: '',
      finalPreviewImage: '',
      finalNote: '',
      comments: [],
      createdAt: hoursAgo(10),
      updatedAt: hoursAgo(8),
    },
    {
      orderNumber: `BB-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: isAdmin ? 'demo-customer-kenshin' : baseCustomerId,
      customerName: isAdmin ? 'คุณเคน (Kenshin Izakaya)' : profile.displayName,
      customerBrand: isAdmin ? 'Kenshin Izakaya' : profile.brandName || 'My Brand',
      customerContact: isAdmin ? 'LINE: @kenshin.bkk' : profile.contactInfo,
      title: 'โปสเตอร์เปิดสาขาใหม่ Omakase Grand Opening',
      artworkType: 'Poster / สิ่งพิมพ์',
      dimensions: 'A4 (210x297 mm)',
      fileFormats: ['PDF สำหรับพิมพ์', 'PNG'],
      moodAndTone: 'Luxury / พรีเมียม',
      colorPalette: ['#18181b', '#e11d48', '#fbbf24', '#ffffff'],
      headlineText: 'OMAKASE GRAND OPENING',
      subText: 'รับส่วนลด 20% เมื่อสำรองที่นั่งล่วงหน้า • ทองหล่อ ซอย 13',
      briefDetails: 'สำหรับพิมพ์ตั้งหน้าร้านและโพสต์ลงเพจร้าน อยากได้โทนดำ-แดงสไตล์ญี่ปุ่นร่วมสมัย',
      referenceUrl: '',
      referenceImages: [],
      deadline: daysFromNow(5),
      urgency: 'normal',
      maxRevisions: 3,
      usedRevisions: 0,
      status: 'completed',
      assignedDesigner: 'Designer มินท์',
      quotedPrice: 2500,
      quoteNote: 'งานสิ่งพิมพ์ CMYK พร้อม Bleed 3mm',
      paymentStatus: 'paid',
      paymentSlipUrl: '',
      paymentPaidAt: hoursAgo(72),
      drafts: [
        {
          version: 1,
          imageUrl: finalKenshin,
          designerNote: 'วางเลย์เอาท์โทนดำ-แดงพร้อมไฟล์สำหรับพิมพ์เรียบร้อยครับ',
          submittedAt: hoursAgo(40),
          status: 'approved',
          customerFeedback: 'สวยถูกใจมากครับ อนุมัติเลย!',
          reviewedAt: hoursAgo(30),
        },
      ],
      finalDeliverableUrl: 'https://drive.google.com/drive/folders/demo-kenshin-final-files',
      finalPreviewImage: finalKenshin,
      finalNote: 'แนบไฟล์ PDF CMYK พร้อม Bleed 3mm และไฟล์ PNG ความละเอียดสูงครบชุดครับ',
      comments: [],
      createdAt: hoursAgo(80),
      updatedAt: hoursAgo(28),
    },
    {
      orderNumber: `BB-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: isAdmin ? 'demo-customer-bloom' : baseCustomerId,
      customerName: isAdmin ? 'คุณพลอย (Bloom Café)' : profile.displayName,
      customerBrand: isAdmin ? 'Bloom Café' : profile.brandName || 'My Brand',
      customerContact: isAdmin ? 'LINE: @bloomcafe / 089-123-4567' : profile.contactInfo,
      title: 'Rich Menu LINE OA (6 ช่อง) สำหรับลูกค้าสมาชิก',
      artworkType: 'Rich Menu LINE OA',
      dimensions: '2500x1686 px (LINE Rich Menu)',
      fileFormats: ['PNG', 'JPG'],
      moodAndTone: 'สดใส / สนุกสนาน',
      colorPalette: ['#fef3c7', '#f59e0b', '#10b981', '#1e293b'],
      headlineText: 'เมนูสั่งเครื่องดื่ม • สะสมแต้ม • สาขาใกล้คุณ',
      subText: 'แบ่งเป็น 6 ปุ่ม: สั่งล่วงหน้า, คูปอง, สะสมแต้ม, เมนูแนะนำ, สาขา, ติดต่อแอดมิน',
      briefDetails: 'อยากได้ไอคอนน่ารักๆ อ่านง่าย ชัดเจนสำหรับลูกค้าทุกวัย',
      referenceUrl: '',
      referenceImages: [],
      deadline: daysFromNow(6),
      urgency: 'normal',
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
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(2),
    },
  ];

  let createdCount = 0;
  for (const order of sampleOrders) {
    await addDoc(collection(db, 'orders'), order);
    createdCount += 1;
  }
  return createdCount;
}
