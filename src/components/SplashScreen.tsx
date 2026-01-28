import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import ramadanLogo from '@/assets/ramadan-logo.jpeg';

interface SplashScreenProps {
  onComplete: () => void;
  minDisplayTime?: number;
}

const SplashScreen = ({ onComplete, minDisplayTime = 2000 }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const init = async () => {
      // On native platforms, hide the native splash screen
      if (Capacitor.isNativePlatform()) {
        try {
          const { SplashScreen: NativeSplash } = await import('@capacitor/splash-screen');
          // Small delay to ensure smooth transition
          await new Promise(resolve => setTimeout(resolve, 100));
          await NativeSplash.hide();
        } catch (error) {
          console.warn('[SplashScreen] Failed to hide native splash:', error);
        }
      }
      
      // Wait for minimum display time then fade out
      const timer = setTimeout(() => {
        setFadeOut(true);
        setTimeout(onComplete, 500); // Wait for fade animation
      }, minDisplayTime);

      return () => clearTimeout(timer);
    };

    init();
  }, [onComplete, minDisplayTime]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#0a1929] via-[#0d2137] to-[#0a1929] transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated background circles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Logo container with glow effect */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Glow ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-40 h-40 md:w-48 md:h-48 rounded-full bg-primary/20 blur-2xl animate-pulse" />
        </div>
        
        {/* Logo with animation */}
        <div className="relative animate-[scale-in_0.8s_ease-out]">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl overflow-hidden shadow-2xl shadow-primary/30 ring-4 ring-white/10">
            <img
              src={ramadanLogo}
              alt="Ramadan Data"
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Shine effect */}
          <div className="absolute inset-0 rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_ease-in-out_infinite]" />
          </div>
        </div>

        {/* App name */}
        <h1 className="mt-8 text-3xl md:text-4xl font-bold text-white tracking-wide animate-[fade-in_0.8s_ease-out_0.3s_both]">
          Ramadan Data
        </h1>
        
        {/* Tagline */}
        <p className="mt-2 text-white/60 text-sm md:text-base animate-[fade-in_0.8s_ease-out_0.5s_both]">
          Your trusted VTU partner
        </p>

        {/* Loading indicator */}
        <div className="mt-12 flex items-center gap-2 animate-[fade-in_0.8s_ease-out_0.7s_both]">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>

      {/* Bottom branding */}
      <div className="absolute bottom-8 text-center animate-[fade-in_0.8s_ease-out_0.9s_both]">
        <p className="text-white/40 text-xs">
          Powered by Ramadan Data
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
