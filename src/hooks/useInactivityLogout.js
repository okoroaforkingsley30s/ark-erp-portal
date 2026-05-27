import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

const INACTIVE_MS = 20 * 60 * 1000; // 20 minutes

export default function useInactivityLogout(enabled = true) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const logoutUser = async () => {
      try {
        sessionStorage.setItem('ark_logout_reason', 'inactivity');

        await supabase.auth.signOut();

        window.location.href = '/login';
      } catch (err) {
        console.error('Auto logout failed:', err);
      }
    };

    const reset = () => {
      clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        logoutUser();
      }, INACTIVE_MS);
    };

    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ];

    events.forEach((e) =>
      window.addEventListener(e, reset, { passive: true })
    );

    reset();

    return () => {
      clearTimeout(timerRef.current);

      events.forEach((e) =>
        window.removeEventListener(e, reset)
      );
    };
  }, [enabled]);
}