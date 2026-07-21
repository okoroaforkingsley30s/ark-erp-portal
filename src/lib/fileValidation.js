const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export function validateEvidenceFile(file, { allowVideo = false } = {}) {
  if (!file) throw new Error('Choose a file to upload.');

  const allowedTypes = allowVideo
    ? new Set([...IMAGE_TYPES, ...VIDEO_TYPES])
    : IMAGE_TYPES;
  if (!allowedTypes.has(file.type)) {
    throw new Error(
      allowVideo
        ? 'Only JPEG, PNG, WebP, MP4, WebM, or MOV evidence files are allowed.'
        : 'Only JPEG, PNG, or WebP images are allowed.'
    );
  }

  const isVideo = VIDEO_TYPES.has(file.type);
  const maxBytes = isVideo ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(`${isVideo ? 'Video' : 'Image'} files must be ${isVideo ? '50 MB' : '8 MB'} or smaller.`);
  }

  return file;
}

export function safeUploadName(name = 'evidence') {
  return String(name)
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(-120);
}
// @ts-check
