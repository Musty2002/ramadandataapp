import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

// Dynamic import for native biometric to avoid issues on web
let NativeBiometric: any = null;

// Storage keys
const BIOMETRIC_ENABLED_KEY = 'biometric_auth_enabled';
const BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';

interface BiometricCredentials {
  email: string;
  // We don't store the actual password, just a flag that biometric is set up
  hasCredentials: boolean;
}

export function useBiometricAuth() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | 'iris' | 'none'>('none');
  const [isLoading, setIsLoading] = useState(true);

  // Check if biometric is available on this device
  const checkAvailability = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      setIsLoading(false);
      return false;
    }

    try {
      // Dynamically import the native biometric plugin
      if (!NativeBiometric) {
        const module = await import('capacitor-native-biometric');
        NativeBiometric = module.NativeBiometric;
      }

      const result = await NativeBiometric.isAvailable();
      setIsAvailable(result.isAvailable);
      
      // Determine biometric type
      if (result.biometryType === 1) {
        setBiometricType('fingerprint');
      } else if (result.biometryType === 2) {
        setBiometricType('face');
      } else if (result.biometryType === 3) {
        setBiometricType('iris');
      }

      // Check if user has enabled biometric
      const enabled = localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
      setIsEnabled(enabled && result.isAvailable);

      setIsLoading(false);
      return result.isAvailable;
    } catch (error) {
      console.error('Biometric availability check failed:', error);
      setIsLoading(false);
      return false;
    }
  }, []);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Store credentials securely using native biometric
  const setCredentials = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (!isAvailable || !NativeBiometric) return false;

    try {
      // Store credentials in the secure enclave
      await NativeBiometric.setCredentials({
        username: email,
        password: password,
        server: 'com.ramadandata.app',
      });

      // Mark as enabled
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      localStorage.setItem(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify({ 
        email, 
        hasCredentials: true 
      }));
      setIsEnabled(true);

      return true;
    } catch (error) {
      console.error('Failed to set biometric credentials:', error);
      return false;
    }
  }, [isAvailable]);

  // Get stored credentials after biometric verification
  const getCredentials = useCallback(async (): Promise<{ email: string; password: string } | null> => {
    if (!isAvailable || !NativeBiometric) return null;

    try {
      // First verify the user with biometric
      await NativeBiometric.verifyIdentity({
        reason: 'Authenticate to continue',
        title: 'Biometric Login',
        subtitle: 'Use your fingerprint or face to sign in',
        description: 'Place your finger on the sensor or look at the camera',
        negativeButtonText: 'Use PIN instead',
      });

      // If verification passed, get the credentials
      const credentials = await NativeBiometric.getCredentials({
        server: 'com.ramadandata.app',
      });

      return {
        email: credentials.username,
        password: credentials.password,
      };
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return null;
    }
  }, [isAvailable]);

  // Verify identity without getting credentials (for transaction PIN alternative)
  const verifyIdentity = useCallback(async (reason?: string): Promise<boolean> => {
    if (!isAvailable || !NativeBiometric) return false;

    try {
      await NativeBiometric.verifyIdentity({
        reason: reason || 'Verify your identity to continue',
        title: 'Biometric Verification',
        subtitle: 'Confirm it\'s you',
        description: 'Use your fingerprint or face to verify',
        negativeButtonText: 'Cancel',
      });

      return true;
    } catch (error) {
      console.error('Biometric verification failed:', error);
      return false;
    }
  }, [isAvailable]);

  // Check if there are stored credentials
  const hasStoredCredentials = useCallback((): BiometricCredentials | null => {
    try {
      const stored = localStorage.getItem(BIOMETRIC_CREDENTIALS_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }, []);

  // Clear stored credentials
  const clearCredentials = useCallback(async (): Promise<void> => {
    if (NativeBiometric) {
      try {
        await NativeBiometric.deleteCredentials({
          server: 'com.ramadandata.app',
        });
      } catch (error) {
        console.error('Failed to delete biometric credentials:', error);
      }
    }

    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    localStorage.removeItem(BIOMETRIC_CREDENTIALS_KEY);
    setIsEnabled(false);
  }, []);

  // Toggle biometric on/off
  const toggleBiometric = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (isEnabled) {
      await clearCredentials();
      return false;
    } else {
      return await setCredentials(email, password);
    }
  }, [isEnabled, clearCredentials, setCredentials]);

  // Get the biometric type label
  const getBiometricLabel = useCallback((): string => {
    switch (biometricType) {
      case 'fingerprint':
        return 'Fingerprint';
      case 'face':
        return 'Face ID';
      case 'iris':
        return 'Iris';
      default:
        return 'Biometric';
    }
  }, [biometricType]);

  return {
    isAvailable,
    isEnabled,
    isLoading,
    biometricType,
    setCredentials,
    getCredentials,
    verifyIdentity,
    hasStoredCredentials,
    clearCredentials,
    toggleBiometric,
    getBiometricLabel,
    checkAvailability,
  };
}
