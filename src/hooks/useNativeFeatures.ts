import { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

/**
 * Simplified native features hook - handles keyboard only.
 * Network resilience is handled by TanStack Query's built-in features
 * (retry, refetch on reconnect, caching).
 */
export function useNativeFeatures() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (initialized.current) return;
    initialized.current = true;

    const initKeyboard = async () => {
      try {
        // CRITICAL: Remove existing listeners before adding new ones
        await Keyboard.removeAllListeners();

        Keyboard.addListener('keyboardWillShow', () => {
          setIsKeyboardOpen(true);
          document.body.classList.add('keyboard-open');
        });

        Keyboard.addListener('keyboardDidShow', () => {
          setIsKeyboardOpen(true);
          document.body.classList.add('keyboard-open');
        });

        Keyboard.addListener('keyboardWillHide', () => {
          setIsKeyboardOpen(false);
          document.body.classList.remove('keyboard-open');
        });

        Keyboard.addListener('keyboardDidHide', () => {
          setIsKeyboardOpen(false);
          document.body.classList.remove('keyboard-open');
        });

        console.log('[NativeFeatures] Keyboard listeners added');
      } catch (error) {
        console.warn('[NativeFeatures] Failed to add keyboard listeners:', error);
      }
    };

    initKeyboard();

    return () => {
      // Proper cleanup on unmount
      Keyboard.removeAllListeners();
    };
  }, []);

  return {
    isKeyboardOpen,
  };
}
