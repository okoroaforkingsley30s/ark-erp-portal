import { describe, expect, it } from 'vitest';
import { safeUploadName, validateEvidenceFile } from '@/lib/fileValidation';

const file = (name, type, size) => ({ name, type, size });

describe('file validation', () => {
  it('accepts permitted images within the size limit', () => {
    const image = file('evidence.png', 'image/png', 1024);
    expect(validateEvidenceFile(image)).toBe(image);
  });

  it('rejects unsupported MIME types and empty files', () => {
    expect(() => validateEvidenceFile(file('payload.svg', 'image/svg+xml', 100))).toThrow('Only JPEG, PNG, or WebP');
    expect(() => validateEvidenceFile(file('empty.png', 'image/png', 0))).toThrow('8 MB or smaller');
  });

  it('enforces separate image and video limits', () => {
    expect(() => validateEvidenceFile(file('large.jpg', 'image/jpeg', 8 * 1024 * 1024 + 1))).toThrow('8 MB');
    expect(() => validateEvidenceFile(file('clip.mp4', 'video/mp4', 1024))).toThrow('Only JPEG');
    expect(validateEvidenceFile(file('clip.mp4', 'video/mp4', 50 * 1024 * 1024), { allowVideo: true }).type).toBe('video/mp4');
  });

  it('sanitizes and bounds storage object names', () => {
    expect(safeUploadName('../../pay roll (final).png')).toBe('.._.._pay_roll_final_.png');
    expect(safeUploadName('a'.repeat(200))).toHaveLength(120);
  });
});
