import { MAX_AVATAR_BYTES } from '@/lib/rambleio-avatars';

/** Shape returned by expo-image-picker — defined locally to avoid loading the native module at startup. */
export type PickedImageAsset = {
  mimeType?: string | null;
  fileSize?: number | null;
  base64?: string | null;
};

const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function validateAvatarAsset(asset: PickedImageAsset): string | null {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
    return 'Please choose a JPEG, PNG, WebP, or GIF image.';
  }
  if (asset.fileSize != null && asset.fileSize > MAX_AVATAR_BYTES) {
    return 'Image must be 5 MB or smaller.';
  }
  if (!asset.base64) {
    return 'Could not read the image. Try another photo.';
  }
  return null;
}

export function assetToDataUrl(asset: PickedImageAsset): string {
  const mimeType = asset.mimeType ?? 'image/jpeg';
  return `data:${mimeType};base64,${asset.base64}`;
}

const NATIVE_MEDIA_REBUILD_HINT =
  'Photo upload requires a native rebuild. Run npx expo run:android or npx expo run:ios, then restart the app.';

export function nativeMediaUnavailableMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (
    message.includes('ExponentImagePicker') ||
    message.includes('ExpoImagePicker') ||
    message.includes('native module') ||
    message.includes('RNViewShot')
  ) {
    return NATIVE_MEDIA_REBUILD_HINT;
  }
  return message || 'Could not open the photo library.';
}
