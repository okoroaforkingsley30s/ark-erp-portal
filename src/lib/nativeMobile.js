import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';

import { supabase } from '@/lib/supabaseClient';

export const MOBILE_SOUND_OPTIONS = [
  { value: 'ark_default', label: 'ARK ONE Bell', sound: 'ark_bell.wav' },
  { value: 'ark_chime', label: 'Gentle Chime', sound: 'ark_chime.wav' },
  { value: 'ark_alert', label: 'Urgent Alert', sound: 'ark_alert.wav' },
];

const SOUND_STORAGE_KEY = 'ark_mobile_notification_sound';
const GPS_STORAGE_KEY = 'ark_mobile_gps_enabled';

export const isNativeMobile = () => Capacitor.isNativePlatform();

export function getMobileSoundPreference() {
  return localStorage.getItem(SOUND_STORAGE_KEY) || 'ark_default';
}

async function createNotificationChannels() {
  for (const option of MOBILE_SOUND_OPTIONS) {
    await PushNotifications.createChannel({
      id: option.value,
      name: option.label,
      description: `ARK ONE notifications using ${option.label}`,
      importance: option.value === 'ark_alert' ? 5 : 4,
      visibility: 1,
      vibration: true,
      sound: option.sound,
    });
  }
}

export async function saveMobileSoundPreference(soundKey) {
  const allowed = MOBILE_SOUND_OPTIONS.some((option) => option.value === soundKey);
  if (!allowed) throw new Error('Unsupported notification sound');

  localStorage.setItem(SOUND_STORAGE_KEY, soundKey);

  if (isNativeMobile()) {
    await createNotificationChannels();
    const { error } = await supabase.rpc('ark_set_mobile_notification_sound', {
      p_sound_key: soundKey,
    });
    if (error) throw error;
  }
}

function normalizePushTarget(data = {}) {
  const raw = data.link || data.target_url || data.action_url || '/notifications';
  if (raw.startsWith('/')) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.hash?.replace(/^#/, '') || '/notifications';
  } catch {
    return '/notifications';
  }
}

async function registerToken(token, user) {
  const { error } = await supabase.rpc('ark_register_mobile_device', {
    p_push_token: token,
    p_platform: Capacitor.getPlatform(),
    p_sound_key: getMobileSoundPreference(),
    p_device_label: navigator.userAgent.slice(0, 250),
  });
  if (error) throw error;

  console.info('ARK ONE mobile push registered', {
    user: user?.email,
    platform: Capacitor.getPlatform(),
  });
}

export async function syncCurrentLocation() {
  if (!isNativeMobile()) return null;

  const permissions = await Geolocation.checkPermissions();
  let locationPermission = permissions.location;

  if (locationPermission !== 'granted') {
    const requested = await Geolocation.requestPermissions({
      permissions: ['location'],
    });
    locationPermission = requested.location;
  }

  if (locationPermission !== 'granted') {
    throw new Error('Location permission was not granted');
  }

  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 60000,
  });

  localStorage.setItem(GPS_STORAGE_KEY, 'true');

  const { error } = await supabase.rpc('ark_update_mobile_location', {
    p_latitude: position.coords.latitude,
    p_longitude: position.coords.longitude,
    p_accuracy_meters: position.coords.accuracy,
    p_recorded_at: new Date(position.timestamp).toISOString(),
  });
  if (error) throw error;

  return position;
}

export function isGpsEnabled() {
  return localStorage.getItem(GPS_STORAGE_KEY) === 'true';
}

export async function initializeNativeMobile({ user, navigate, onResume }) {
  if (!isNativeMobile() || !user?.email) return () => {};

  await createNotificationChannels();

  const permission = await PushNotifications.checkPermissions();
  let receivePermission = permission.receive;

  if (receivePermission === 'prompt' || receivePermission === 'prompt-with-rationale') {
    const requested = await PushNotifications.requestPermissions();
    receivePermission = requested.receive;
  }

  const listeners = [];

  listeners.push(
    await PushNotifications.addListener('registration', (token) => {
      registerToken(token.value, user).catch((error) => {
        console.error('ARK ONE push registration failed', error);
      });
    })
  );

  listeners.push(
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('ARK ONE native push registration error', error);
    })
  );

  listeners.push(
    await PushNotifications.addListener('pushNotificationReceived', () => {
      onResume?.();
    })
  );

  listeners.push(
    await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
      navigate(normalizePushTarget(event.notification?.data || {}));
      onResume?.();
    })
  );

  listeners.push(
    await CapacitorApp.addListener('backButton', () => {
      const currentPath = window.location.hash.replace(/^#/, '').split('?')[0] || '/';
      const homePaths = new Set(['/', '/dashboard', '/welcome', '/login']);

      if (!homePaths.has(currentPath)) {
        navigate(-1);
        return;
      }

      CapacitorApp.minimizeApp();
    })
  );

  listeners.push(
    await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      onResume?.();

      if (isGpsEnabled()) {
        syncCurrentLocation().catch((error) => {
          console.warn('ARK ONE location refresh skipped', error);
        });
      }
    })
  );

  if (receivePermission === 'granted') {
    await PushNotifications.register();
  }

  return () => {
    listeners.forEach((listener) => listener.remove());
  };
}
