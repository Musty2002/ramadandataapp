import { ReactNode, useEffect, useRef } from 'react';
import { BottomNav } from './BottomNav';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { App } from '@capacitor/app';

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function MobileLayout({ children, showNav = true }: MobileLayoutProps) {
  // Track the largest viewport height we've seen so we can recover from
  // cases where Android (USSD overlays / keyboard) leaves the WebView “stuck” smaller.
  const maxViewportHeightRef = useRef(0);
  const keyboardVisibleRef = useRef(false);

  useEffect(() => {
    const isTextInputFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
    };

    const updateAppHeight = () => {
      const vvHeight = window.visualViewport?.height;
      const innerHeight = window.innerHeight;
      const screenHeight = window.screen?.height ?? 0;

      // Some devices report either visualViewport OR innerHeight incorrectly.
      // Take the larger as our best measurement of the current usable area.
      const measured = Math.max(vvHeight ?? 0, innerHeight);

      // Learn the "full" height over time, including screen.availHeight
      const availHeight = window.screen?.availHeight ?? 0;
      const fullCandidate = Math.max(measured, screenHeight, availHeight);
      if (fullCandidate > maxViewportHeightRef.current) {
        maxViewportHeightRef.current = fullCandidate;
      }

      // If a text field is focused, assume the keyboard may be open even if
      // native keyboard events fail on certain devices.
      const maybeKeyboardOpen =
        Capacitor.isNativePlatform() && isTextInputFocused() && measured < maxViewportHeightRef.current * 0.75;

      const keyboardOpen = keyboardVisibleRef.current || maybeKeyboardOpen;

      // When the keyboard is NOT open, AGGRESSIVELY force-restore to the largest height we've seen.
      // This is the key fix for the "half screen" stuck state.
      const target = keyboardOpen ? measured : maxViewportHeightRef.current;

      document.documentElement.style.setProperty('--app-height', `${Math.round(target)}px`);
      
      // Also force a style recalculation to ensure the browser applies it
      if (!keyboardOpen && measured < maxViewportHeightRef.current * 0.9) {
        document.documentElement.style.height = `${Math.round(target)}px`;
        document.body.style.height = `${Math.round(target)}px`;
      }
    };

    // Some Android overlays (USSD dialogs) can leave the WebView with a stale viewport.
    // Re-apply the height multiple times with more aggressive timing to catch late layout updates.
    const stabilizeAppHeight = () => {
      updateAppHeight();
      requestAnimationFrame(updateAppHeight);
      requestAnimationFrame(() => requestAnimationFrame(updateAppHeight));
      [50, 150, 300, 600, 1000].forEach((ms) => setTimeout(updateAppHeight, ms));
    };

    stabilizeAppHeight();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', stabilizeAppHeight);
    vv?.addEventListener('scroll', stabilizeAppHeight);
    window.addEventListener('resize', stabilizeAppHeight);
    window.addEventListener('orientationchange', stabilizeAppHeight);

    const handlePromises: Promise<PluginListenerHandle>[] = [];

    if (Capacitor.isNativePlatform()) {
      // Keyboard events (when they fire) + resume (covers USSD flow on some devices)
      try {
        handlePromises.push(
          Keyboard.addListener('keyboardWillShow', () => {
            keyboardVisibleRef.current = true;
            stabilizeAppHeight();
          }),
        );
        handlePromises.push(
          Keyboard.addListener('keyboardDidShow', () => {
            keyboardVisibleRef.current = true;
            stabilizeAppHeight();
          }),
        );
        handlePromises.push(
          Keyboard.addListener('keyboardWillHide', () => {
            keyboardVisibleRef.current = false;
            // Immediately try to restore
            setTimeout(stabilizeAppHeight, 0);
          }),
        );
        handlePromises.push(
          Keyboard.addListener('keyboardDidHide', () => {
            keyboardVisibleRef.current = false;
            // Multiple stabilization attempts with delays
            stabilizeAppHeight();
            setTimeout(stabilizeAppHeight, 100);
            setTimeout(stabilizeAppHeight, 300);
          }),
        );
        handlePromises.push(
          App.addListener('resume', () => {
            // After USSD overlays, treat as keyboard closed and aggressively re-stabilize.
            keyboardVisibleRef.current = false;
            setTimeout(stabilizeAppHeight, 0);
            setTimeout(stabilizeAppHeight, 100);
            setTimeout(stabilizeAppHeight, 300);
            setTimeout(stabilizeAppHeight, 600);
          }),
        );
      } catch {
        // Ignore if a plugin isn't available in a given runtime (web preview, etc.)
      }
    }

    return () => {
      vv?.removeEventListener('resize', stabilizeAppHeight);
      vv?.removeEventListener('scroll', stabilizeAppHeight);
      window.removeEventListener('resize', stabilizeAppHeight);
      window.removeEventListener('orientationchange', stabilizeAppHeight);
      handlePromises.forEach((p) => p.then((h) => h.remove()).catch(() => {}));
    };
  }, []);

  return (
    <div className="w-full max-w-md mx-auto bg-background flex flex-col min-h-[var(--app-height)]">
      <main className={`flex-1 ${showNav ? 'pb-20' : ''}`}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}