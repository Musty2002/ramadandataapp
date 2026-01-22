import { useState, useEffect } from 'react';
import { Delete, Fingerprint } from 'lucide-react';
import logo from '@/assets/logo.jpeg';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';

const PIN_LENGTH = 6;
const APP_LOCK_PIN_HASH_KEY = 'app_lock_pin_hash';
const APP_LOCK_ENABLED_KEY = 'app_lock_enabled';
const APP_UNLOCKED_KEY = 'app_unlocked_session';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

// Simple hash function for PIN
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'rds_app_lock_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyAppLockPin(pin: string): Promise<boolean> {
  const storedHash = localStorage.getItem(APP_LOCK_PIN_HASH_KEY);
  if (!storedHash) return false;
  const inputHash = await hashPin(pin);
  return storedHash === inputHash;
}

export function isAppLockEnabled(): boolean {
  return localStorage.getItem(APP_LOCK_ENABLED_KEY) === 'true';
}

export function isAppLockPinSetup(): boolean {
  return !!localStorage.getItem(APP_LOCK_PIN_HASH_KEY);
}

export async function setupAppLockPin(pin: string): Promise<void> {
  const hash = await hashPin(pin);
  localStorage.setItem(APP_LOCK_PIN_HASH_KEY, hash);
  localStorage.setItem(APP_LOCK_ENABLED_KEY, 'true');
}

export function disableAppLock(): void {
  localStorage.removeItem(APP_LOCK_PIN_HASH_KEY);
  localStorage.removeItem(APP_LOCK_ENABLED_KEY);
  sessionStorage.removeItem(APP_UNLOCKED_KEY);
}

export function setAppUnlocked(): void {
  sessionStorage.setItem(APP_UNLOCKED_KEY, 'true');
}

export function isAppUnlocked(): boolean {
  return sessionStorage.getItem(APP_UNLOCKED_KEY) === 'true';
}

export function isBiometricEnabled(): boolean {
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
}

interface AppLockScreenProps {
  onUnlock: () => void;
  mode?: 'unlock' | 'setup' | 'confirm';
  onSetupComplete?: () => void;
}

export function AppLockScreen({ onUnlock, mode = 'unlock', onSetupComplete }: AppLockScreenProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>(mode === 'setup' ? 'enter' : 'enter');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    setPin('');
    setConfirmPin('');
    setError('');
    setStep('enter');
    
    // Check biometric availability and attempt authentication
    if (mode === 'unlock' && Capacitor.isNativePlatform() && isBiometricEnabled()) {
      checkAndUseBiometric();
    }
  }, [mode]);

  const checkAndUseBiometric = async () => {
    try {
      const result = await NativeBiometric.isAvailable();
      if (result.isAvailable) {
        setBiometricAvailable(true);
        // Auto-trigger biometric on load
        handleBiometricAuth();
      }
    } catch (error) {
      console.log('Biometric not available:', error);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      await NativeBiometric.verifyIdentity({
        title: 'Unlock RDS Data',
        subtitle: 'Use biometric to unlock',
        description: 'Place your finger on the sensor or look at the camera',
      });
      
      // Biometric verified successfully
      setAppUnlocked();
      onUnlock();
    } catch (error) {
      console.log('Biometric auth failed:', error);
      // User can still use PIN
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleDigit = async (digit: string) => {
    setError('');
    const currentPin = step === 'confirm' ? confirmPin : pin;
    
    if (currentPin.length < PIN_LENGTH) {
      const newPin = currentPin + digit;
      
      if (mode === 'setup') {
        if (step === 'confirm') {
          setConfirmPin(newPin);
          if (newPin.length === PIN_LENGTH) {
            if (newPin === pin) {
              await setupAppLockPin(newPin);
              setAppUnlocked();
              onSetupComplete?.();
              onUnlock();
            } else {
              setError('PINs do not match');
              triggerShake();
              setConfirmPin('');
            }
          }
        } else {
          setPin(newPin);
          if (newPin.length === PIN_LENGTH) {
            setStep('confirm');
          }
        }
      } else {
        // Unlock mode
        setPin(newPin);
        if (newPin.length === PIN_LENGTH) {
          const isValid = await verifyAppLockPin(newPin);
          if (isValid) {
            setAppUnlocked();
            onUnlock();
          } else {
            setError('Incorrect PIN');
            triggerShake();
            setPin('');
          }
        }
      }
    }
  };

  const handleDelete = () => {
    setError('');
    if (step === 'confirm') {
      setConfirmPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
    }
  };

  const currentPin = step === 'confirm' ? confirmPin : pin;

  return (
    <div className="fixed inset-0 bg-background z-[100] flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom">
      {/* Logo and Header */}
      <div className="text-center mb-12">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl overflow-hidden shadow-lg">
          <img src={logo} alt="RDS Data" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">RDS Data</h1>
        <p className="text-muted-foreground mt-2">
          {mode === 'setup' 
            ? (step === 'confirm' ? 'Confirm your 6-digit PIN' : 'Create a 6-digit PIN')
            : 'Enter your PIN to unlock'
          }
        </p>
      </div>

      {/* PIN Dots */}
      <div className={`flex justify-center gap-3 mb-6 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              i < currentPin.length
                ? 'bg-primary border-primary scale-110'
                : 'border-muted-foreground/30'
            }`}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-destructive text-sm mb-4">{error}</p>
      )}

      {/* Number Pad */}
      <div className="grid grid-cols-3 gap-4 max-w-[280px] w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            className="h-16 w-16 mx-auto rounded-full bg-muted hover:bg-muted/80 active:scale-95 transition-all flex items-center justify-center text-2xl font-semibold"
            onClick={() => handleDigit(String(digit))}
          >
            {digit}
          </button>
        ))}
        <button
          className="h-16 w-16 mx-auto rounded-full flex items-center justify-center"
          onClick={() => {
            if (mode === 'setup' && step === 'confirm') {
              setStep('enter');
              setConfirmPin('');
            } else if (mode === 'unlock' && biometricAvailable && isBiometricEnabled()) {
              handleBiometricAuth();
            }
          }}
        >
          {mode === 'setup' && step === 'confirm' ? (
            <span className="text-sm text-muted-foreground">Back</span>
          ) : mode === 'unlock' && biometricAvailable && isBiometricEnabled() ? (
            <Fingerprint className="w-6 h-6 text-primary" />
          ) : null}
        </button>
        <button
          className="h-16 w-16 mx-auto rounded-full bg-muted hover:bg-muted/80 active:scale-95 transition-all flex items-center justify-center text-2xl font-semibold"
          onClick={() => handleDigit('0')}
        >
          0
        </button>
        <button
          className="h-16 w-16 mx-auto rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors"
          onClick={handleDelete}
          disabled={currentPin.length === 0}
        >
          <Delete className="w-6 h-6 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
