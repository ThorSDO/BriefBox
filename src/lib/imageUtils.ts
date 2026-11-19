export function compressImageToDataUrl(
  file: File,
  maxDimension = 900,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์ที่เลือกไม่ใช่รูปภาพที่รองรับ'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('เบราว์เซอร์ไม่รองรับการประมวลผลรูปภาพ'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const output = canvas.toDataURL('image/jpeg', quality);
        resolve(output);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function generateSampleArtworkDataUrl(options: {
  title: string;
  brand: string;
  subtitle?: string;
  accentColor?: string;
  bgColor?: string;
  version?: number;
}): string {
  const {
    title,
    brand,
    subtitle = 'SPECIAL PROMOTION • LIMITED EDITION',
    accentColor = '#4f46e5',
    bgColor = '#0f172a',
    version = 1,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 800, 800);
  grad.addColorStop(0, bgColor);
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 800, 800);

  // Decorative circles
  ctx.fillStyle = accentColor;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(650, 160, 220, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(140, 660, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Inner frame
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, 704, 704);

  // Brand tag
  ctx.fillStyle = accentColor;
  ctx.fillRect(88, 96, 220, 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(brand.slice(0, 20).toUpperCase(), 108, 124);

  // Version badge
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(590, 96, 122, 42);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`DRAFT v${version}`, 608, 124);

  // Center headline
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px sans-serif';
  const words = title.split(' ');
  let line = '';
  let y = 340;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > 600 && line) {
      ctx.fillText(line, 88, y);
      line = word;
      y += 60;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, 88, y);
  }

  // Subtitle
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '24px sans-serif';
  ctx.fillText(subtitle.slice(0, 45), 88, y + 68);

  // Footer CTA pill
  ctx.fillStyle = accentColor;
  ctx.fillRect(88, 620, 260, 56);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('PREVIEW ARTWORK', 112, 656);

  return canvas.toDataURL('image/jpeg', 0.85);
}
