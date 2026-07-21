import React from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, X } from 'lucide-react';
import { APP_VERSION, compareVersions, useReleaseManifest } from '@/lib/appRelease';

export default function AppUpdateNotice() {
  const manifest = useReleaseManifest();
  const [dismissed, setDismissed] = React.useState(false);
  const platform = Capacitor.getPlatform();

  if (platform !== 'android' || dismissed || !manifest?.androidUrl) return null;
  if (compareVersions(manifest.version, APP_VERSION) <= 0) return null;

  return (
    <div className="fixed top-3 left-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-orange-400/40 bg-[#071942] p-4 text-white shadow-2xl">
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-[#ff5a00]" />
        <div className="flex-1">
          <p className="font-semibold">ARK ONE {manifest.version} is available</p>
          <p className="mt-1 text-xs text-slate-300">{manifest.notes || 'Install the latest secure Android update.'}</p>
          <a href={manifest.androidUrl} className="mt-3 inline-flex rounded-lg bg-[#ff5a00] px-3 py-2 text-xs font-semibold text-white">
            Download update
          </a>
        </div>
        {!manifest.mandatory && (
          <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss update"><X className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}
