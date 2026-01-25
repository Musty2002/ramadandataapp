import { ReactNode, useEffect } from 'react';
import { BottomNav } from './BottomNav';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function MobileLayout({ children, showNav = true }: MobileLayoutProps) {
  // Fix keyboard behavior - ensure layout resets when keyboard hides
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setupKeyboardListeners = async () => {
      try {
        // Force layout recalculation when keyboard hides
        await Keyboard.addListener('keyboardWillHide', () => {
          // Reset any viewport modifications
          document.body.style.height = '';
          document.documentElement.style.height = '';
          
          // Force repaint to fix half-screen issue
          window.scrollTo(0, 0);
          
          // Additional fix for USSD notification overlay issues
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, 100);
        });

        await Keyboard.addListener('keyboardDidHide', () => {
          // Double-check layout is restored after keyboard fully hides
          document.body.style.height = '100%';
          document.documentElement.style.height = '100%';
          
          setTimeout(() => {
            document.body.style.height = '';
            document.documentElement.style.height = '';
          }, 50);
        });
      } catch (error) {
        console.log('Keyboard plugin not available:', error);
      }
    };

    setupKeyboardListeners();

    return () => {
      Keyboard.removeAllListeners().catch(() => {});
    };
  }, []);

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background flex flex-col">
      <main className={`flex-1 ${showNav ? 'pb-20' : ''}`}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}