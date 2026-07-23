import { queryClientInstance } from '@/lib/query-client';

let initialized = false;

export function initializeDesktopRuntime() {
  if (initialized) return;
  initialized = true;

  const refresh = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      queryClientInstance.invalidateQueries({ refetchType: 'active' });
    }
  };

  window.addEventListener('online', refresh);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);

  if (window.arkDesktop?.onDataRefresh) {
    window.arkDesktop.onDataRefresh(refresh);
  }
}
