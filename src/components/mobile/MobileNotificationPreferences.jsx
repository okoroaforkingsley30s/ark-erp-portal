import { useState } from 'react';
import { BellRing, MapPin } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  MOBILE_SOUND_OPTIONS,
  getMobileSoundPreference,
  isGpsEnabled,
  isNativeMobile,
  saveMobileSoundPreference,
  syncCurrentLocation,
} from '@/lib/nativeMobile';

export default function MobileNotificationPreferences() {
  const [sound, setSound] = useState(getMobileSoundPreference);
  const [gpsEnabled, setGpsEnabled] = useState(isGpsEnabled);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  if (!isNativeMobile()) return null;

  const updateSound = async (event) => {
    const value = event.target.value;
    setSound(value);
    setWorking(true);
    setMessage('');
    try {
      await saveMobileSoundPreference(value);
      setMessage('Notification sound updated.');
    } catch (error) {
      setMessage(error.message || 'Could not update notification sound.');
    } finally {
      setWorking(false);
    }
  };

  const enableGps = async () => {
    setWorking(true);
    setMessage('');
    try {
      await syncCurrentLocation();
      setGpsEnabled(true);
      setMessage('GPS enabled and current location synchronized.');
    } catch (error) {
      setMessage(error.message || 'Could not enable GPS.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card className="p-4 border-[#ff5a00]/30 bg-[#08153d]/60 text-white">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <BellRing className="w-4 h-4 text-[#ff5a00]" />
            Notification sound
          </span>
          <select
            value={sound}
            disabled={working}
            onChange={updateSound}
            className="w-full h-11 rounded-lg border border-white/15 bg-[#071942] px-3 text-sm text-white"
          >
            {MOBILE_SOUND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="w-4 h-4 text-[#ff5a00]" />
            Device location
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={working}
            onClick={enableGps}
            className="w-full h-11 border-white/15 bg-white/5 text-white"
          >
            {gpsEnabled ? 'Refresh GPS location' : 'Enable GPS'}
          </Button>
        </div>
      </div>

      {message && <p className="mt-3 text-xs text-slate-200">{message}</p>}
    </Card>
  );
}
