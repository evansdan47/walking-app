import { ACCEPTED_AVATAR_TYPES, MAX_AVATAR_BYTES } from '@/lib/rambleio-avatars';

export function validateAvatarFile(file: File): string | null {
  if (!ACCEPTED_AVATAR_TYPES.includes(file.type as (typeof ACCEPTED_AVATAR_TYPES)[number])) {
    return 'Please choose a JPEG, PNG, WebP, or GIF image.';
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return 'Image must be 5 MB or smaller.';
  }
  return null;
}

/** Rasterise an image URL to PNG for Clerk profile upload (handles SVG presets). */
export async function imageUrlToPngFile(url: string, filename: string): Promise<File> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = url;
  });

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare image');

  ctx.clearRect(0, 0, size, size);
  const scale = Math.min(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/png');
  });

  return new File([blob], filename.endsWith('.png') ? filename : `${filename}.png`, {
    type: 'image/png',
  });
}

export async function presetToProfileFile(presetSrc: string, presetId: string): Promise<File> {
  return imageUrlToPngFile(presetSrc, `rambleio-${presetId}.png`);
}
