import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { AppLockScreen, isAppLockEnabled, isAppUnlocked, isAppLockPinSetup } from './AppLockScreen';

interface AppLockWrapperProps {
  children: React.ReactNode;
}

export function AppLockWrapper({ children }: AppLockWrapperProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Only check on native platforms
    if (!Capacitor.isNativePlatform()) {
      setIsChecking(false);
      return;
    }

    // Check if app lock is enabled and PIN is set up
    const shouldShowLock = isAppLockEnabled() && isAppLockPinSetup() && !isAppUnlocked();
    setIsLocked(shouldShowLock);
    setIsChecking(false);

    // Listen for app state changes (resume from background)
    const handleAppStateChange = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        // App became active - check if should lock
        const shouldLock = isAppLockEnabled() && isAppLockPinSetup() && !isAppUnlocked();
        if (shouldLock) {
          setIsLocked(true);
        }
      }
    });

    return () => {
      handleAppStateChange.then(listener => listener.remove());
    };
  }, []);

  const handleUnlock = () => {
    setIsLocked(false);
  };

  // Show nothing while checking
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  // Show lock screen if locked
  if (isLocked) {
    return <AppLockScreen onUnlock={handleUnlock} mode="unlock" />;
  }

  return <>{children}</>;
}
