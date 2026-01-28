import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

interface UseConnectionTimeoutOptions {
  timeout?: number;
  onTimeout?: () => void;
}

/**
 * Hook to handle connection timeout states for native apps.
 * Helps detect when a page is stuck loading due to network issues.
 */
export function useConnectionTimeout(
  isLoading: boolean,
  options: UseConnectionTimeoutOptions = {}
) {
  const { timeout = 15000, onTimeout } = options;
  const [isTimedOut, setIsTimedOut] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetTimeout = useCallback(() => {
    setIsTimedOut(false);
    clearTimeoutRef();
  }, [clearTimeoutRef]);

  useEffect(() => {
    // Only use timeout on native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (isLoading) {
      clearTimeoutRef();
      timeoutRef.current = window.setTimeout(() => {
        setIsTimedOut(true);
        onTimeout?.();
      }, timeout);
    } else {
      clearTimeoutRef();
      setIsTimedOut(false);
    }

    return clearTimeoutRef;
  }, [isLoading, timeout, onTimeout, clearTimeoutRef]);

  return {
    isTimedOut,
    resetTimeout,
  };
}
