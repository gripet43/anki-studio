// ============================================================================
// Anki Studio — Local Profile Avatar Validation, Normalization & Square Cropping
// Pure helpers remain 100% SSR-safe (no top-level `window`/`document` access).
// ============================================================================

import {
  AVATAR_PRESET_IDS,
  type AvatarPresetId,
  type CustomAvatarConfig,
} from '../bridge/pycmd';

export { AVATAR_PRESET_IDS };
export type { AvatarPresetId, CustomAvatarConfig };

export const AVATAR_IMAGE_ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,image/bmp';
export const AVATAR_TARGET_SIZE = 256;
export const AVATAR_WEBP_QUALITY = 0.86;
export const MAX_AVATAR_OUTPUT_BYTES = 512 * 1024;
export const MAX_AVATAR_SOURCE_BYTES = 16 * 1024 * 1024;
export const AVATAR_CROP_MIN_ZOOM = 1;
export const AVATAR_CROP_MAX_ZOOM = 3;
export const AVATAR_CROP_VIEWPORT_PX = 256;

export type AvatarCropRotation = 0 | 90 | 180 | 270;

export interface AvatarCropTransform {
  /** Zoom multiplier >= 1 (1 = minimum cover scale filling the square viewport). */
  zoom: number;
  /** Horizontal pan offset in CSS pixels relative to centered cover image. */
  offsetX: number;
  /** Vertical pan offset in CSS pixels relative to centered cover image. */
  offsetY: number;
  /** Clockwise rotation angle in 90-degree increments. */
  rotation: AvatarCropRotation;
}

export interface AvatarCropLayout extends AvatarCropTransform {
  displayScale: number;
  /** Unrotated `<img>` element width in CSS pixels before CSS `rotate()`. */
  imgWidth: number;
  /** Unrotated `<img>` element height in CSS pixels before CSS `rotate()`. */
  imgHeight: number;
  /** Effective axis-aligned bounding width in CSS pixels after rotation. */
  displayWidth: number;
  /** Effective axis-aligned bounding height in CSS pixels after rotation. */
  displayHeight: number;
  maxOffsetX: number;
  maxOffsetY: number;
}

export const DEFAULT_AVATAR_CROP: AvatarCropTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

export const DEFAULT_CUSTOM_AVATAR: CustomAvatarConfig = { kind: 'initial' };

const ALLOWED_OUTPUT_MIME_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i;
const ALLOWED_SOURCE_DATA_URL_RE =
  /^data:image\/(png|jpeg|jpg|webp|gif|bmp|x-ms-bmp);base64,[A-Za-z0-9+/]+={0,2}$/i;

const ALLOWED_SOURCE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/x-ms-bmp',
]);

const ALLOWED_SOURCE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']);

export type AvatarImageErrorCode =
  | 'invalid_type'
  | 'too_large'
  | 'decode_failed'
  | 'unsupported_env';

export class AvatarImageError extends Error {
  readonly code: AvatarImageErrorCode;

  constructor(code: AvatarImageErrorCode, message?: string) {
    super(message || code);
    this.name = 'AvatarImageError';
    this.code = code;
  }
}

/**
 * Estimate decoded byte length of a base64 `data:` URL without relying on DOM or Node globals.
 */
export function estimateDataUrlDecodedBytes(dataUrl: string): number {
  if (typeof dataUrl !== 'string') return 0;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return 0;
  const b64 = dataUrl.slice(commaIdx + 1).trim();
  if (!b64 || b64.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    return 0;
  }
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

/**
 * Validate persisted/rendered avatar image URLs.
 * Only permits safe raster base64 data URLs (png/jpeg/webp/gif) within 512 KB.
 * Rejects SVG (`image/svg+xml`), `http(s):`, `file:`, `javascript:`, and malformed payloads.
 */
export function isSafeAvatarDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!ALLOWED_OUTPUT_MIME_RE.test(trimmed)) return false;
  const decodedBytes = estimateDataUrlDecodedBytes(trimmed);
  return decodedBytes > 0 && decodedBytes <= MAX_AVATAR_OUTPUT_BYTES;
}

/**
 * Validate input data URL passed into the cropper (allows bmp as well before re-encoding).
 */
export function isSafeSourceDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!ALLOWED_SOURCE_DATA_URL_RE.test(trimmed)) return false;
  const decodedBytes = estimateDataUrlDecodedBytes(trimmed);
  return decodedBytes > 0 && decodedBytes <= MAX_AVATAR_SOURCE_BYTES;
}

export function isValidAvatarPresetId(value: unknown): value is AvatarPresetId {
  return (
    typeof value === 'string' &&
    (AVATAR_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function normalizeCustomAvatarConfig(raw: unknown): CustomAvatarConfig {
  if (!raw || typeof raw !== 'object') {
    return { kind: 'initial' };
  }
  const candidate = raw as { kind?: unknown; presetId?: unknown; dataUrl?: unknown };
  if (candidate.kind === 'preset' && isValidAvatarPresetId(candidate.presetId)) {
    return { kind: 'preset', presetId: candidate.presetId };
  }
  if (candidate.kind === 'image' && isSafeAvatarDataUrl(candidate.dataUrl)) {
    return { kind: 'image', dataUrl: candidate.dataUrl.trim() };
  }
  return { kind: 'initial' };
}

export function isDefaultCustomAvatar(
  avatar: CustomAvatarConfig | null | undefined
): boolean {
  return normalizeCustomAvatarConfig(avatar).kind === 'initial';
}

export function getAvatarInitial(displayName: string | null | undefined): string {
  const trimmed = typeof displayName === 'string' ? displayName.trim() : '';
  if (!trimmed) return 'A';
  const first = Array.from(trimmed)[0] || trimmed.slice(0, 1);
  return first.toUpperCase();
}

export function isSupportedSourceImageFile(file: {
  type?: string;
  name?: string;
  size?: number;
}): boolean {
  const mime = typeof file.type === 'string' ? file.type.trim().toLowerCase() : '';
  const name = typeof file.name === 'string' ? file.name.trim().toLowerCase() : '';
  const ext = name.includes('.') ? name.split('.').pop() || '' : '';

  // Explicitly block SVG at both MIME and extension levels
  if (mime === 'image/svg+xml' || ext === 'svg') {
    return false;
  }
  if (mime) {
    return ALLOWED_SOURCE_MIMES.has(mime);
  }
  if (ext) {
    return ALLOWED_SOURCE_EXTS.has(ext);
  }
  return false;
}

export function validateAvatarSourceFile(file: {
  type?: string;
  name?: string;
  size?: number;
}): void {
  if (!isSupportedSourceImageFile(file)) {
    throw new AvatarImageError('invalid_type', 'Unsupported image file type');
  }
  if (typeof file.size === 'number') {
    if (file.size <= 0) {
      throw new AvatarImageError('decode_failed', 'Image file is empty');
    }
    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      throw new AvatarImageError('too_large', 'Image file exceeds size limit');
    }
  }
}

/**
 * Compute centered 1:1 `cover` source crop rectangle for `<canvas>.drawImage`.
 */
export function computeSquareCoverCropRect(
  srcWidth: number,
  srcHeight: number
): { sx: number; sy: number; sw: number; sh: number } {
  if (
    !Number.isFinite(srcWidth) ||
    !Number.isFinite(srcHeight) ||
    srcWidth <= 0 ||
    srcHeight <= 0
  ) {
    throw new AvatarImageError('decode_failed', 'Invalid image dimensions');
  }
  const side = Math.min(srcWidth, srcHeight);
  const sx = Math.floor((srcWidth - side) / 2);
  const sy = Math.floor((srcHeight - side) / 2);
  return { sx, sy, sw: side, sh: side };
}

function clampNumber(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min === 0 ? 0 : min;
  const clamped = Math.min(max, Math.max(min, val));
  return clamped === 0 ? 0 : clamped;
}

export function normalizeAvatarCropRotation(deg: number | undefined): AvatarCropRotation {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return 0;
  const snapped = (((Math.round(deg / 90) * 90) % 360) + 360) % 360;
  return (snapped === 90 || snapped === 180 || snapped === 270 ? snapped : 0) as AvatarCropRotation;
}

/**
 * Computes the cover-fit display size, pan bounds, and clamped `(zoom, offsetX, offsetY, rotation)`
 * for an interactive square/circular avatar crop viewport so no empty edges ever appear.
 */
export function computeAvatarCropLayout(
  srcWidth: number,
  srcHeight: number,
  transform: Partial<AvatarCropTransform> = DEFAULT_AVATAR_CROP,
  viewportSize: number = AVATAR_CROP_VIEWPORT_PX
): AvatarCropLayout {
  if (
    !Number.isFinite(srcWidth) ||
    !Number.isFinite(srcHeight) ||
    srcWidth <= 0 ||
    srcHeight <= 0
  ) {
    throw new AvatarImageError('decode_failed', 'Invalid image dimensions');
  }
  const safeViewport = Number.isFinite(viewportSize) && viewportSize > 0
    ? viewportSize
    : AVATAR_CROP_VIEWPORT_PX;
  const rotation = normalizeAvatarCropRotation(transform.rotation);
  const swapped = rotation === 90 || rotation === 270;
  const effWidth = swapped ? srcHeight : srcWidth;
  const effHeight = swapped ? srcWidth : srcHeight;

  const zoom = clampNumber(
    transform.zoom ?? AVATAR_CROP_MIN_ZOOM,
    AVATAR_CROP_MIN_ZOOM,
    AVATAR_CROP_MAX_ZOOM
  );
  const baseScale = safeViewport / Math.min(effWidth, effHeight);
  const displayScale = baseScale * zoom;
  const imgWidth = srcWidth * displayScale;
  const imgHeight = srcHeight * displayScale;
  const displayWidth = effWidth * displayScale;
  const displayHeight = effHeight * displayScale;
  const maxOffsetX = Math.max(0, (displayWidth - safeViewport) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - safeViewport) / 2);
  const offsetX = clampNumber(transform.offsetX ?? 0, -maxOffsetX, maxOffsetX);
  const offsetY = clampNumber(transform.offsetY ?? 0, -maxOffsetY, maxOffsetY);

  return {
    zoom,
    rotation,
    displayScale,
    imgWidth,
    imgHeight,
    displayWidth,
    displayHeight,
    maxOffsetX,
    maxOffsetY,
    offsetX,
    offsetY,
  };
}

export function clampAvatarCropTransform(
  srcWidth: number,
  srcHeight: number,
  transform: Partial<AvatarCropTransform>,
  viewportSize: number = AVATAR_CROP_VIEWPORT_PX
): AvatarCropTransform {
  const layout = computeAvatarCropLayout(srcWidth, srcHeight, transform, viewportSize);
  return {
    zoom: layout.zoom,
    offsetX: layout.offsetX,
    offsetY: layout.offsetY,
    rotation: layout.rotation,
  };
}

/**
 * Scales zoom while keeping the image point currently centered in the crop frame stationary.
 */
export function scaleAvatarCropTransformZoom(
  srcWidth: number,
  srcHeight: number,
  current: AvatarCropTransform,
  nextZoom: number,
  viewportSize: number = AVATAR_CROP_VIEWPORT_PX
): AvatarCropTransform {
  const currLayout = computeAvatarCropLayout(srcWidth, srcHeight, current, viewportSize);
  const clampedNextZoom = clampNumber(nextZoom, AVATAR_CROP_MIN_ZOOM, AVATAR_CROP_MAX_ZOOM);
  const ratio = clampedNextZoom / currLayout.zoom;
  return clampAvatarCropTransform(
    srcWidth,
    srcHeight,
    {
      zoom: clampedNextZoom,
      offsetX: currLayout.offsetX * ratio,
      offsetY: currLayout.offsetY * ratio,
      rotation: currLayout.rotation,
    },
    viewportSize
  );
}

/**
 * Rotates the crop transform by +/-90deg while rotating the pan offset so the
 * focal subject currently centered in the circle stays centered.
 */
export function rotateAvatarCropTransform(
  srcWidth: number,
  srcHeight: number,
  current: AvatarCropTransform,
  deltaDeg: -90 | 90,
  viewportSize: number = AVATAR_CROP_VIEWPORT_PX
): AvatarCropTransform {
  const currLayout = computeAvatarCropLayout(srcWidth, srcHeight, current, viewportSize);
  const nextRotation = normalizeAvatarCropRotation(currLayout.rotation + deltaDeg);
  const nextOffsetX = deltaDeg === 90 ? -currLayout.offsetY : currLayout.offsetY;
  const nextOffsetY = deltaDeg === 90 ? currLayout.offsetX : -currLayout.offsetX;
  return clampAvatarCropTransform(
    srcWidth,
    srcHeight,
    {
      zoom: currLayout.zoom,
      offsetX: nextOffsetX,
      offsetY: nextOffsetY,
      rotation: nextRotation,
    },
    viewportSize
  );
}

/**
 * Maps an interactive crop viewport transform `(zoom, offsetX, offsetY, rotation)` to the
 * source-image bounding rectangle `(sx, sy, sw, sh)` visible inside the crop frame.
 */
export function computeInteractiveAvatarCropRect(
  srcWidth: number,
  srcHeight: number,
  transform: Partial<AvatarCropTransform> = DEFAULT_AVATAR_CROP,
  viewportSize: number = AVATAR_CROP_VIEWPORT_PX
): { sx: number; sy: number; sw: number; sh: number } {
  const safeViewport = Number.isFinite(viewportSize) && viewportSize > 0
    ? viewportSize
    : AVATAR_CROP_VIEWPORT_PX;
  const layout = computeAvatarCropLayout(srcWidth, srcHeight, transform, safeViewport);
  const sw = Math.min(srcWidth, safeViewport / layout.displayScale);
  const sh = Math.min(srcHeight, safeViewport / layout.displayScale);
  const ox = layout.offsetX / layout.displayScale;
  const oy = layout.offsetY / layout.displayScale;

  // Map viewport offset back into unrotated source coordinates via inverse rotation (-rotation).
  let srcDx = -ox;
  let srcDy = -oy;
  if (layout.rotation === 90) {
    srcDx = -oy;
    srcDy = ox;
  } else if (layout.rotation === 180) {
    srcDx = ox;
    srcDy = oy;
  } else if (layout.rotation === 270) {
    srcDx = oy;
    srcDy = -ox;
  }

  const rawSx = (srcWidth - sw) / 2 + srcDx;
  const rawSy = (srcHeight - sh) / 2 + srcDy;
  const sx = clampNumber(rawSx, 0, Math.max(0, srcWidth - sw));
  const sy = clampNumber(rawSy, 0, Math.max(0, srcHeight - sh));
  return { sx, sy, sw, sh };
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new AvatarImageError('unsupported_env', 'FileReader unavailable'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new AvatarImageError('decode_failed', 'Empty FileReader result'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      reject(new AvatarImageError('decode_failed', 'Failed to read image blob'));
    };
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new AvatarImageError('unsupported_env', 'Image constructor unavailable'));
      return;
    }
    const img = new Image();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      img.onload = null;
      img.onerror = null;
      reject(new AvatarImageError('decode_failed', 'Image decode timed out'));
    }, 15000);

    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new AvatarImageError('decode_failed', 'Decoded image has zero dimensions'));
        return;
      }
      resolve(img);
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new AvatarImageError('decode_failed', 'Failed to decode image'));
    };
    img.src = src;
  });
}

export interface CropAvatarOptions {
  size?: number;
  quality?: number;
  maxBytes?: number;
  crop?: AvatarCropTransform;
  viewportSize?: number;
}

/**
 * Crop a user-selected raster image (`File`, `Blob`, or validated `data:image/...` URL)
 * to a centered 1:1 `128×128` square avatar `dataUrl`, preferring `image/webp` (~0.86)
 * with automatic fallback to `image/png`.
 */
export async function cropImageToSquareAvatarDataUrl(
  source: File | Blob | string,
  options: CropAvatarOptions = {}
): Promise<string> {
  const targetSize = Math.max(
    16,
    Math.floor(options.size ?? AVATAR_TARGET_SIZE)
  );
  const quality = options.quality ?? AVATAR_WEBP_QUALITY;
  const maxBytes = options.maxBytes ?? MAX_AVATAR_OUTPUT_BYTES;

  let loadSrc = '';
  let objectUrlToRevoke: string | null = null;

  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (!isSafeSourceDataUrl(trimmed)) {
      if (/^data:image\/svg\+xml/i.test(trimmed)) {
        throw new AvatarImageError('invalid_type', 'SVG images are not allowed');
      }
      const bytes = estimateDataUrlDecodedBytes(trimmed);
      if (bytes > MAX_AVATAR_SOURCE_BYTES) {
        throw new AvatarImageError('too_large', 'Source image exceeds maximum size');
      }
      throw new AvatarImageError('invalid_type', 'Unsupported image data URL');
    }
    loadSrc = trimmed;
  } else if (source && typeof source === 'object') {
    const fileLike = source as File;
    validateAvatarSourceFile(fileLike);
    if (
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL === 'function'
    ) {
      objectUrlToRevoke = URL.createObjectURL(source);
      loadSrc = objectUrlToRevoke;
    } else {
      loadSrc = await readBlobAsDataUrl(source);
    }
  } else {
    throw new AvatarImageError('invalid_type', 'Invalid image source');
  }

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    if (objectUrlToRevoke && typeof URL !== 'undefined') {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
    throw new AvatarImageError('unsupported_env', 'Canvas environment unavailable');
  }

  try {
    const img = await loadImageElement(loadSrc);
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new AvatarImageError('decode_failed', '2D canvas context unavailable');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.clearRect(0, 0, targetSize, targetSize);
    if (options.crop) {
      const safeViewport =
        Number.isFinite(options.viewportSize) && (options.viewportSize ?? 0) > 0
          ? (options.viewportSize as number)
          : AVATAR_CROP_VIEWPORT_PX;
      const layout = computeAvatarCropLayout(
        img.naturalWidth,
        img.naturalHeight,
        options.crop,
        safeViewport
      );
      const outScale = targetSize / safeViewport;
      ctx.save();
      ctx.translate(
        targetSize / 2 + layout.offsetX * outScale,
        targetSize / 2 + layout.offsetY * outScale
      );
      if (layout.rotation !== 0) {
        ctx.rotate((layout.rotation * Math.PI) / 180);
      }
      const drawW = layout.imgWidth * outScale;
      const drawH = layout.imgHeight * outScale;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      const { sx, sy, sw, sh } = computeSquareCoverCropRect(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetSize, targetSize);
    }

    let output = '';
    try {
      const webpCandidate = canvas.toDataURL('image/webp', quality);
      if (
        webpCandidate.startsWith('data:image/webp;base64,') &&
        estimateDataUrlDecodedBytes(webpCandidate) <= maxBytes
      ) {
        output = webpCandidate;
      } else if (webpCandidate.startsWith('data:image/webp;base64,')) {
        const lowerQuality = canvas.toDataURL('image/webp', 0.72);
        if (
          lowerQuality.startsWith('data:image/webp;base64,') &&
          estimateDataUrlDecodedBytes(lowerQuality) <= maxBytes
        ) {
          output = lowerQuality;
        }
      }
    } catch {
      output = '';
    }

    if (!output) {
      output = canvas.toDataURL('image/png');
    }

    if (
      !isSafeAvatarDataUrl(output) ||
      estimateDataUrlDecodedBytes(output) > maxBytes
    ) {
      throw new AvatarImageError(
        'too_large',
        'Cropped avatar exceeds maximum allowed payload size'
      );
    }

    return output;
  } finally {
    if (
      objectUrlToRevoke &&
      typeof URL !== 'undefined' &&
      typeof URL.revokeObjectURL === 'function'
    ) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
  }
}
