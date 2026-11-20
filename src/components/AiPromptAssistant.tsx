import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  Bot,
  Layers,
  Wand2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ArtworkOrder, isVideoOrder } from '../types/briefbox';

interface AiPromptAssistantProps {
  order: ArtworkOrder;
}

type AiEngine = 'chatgpt' | 'gemini' | 'creative_chat';
type ImageStyle = 'commercial' | 'minimal' | '3d' | 'cinematic';

const STYLE_OPTIONS: { id: ImageStyle; label: string; desc: string }[] = [
  {
    id: 'commercial',
    label: '📸 ถ่ายภาพสตูดิโอ (Commercial Photo)',
    desc: 'Commercial product photography, professional studio lighting, clean background, sharp focus',
  },
  {
    id: 'minimal',
    label: '🎨 มินิมอลกราฟิก (Modern Minimal)',
    desc: 'Clean modern graphic design aesthetic, elegant simplicity, vector-inspired balance, plenty of negative space',
  },
  {
    id: '3d',
    label: '🌟 3D เรนเดอร์หรูหรา (Glossy 3D)',
    desc: 'Modern 3D glossy render, smooth clay and glass textures, vibrant ambient occlusion, studio claymation style',
  },
  {
    id: 'cinematic',
    label: '🎬 แสงภาพยนตร์ (Cinematic & Moody)',
    desc: 'Cinematic composition, dramatic atmospheric lighting, shallow depth of field, anamorphic lens flares, rich color grading',
  },
];

function getMoodEnglish(mood: string): string {
  const m = mood.toLowerCase();
  if (m.includes('minimal') || m.includes('สะอาดตา')) return 'Minimalist, clean, airy, contemporary, spacious and uncluttered';
  if (m.includes('luxury') || m.includes('พรีเมียม')) return 'Luxury, prestigious, refined, premium materials with subtle metallic and satin finishes';
  if (m.includes('สดใส') || m.includes('สนุกสนาน')) return 'Vibrant, joyful, energetic, warm dynamic pop colors, uplifting feeling';
  if (m.includes('ทางการ') || m.includes('น่าเชื่อถือ')) return 'Corporate, authoritative, professional, structured, balanced and trustworthy';
  if (m.includes('โมเดิร์น') || m.includes('เทคโนโลยี')) return 'Modern high-tech, futuristic sleek lines, neon cyber accents, innovation';
  if (m.includes('วินเทจ') || m.includes('อบอุ่น')) return 'Warm vintage nostalgia, cozy rustic charm, tactile textures, soft golden hour tone';
  return 'Professional, polished, harmonious and brand-aligned';
}

interface DimensionInfo {
  name: string;
  instruction: string;
  orientation: string;
  raw: string;
}

function parseDimensions(dimensionsStr: string): DimensionInfo {
  const raw = (dimensionsStr || '').trim();
  if (!raw) {
    return {
      raw: 'Standard',
      name: '1:1 (Square Post)',
      instruction: 'square aspect ratio 1:1 format',
      orientation: 'square',
    };
  }

  const d = raw.toLowerCase();

  // Try extracting width and height numbers (e.g. 227x1021, 1920*1080, 210 x 297, etc.)
  const match = d.match(/(\d+(?:\.\d+)?)\s*(?:[xX*×:]|\s+x\s+)\s*(\d+(?:\.\d+)?)/);
  if (match) {
    const w = parseFloat(match[1]);
    const h = parseFloat(match[2]);
    if (w > 0 && h > 0) {
      const ratio = w / h;

      // 1:1 Square
      if (Math.abs(ratio - 1) < 0.05) {
        return {
          raw,
          name: `${raw} (Square 1:1)`,
          instruction: `exact canvas dimensions ${raw} in square 1:1 aspect ratio`,
          orientation: 'square 1:1',
        };
      }

      // 9:16 Vertical (Reels / Story / TikTok)
      if (d.includes('9:16') || Math.abs(ratio - 9 / 16) < 0.04) {
        return {
          raw,
          name: `${raw} (Vertical 9:16 - Reels / Story)`,
          instruction: `exact canvas dimensions ${raw} in tall vertical 9:16 format`,
          orientation: 'vertical 9:16',
        };
      }

      // 16:9 Landscape (Widescreen / Banner / Billboard)
      if (d.includes('16:9') || Math.abs(ratio - 16 / 9) < 0.05) {
        return {
          raw,
          name: `${raw} (Horizontal 16:9 - Landscape / Banner)`,
          instruction: `exact canvas dimensions ${raw} in wide horizontal 16:9 landscape format`,
          orientation: 'horizontal 16:9 landscape',
        };
      }

      // 4:5 Vertical Feed
      if (d.includes('4:5') || Math.abs(ratio - 4 / 5) < 0.04) {
        return {
          raw,
          name: `${raw} (Vertical 4:5 - Social Feed)`,
          instruction: `exact canvas dimensions ${raw} in vertical portrait 4:5 format`,
          orientation: 'vertical 4:5 portrait',
        };
      }

      // Ultra-tall vertical (e.g., 227x1021 -> ratio ~0.22, ~1:4.5)
      if (ratio < 0.55) {
        const inv = (h / w).toFixed(1);
        return {
          raw,
          name: `${raw} (Ultra-tall Vertical Banner / Billboard ~1:${inv})`,
          instruction: `exact canvas dimensions ${raw} in an ultra-tall vertical billboard/banner format with approximate aspect ratio 1:${inv} (canvas is very tall and narrow)`,
          orientation: `ultra-tall vertical (~1:${inv})`,
        };
      }

      // Standard vertical portrait (0.55 <= ratio < 0.95)
      if (ratio < 0.95) {
        const inv = (h / w).toFixed(1);
        return {
          raw,
          name: `${raw} (Vertical Portrait ~1:${inv})`,
          instruction: `exact canvas dimensions ${raw} in vertical portrait format (approx. 1:${inv} ratio)`,
          orientation: `vertical portrait (~1:${inv})`,
        };
      }

      // Ultra-wide horizontal (ratio >= 2.0)
      if (ratio >= 2.0) {
        const rStr = ratio.toFixed(1);
        return {
          raw,
          name: `${raw} (Ultra-wide Panoramic Banner ~${rStr}:1)`,
          instruction: `exact canvas dimensions ${raw} in an ultra-wide panoramic landscape format with approximate ratio ${rStr}:1`,
          orientation: `ultra-wide panoramic (~${rStr}:1)`,
        };
      }

      // Standard horizontal landscape (1.05 < ratio < 2.0)
      const rStr = ratio.toFixed(1);
      return {
        raw,
        name: `${raw} (Horizontal Landscape ~${rStr}:1)`,
        instruction: `exact canvas dimensions ${raw} in horizontal landscape format with approximate ratio ${rStr}:1`,
        orientation: `horizontal landscape (~${rStr}:1)`,
      };
    }
  }

  // Preset keywords without direct numbers
  if (d.includes('9:16') || d.includes('reels') || d.includes('story')) {
    return {
      raw,
      name: `${raw} (Vertical 9:16)`,
      instruction: `exact target format "${raw}" in vertical 9:16 orientation`,
      orientation: 'vertical 9:16',
    };
  }
  if (d.includes('16:9') || d.includes('landscape') || d.includes('widescreen')) {
    return {
      raw,
      name: `${raw} (Horizontal 16:9)`,
      instruction: `exact target format "${raw}" in horizontal 16:9 widescreen orientation`,
      orientation: 'horizontal 16:9 landscape',
    };
  }
  if (d.includes('4:5')) {
    return {
      raw,
      name: `${raw} (Vertical 4:5)`,
      instruction: `exact target format "${raw}" in vertical portrait 4:5 orientation`,
      orientation: 'vertical 4:5 portrait',
    };
  }
  if (d.includes('a4')) {
    return {
      raw,
      name: `${raw} (A4 Print Portrait)`,
      instruction: `exact target format "${raw}" in standard vertical A4 print ratio (1:1.41)`,
      orientation: 'vertical A4 portrait',
    };
  }

  return {
    raw,
    name: raw,
    instruction: `exact dimensions and format "${raw}"`,
    orientation: 'custom format',
  };
}

export const AiPromptAssistant: React.FC<AiPromptAssistantProps> = ({ order }) => {
  const [engine, setEngine] = useState<AiEngine>('chatgpt');
  const [style, setStyle] = useState<ImageStyle>('commercial');
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const isVideo = isVideoOrder(order.artworkType);
  const brand = order.customerBrand || 'Brand';
  const colorsText = order.colorPalette.length > 0 ? order.colorPalette.join(', ') : 'harmonious brand tones';
  const moodEn = getMoodEnglish(order.moodAndTone);
  const aspect = parseDimensions(order.dimensions);
  const selectedStyleDesc = STYLE_OPTIONS.find((s) => s.id === style)?.desc || STYLE_OPTIONS[0].desc;

  const promptText = useMemo(() => {
    if (engine === 'chatgpt') {
      return `Create a high-resolution commercial visual asset for "${brand}".
Subject & Project: "${order.title}". ${order.headlineText ? `Key focal theme: "${order.headlineText}".` : ''}
${order.briefDetails ? `Creative details & requirements: ${order.briefDetails}` : ''}
Target Canvas Dimensions: ${order.dimensions} (${aspect.name}).
Visual Style: ${selectedStyleDesc}.
Mood & Atmosphere: ${moodEn}.
Color Harmony: Accent colors featuring ${colorsText}.
Framing & Composition: Custom-tailored specifically for ${aspect.instruction}. The composition and visual elements MUST strictly fit this ${aspect.orientation} orientation (DO NOT generate in a default square 1:1 or horizontal landscape format if dimensions specify otherwise). Leave generous clean negative space for typography, headline copy, and brand logo placement.
Quality: Ultra-detailed, commercial advertising quality, 8k resolution, crisp studio lighting, clean background, no deformed text or messy logos.`;
    }

    if (engine === 'gemini') {
      return `Photorealistic commercial advertisement artwork for "${brand}", project: "${order.title}".
Context & Features: ${order.briefDetails || order.title}. ${order.headlineText ? `Visual hook: "${order.headlineText}".` : ''}
Target Canvas Dimensions: ${order.dimensions} (${aspect.name}).
Aesthetic Style: ${selectedStyleDesc}.
Atmospheric Mood: ${moodEn}.
Palette: Primary brand colors ${colorsText}.
Canvas Framing: Strictly composed and framed for ${aspect.instruction}. Composition must strictly respect this ${aspect.orientation} format with dedicated breathing room for text and branding overlays.
Camera & Lighting: Professional advertising shoot, 50mm prime lens, clean depth of field, balanced soft shadows, pristine textures, high dynamic range.`;
    }

    // Creative Director / Concept Breakdown for ChatGPT or Gemini Chat
    return `คุณคือ Senior Creative Director และ Art Director ระดับแนวหน้า
ช่วยวางแนวคิด Layout และทิศทางการออกแบบ (Design Direction) สำหรับงานนี้:

• แบรนด์: ${brand}
• ชื่องาน/โปรเจกต์: ${order.title}
• ประเภทชิ้นงาน: ${order.artworkType} (${isVideo ? 'งานวิดีโอ/โมชัน' : 'งานกราฟิกภาพนิ่ง'})
• สัดส่วน/ขนาดจริงที่ลูกค้าบรีฟ: ${order.dimensions} (${aspect.name})
• Mood & Tone: ${order.moodAndTone}
• โทนสีหลักของแบรนด์: ${colorsText}
${order.headlineText ? `• ข้อความหลัก/Hook: "${order.headlineText}"` : ''}
${order.subText ? `• ข้อความรอง/CTA: "${order.subText}"` : ''}
${order.briefDetails ? `• รายละเอียดบรีฟเพิ่มเติม:\n${order.briefDetails}` : ''}

ช่วยเสนอแนะเป็นข้อๆ:
1. ไอเดียการจัดวาง Layout (Composition): บนขนาดจริง ${order.dimensions} (${aspect.orientation}) ควรวางองค์ประกอบสินค้า/กราฟิก, Headline และ CTA อย่างไรให้บาลานซ์สวยงามและดึงดูดสายตา
2. สไตล์ภาพและพื้นหลัง (Background & Lighting): แนะนำการใช้แสงและพื้นผิวที่เข้ากับแบรนด์
3. คำแนะนำด้าน Typography: สไตล์ฟอนต์ภาษาไทยและอังกฤษที่แมตช์กับ Mood & Tone
4. Prompt ภาษาอังกฤษสั้นๆ สำหรับนำไปเจนภาพ Background หรือองค์ประกอบหลักใน ChatGPT / Gemini โดยให้ระบุขนาด ${order.dimensions} ด้วย`;
  }, [engine, style, brand, order, colorsText, moodEn, aspect, selectedStyleDesc, isVideo]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/50 shadow-sm transition dark:border-indigo-900/50 dark:bg-slate-900/90 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-indigo-100/80 bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xs">
            <Sparkles className="h-4 w-4 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                AI Prompt Generator (สำหรับดีไซเนอร์)
              </span>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                ChatGPT / Gemini
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              สร้างคำสั่ง Prompt จากบรีฟลูกค้า พร้อมคัดลอกไปเจนภาพหรือขอไอเดียได้ทันที
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          title={expanded ? 'ย่อแผง' : 'ขยายแผง'}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 p-4">
          {/* Target Engine Switcher */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setEngine('chatgpt')}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                engine === 'chatgpt'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xs dark:border-emerald-500/50 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <Bot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>ChatGPT (DALL-E 3)</span>
            </button>

            <button
              type="button"
              onClick={() => setEngine('gemini')}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                engine === 'gemini'
                  ? 'border-sky-600 bg-sky-50 text-sky-700 shadow-xs dark:border-sky-500/50 dark:bg-sky-950/60 dark:text-sky-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <Sparkles className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <span>Google Gemini (Imagen)</span>
            </button>

            <button
              type="button"
              onClick={() => setEngine('creative_chat')}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                engine === 'creative_chat'
                  ? 'border-violet-600 bg-violet-50 text-violet-700 shadow-xs dark:border-violet-500/50 dark:bg-violet-950/60 dark:text-violet-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <Wand2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span>คิด Layout & Concept (ไทย)</span>
            </button>
          </div>

          {/* Style selector for image engines */}
          {engine !== 'creative_chat' && (
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <Layers className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>เลือกสไตล์ภาพที่ต้องการสร้าง:</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStyle(opt.id)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                      style === opt.id
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Generated Prompt Output Box */}
          <div className="relative rounded-xl border border-slate-200 bg-slate-900 p-3.5 text-slate-100 dark:border-slate-800">
            <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[11px] font-mono font-semibold text-slate-400">
                {engine === 'creative_chat'
                  ? '💬 Prompt วางคอนเซปต์ (ภาษาไทย)'
                  : `🎨 Image Prompt สำหรับ ${engine === 'chatgpt' ? 'ChatGPT' : 'Gemini'} (${aspect.name})`}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>คัดลอกแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>คัดลอก Prompt</span>
                  </>
                )}
              </button>
            </div>

            <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-200">
              {promptText}
            </pre>
          </div>

          {/* Direct Launch Shortcuts */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span>คัดลอก Prompt แล้วคลิกเปิดเครื่องมือเพื่อนำไปวางใช้งานได้ทันที:</span>
            <div className="flex items-center gap-2">
              <a
                href="https://chatgpt.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-400"
              >
                <Bot className="h-3.5 w-3.5" />
                <span>เปิด ChatGPT</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://gemini.google.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-sky-700 transition hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-400"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>เปิด Gemini</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
