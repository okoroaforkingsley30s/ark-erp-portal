/* global __APP_VERSION__ */
import { useEffect, useState } from 'react';

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

export function compareVersions(left, right) {
  const a = String(left || '').split(/[.-]/).slice(0, 3).map((value) => Number(value) || 0);
  const b = String(right || '').split(/[.-]/).slice(0, 3).map((value) => Number(value) || 0);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) > (b[index] || 0)) return 1;
    if ((a[index] || 0) < (b[index] || 0)) return -1;
  }
  return 0;
}

const secureUrl = (value) => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
};

export function normalizeReleaseManifest(value) {
  if (!value || typeof value !== 'object') return null;
  const version = String(value.version || '').trim();
  if (!/^\d+\.\d+\.\d+([+-][0-9A-Za-z.-]+)?$/.test(version)) return null;

  return {
    version,
    notes: String(value.notes || '').trim(),
    mandatory: value.mandatory === true,
    windowsUrl: secureUrl(value.windows?.url || value.windows_url),
    androidUrl: secureUrl(value.android?.url || value.android_url),
    androidVersionCode: Number(value.android?.version_code || value.android_version_code || 0),
  };
}

export function useReleaseManifest() {
  const [manifest, setManifest] = useState(null);
  const manifestUrl = String(import.meta.env.VITE_RELEASE_MANIFEST_URL || '').trim();

  useEffect(() => {
    if (!manifestUrl) return undefined;
    let active = true;

    fetch(manifestUrl, { cache: 'no-store', credentials: 'omit' })
      .then((response) => {
        if (!response.ok) throw new Error(`Release manifest returned ${response.status}`);
        return response.json();
      })
      .then((value) => {
        const normalized = normalizeReleaseManifest(value);
        if (active && normalized) setManifest(normalized);
      })
      .catch((error) => console.warn('Release information is unavailable:', error.message));

    return () => { active = false; };
  }, [manifestUrl]);

  return manifest;
}
