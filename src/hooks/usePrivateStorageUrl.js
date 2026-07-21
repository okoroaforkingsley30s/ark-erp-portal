import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function storageReference(bucket, path) {
  return `storage://${bucket}/${path}`;
}

function storageLocation(value, defaultBucket) {
  if (!value) return null;
  if (typeof value === 'object' && value.path) {
    return { bucket: value.bucket || defaultBucket, path: value.path };
  }
  if (typeof value !== 'string') return null;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const url = new URL(value);
      const marker = '/storage/v1/object/public/';
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex >= 0) {
        const remainder = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
        const slash = remainder.indexOf('/');
        if (slash > 0) return { bucket: remainder.slice(0, slash), path: remainder.slice(slash + 1) };
      }
    } catch {
      return null;
    }
    return null;
  }
  if (!value.startsWith('storage://')) return null;
  const remainder = value.slice('storage://'.length);
  const slash = remainder.indexOf('/');
  if (slash < 1) return null;
  return { bucket: remainder.slice(0, slash), path: remainder.slice(slash + 1) };
}

export function usePrivateStorageUrl(value, defaultBucket, expiresIn = 15 * 60) {
  const location = useMemo(
    () => storageLocation(value, defaultBucket),
    [defaultBucket, value]
  );
  const fallback = typeof value === 'string'
    ? value
    : value?.url || value?.publicUrl || value?.file_url || '';
  const [url, setUrl] = useState(location ? '' : fallback);

  useEffect(() => {
    let active = true;
    if (!location?.bucket || !location.path) {
      setUrl(fallback);
      return () => { active = false; };
    }

    supabase.storage.from(location.bucket).createSignedUrl(location.path, expiresIn)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('Could not create private evidence URL:', error.message);
          setUrl('');
        } else {
          setUrl(data?.signedUrl || '');
        }
      });

    return () => { active = false; };
  }, [expiresIn, fallback, location]);

  return url;
}

export function usePrivateStorageItems(items, defaultBucket, expiresIn = 15 * 60) {
  const safeItems = useMemo(() => Array.isArray(items) ? items : [], [items]);
  const signature = useMemo(
    () => safeItems.map((item) => JSON.stringify(item)).join('|'),
    [safeItems]
  );
  const [resolved, setResolved] = useState(safeItems);

  useEffect(() => {
    let active = true;
    Promise.all(safeItems.map(async (item) => {
      const location = storageLocation(item, defaultBucket);
      if (!location?.path) {
        return typeof item === 'object' ? item : { name: String(item).split('/').pop(), url: item };
      }
      const { data, error } = await supabase.storage
        .from(location.bucket)
        .createSignedUrl(location.path, expiresIn);
      if (error) return { ...(typeof item === 'object' ? item : {}), url: '' };
      return { ...(typeof item === 'object' ? item : { name: location.path }), url: data.signedUrl };
    })).then((next) => { if (active) setResolved(next); });
    return () => { active = false; };
  }, [defaultBucket, expiresIn, safeItems, signature]);

  return resolved;
}
