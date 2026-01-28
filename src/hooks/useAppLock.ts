import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { isPinLoginAvailable, getStoredUserForPinLogin } from '@/components/auth/PinLoginScreen';
import { isTransactionPinSetup } from '@/components/auth/TransactionPinDialog';

const APP_LOCK_UNLOCKED_KEY = 'app_lock_unlocked_session';

/**
 * Hook to manage app lock state on native platforms.
 * Users with a PIN set must unlock the app on cold start.
 */
export function useAppLock() {
  const [isLocked, setIsLocked] = useState<boolean | null>(null); // null = checking
  const [storedUser, setStoredUser] = useState<ReturnType<typeof getStoredUserForPinLogin>>(null);
  const [hasChecked, setHasChecked] = useState(false);

  // Check lock state on mount
  useEffect(() => {
    const checkLockState = async () => {
      // Small delay for native platforms to ensure storage is accessible
      if (Capacitor.isNativePlatform()) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Check if already unlocked this session
      const unlockedThisSession = sessionStorage.getItem(APP_LOCK_UNLOCKED_KEY) === 'true';
      
      // Check if PIN is set up
      const pinSetup = isTransactionPinSetup();
      const user = getStoredUserForPinLogin();
      const pinAvailable = isPinLoginAvailable();

      console.log('[AppLock] Check state:', { 
        unlockedThisSession, 
        pinSetup, 
        hasUser: !!user, 
        pinAvailable,
        isNative: Capacitor.isNativePlatform()
      });

      setStoredUser(user);

      // Only lock if:
      // 1. User has PIN set up
      // 2. Not already unlocked this session
      // 3. We have stored user info
      if (pinSetup && user && pinAvailable && !unlockedThisSession) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }

      setHasChecked(true);
    };

    checkLockState();
  }, []);

  // Mark as unlocked for this session
  const unlock = useCallback(() => {
    sessionStorage.setItem(APP_LOCK_UNLOCKED_KEY, 'true');
    setIsLocked(false);
  }, []);

  // Lock the app (for manual lock or testing)
  const lock = useCallback(() => {
    sessionStorage.removeItem(APP_LOCK_UNLOCKED_KEY);
    setIsLocked(true);
  }, []);

  // Clear lock state (on logout)
  const clearLockState = useCallback(() => {
    sessionStorage.removeItem(APP_LOCK_UNLOCKED_KEY);
  }, []);

  return {
    isLocked,
    storedUser,
    hasChecked,
    unlock,
    lock,
    clearLockState,
  };
}
