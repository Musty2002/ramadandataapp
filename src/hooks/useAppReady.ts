import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to manage app readiness state, especially for native platforms.
 * Handles coordination between native splash screen and web splash.
 */
export function useAppReady() {
  const [isReady, setIsReady] = useState(false);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  useEffect(() => {
    const init = async () => {
      // On native platforms, wait a moment for storage to be ready
      if (Capacitor.isNativePlatform()) {
        // Small delay to ensure localStorage is accessible
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Check if splash was already shown this session
      const splashShown = sessionStorage.getItem('splashShown');
      
      setHasCheckedStorage(true);
      
      if (splashShown) {
        setIsReady(true);
      }
    };

    init();
  }, []);

  const markReady = () => {
    sessionStorage.setItem('splashShown', 'true');
    setIsReady(true);
  };

  return {
    isReady,
    hasCheckedStorage,
    markReady,
    showSplash: hasCheckedStorage && !isReady,
  };
}
