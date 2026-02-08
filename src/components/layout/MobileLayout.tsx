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

    const blurActiveInput = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
      if (isInput) el.blur();
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

      // When a system overlay (USSD dialog, permission sheet, etc.) is on top,
      // the WebView may keep an input focused even though the keyboard belongs to the OS.
      // Treat focus loss as an overlay signal: clear keyboard state and blur inputs.
      if (Capacitor.isNativePlatform() && !document.hasFocus()) {
        keyboardVisibleRef.current = false;
        blurActiveInput();
      }

      const webInputFocused = isTextInputFocused();

      // USSD dialogs can trigger native "keyboard shown" events even though
      // the keyboard belongs to the system dialog, not our WebView.
      // If we don't have a focused input in the WebView, treat keyboard as closed.
      if (keyboardVisibleRef.current && !webInputFocused) {
        keyboardVisibleRef.current = false;
      }

      // If a text field is focused, assume the keyboard may be open even if
      // native keyboard events fail on certain devices.
      const maybeKeyboardOpen =
        Capacitor.isNativePlatform() && webInputFocused && measured < maxViewportHeightRef.current * 0.75;

      const keyboardOpen = (keyboardVisibleRef.current && webInputFocused) || maybeKeyboardOpen;

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

    // Some system overlays won't trigger Keyboard "hide" events for the WebView.
    // When we regain focus/visibility, aggressively re-stabilize and assume keyboard is closed.
    const onFocus = () => {
      keyboardVisibleRef.current = false;
      stabilizeAppHeight();
    };

    // System overlays often trigger window blur without a matching keyboard hide.
    // Blur the web input so we don't misclassify the OS keyboard as our own.
    const onBlur = () => {
      keyboardVisibleRef.current = false;
      blurActiveInput();
      stabilizeAppHeight();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        keyboardVisibleRef.current = false;
        stabilizeAppHeight();
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

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

        // Some devices fire pause when USSD is shown; use it to clear focus early.
        handlePromises.push(
          App.addListener('pause', () => {
            keyboardVisibleRef.current = false;
            blurActiveInput();
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
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      handlePromises.forEach((p) => p.then((h) => h.remove()).catch(() => {}));
    };
  }, []);

  return (
    <div className="w-full max-w-md mx-auto bg-background flex flex-col min-h-[var(--app-height)] overflow-x-hidden">
      <main className={`flex-1 overflow-y-auto overflow-x-hidden ${showNav ? 'pb-20' : ''}`}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}