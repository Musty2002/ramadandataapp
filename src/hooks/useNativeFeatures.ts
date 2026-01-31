import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

/**
 * Simplified native features hook - handles keyboard only.
 * Network resilience is handled by TanStack Query's built-in features
 * (retry, refetch on reconnect, caching).
 */
export function useNativeFeatures() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const initKeyboard = async () => {
      try {
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
      } catch (error) {
        console.warn('[NativeFeatures] Failed to add keyboard listeners:', error);
      }
    };

    initKeyboard();

    return () => {
      try {
        Keyboard.removeAllListeners();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  return {
    isKeyboardOpen,
  };
}
