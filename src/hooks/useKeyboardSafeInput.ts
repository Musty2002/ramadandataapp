import { useCallback, useRef } from 'react';

/**
 * Helps on some Android WebViews where focusing password can trigger a spurious
 * empty change event for email, and where the keyboard can cover focused inputs.
 */
export function useKeyboardSafeInput() {
  const lastFocusedNameRef = useRef<string | null>(null);
  const lastFocusAtRef = useRef<number>(0);

  const registerFocus = useCallback(
    (name: string) =>
      (e: React.FocusEvent<HTMLElement>) => {
        lastFocusedNameRef.current = name;
        lastFocusAtRef.current = Date.now();

        const el = e.currentTarget as HTMLElement;

        // Defer so the keyboard/viewport has time to settle.
        window.setTimeout(() => {
          try {
            el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
          } catch {
            // ignore
          }
        }, 250);
      },
    [],
  );

  const shouldIgnoreEmailBlank = useCallback((nextEmail: string, currentEmail: string) => {
    if (nextEmail !== '' || !currentEmail) return false;

    const recentlyFocusedPassword =
      lastFocusedNameRef.current === 'password' && Date.now() - lastFocusAtRef.current < 1500;

    return recentlyFocusedPassword;
  }, []);

  return { registerFocus, shouldIgnoreEmailBlank };
}
