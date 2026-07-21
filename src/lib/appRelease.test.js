import { describe, expect, it } from 'vitest';
import { compareVersions, normalizeReleaseManifest } from './appRelease';

describe('application releases', () => {
  it('compares semantic versions', () => {
    expect(compareVersions('1.0.16', '1.0.15')).toBe(1);
    expect(compareVersions('1.0.16', '1.0.16')).toBe(0);
    expect(compareVersions('1.0.15', '1.0.16')).toBe(-1);
  });

  it('accepts only HTTPS artifact URLs', () => {
    const manifest = normalizeReleaseManifest({
      version: '1.0.17',
      windows: { url: 'https://downloads.example/windows.exe' },
      android: { url: 'http://unsafe.example/app.apk', version_code: 10017 },
    });
    expect(manifest.windowsUrl).toContain('https://');
    expect(manifest.androidUrl).toBe('');
    expect(manifest.androidVersionCode).toBe(10017);
  });
});
