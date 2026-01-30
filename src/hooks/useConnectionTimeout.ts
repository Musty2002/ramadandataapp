import { useState, useEffect, useRef, useCallback } from 'react';

interface UseConnectionTimeoutOptions {
  timeout?: number;
  onTimeout?: () => void;
  enabled?: boolean; // Allow disabling
}

/**
 * Hook to handle connection timeout states.
 * Helps detect when a page is stuck loading due to network issues.
 * Works on both web and native platforms.
 */
export function useConnectionTimeout(
  isLoading: boolean,
  options: UseConnectionTimeoutOptions = {}
) {
  const { timeout = 12000, onTimeout, enabled = true } = options;
  const [isTimedOut, setIsTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingStartRef = useRef<number | null>(null);

  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetTimeout = useCallback(() => {
    setIsTimedOut(false);
    loadingStartRef.current = null;
    clearTimeoutRef();
  }, [clearTimeoutRef]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (isLoading) {
      // Track when loading started
      if (!loadingStartRef.current) {
        loadingStartRef.current = Date.now();
      }
      
      clearTimeoutRef();
      timeoutRef.current = setTimeout(() => {
        console.log('[ConnectionTimeout] Loading timed out after', timeout, 'ms');
        setIsTimedOut(true);
        onTimeout?.();
      }, timeout);
    } else {
      clearTimeoutRef();
      setIsTimedOut(false);
      loadingStartRef.current = null;
    }

    return clearTimeoutRef;
  }, [isLoading, timeout, onTimeout, clearTimeoutRef, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeoutRef();
    };
  }, [clearTimeoutRef]);

  return {
    isTimedOut,
    resetTimeout,
    loadingDuration: loadingStartRef.current 
      ? Date.now() - loadingStartRef.current 
      : 0,
  };
}
