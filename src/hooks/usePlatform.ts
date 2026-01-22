import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function useIsNativePlatform() {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  return isNative;
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}
