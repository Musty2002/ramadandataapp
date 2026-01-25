import { ReactNode, useEffect } from 'react';
import { BottomNav } from './BottomNav';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { App } from '@capacitor/app';

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function MobileLayout({ children, showNav = true }: MobileLayoutProps) {
  useEffect(() => {
    const updateAppHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
    };

    // Some Android overlays (USSD dialogs) can leave the WebView with a stale viewport.
    // Re-apply the height a few times to catch late layout updates.
    const stabilizeAppHeight = () => {
      updateAppHeight();
      requestAnimationFrame(updateAppHeight);
      [50, 150, 300, 600].forEach((ms) => setTimeout(updateAppHeight, ms));
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
        handlePromises.push(Keyboard.addListener('keyboardWillShow', stabilizeAppHeight));
        handlePromises.push(Keyboard.addListener('keyboardDidShow', stabilizeAppHeight));
        handlePromises.push(Keyboard.addListener('keyboardWillHide', stabilizeAppHeight));
        handlePromises.push(Keyboard.addListener('keyboardDidHide', stabilizeAppHeight));
        handlePromises.push(App.addListener('resume', stabilizeAppHeight));
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