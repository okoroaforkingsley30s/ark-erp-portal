import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/AuthContext';
import { initializeNativeMobile } from '@/lib/nativeMobile';

export default function MobilePlatformBridge() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    initializeNativeMobile({
      user,
      navigate,
      onResume: () => queryClient.invalidateQueries(),
    })
      .then((removeListeners) => {
        if (disposed) {
          removeListeners();
          return;
        }
        cleanup = removeListeners;
      })
      .catch((error) => {
        console.error('ARK ONE mobile initialization failed', error);
      });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [user?.id, user?.email, navigate, queryClient]);

  return null;
}
