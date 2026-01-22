import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Delete, Shield, AlertCircle } from 'lucide-react';

interface AppLockSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const PIN_LENGTH = 6;
const APP_LOCK_PIN_HASH_KEY = 'app_lock_pin_hash';
const APP_LOCK_ENABLED_KEY = 'app_lock_enabled';

// Simple hash function for PIN (for local storage only)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'rds_app_lock_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isAppLockPinSetup(): boolean {
  return !!localStorage.getItem(APP_LOCK_PIN_HASH_KEY);
}

export async function setupAppLockPin(pin: string): Promise<void> {
  const hash = await hashPin(pin);
  localStorage.setItem(APP_LOCK_PIN_HASH_KEY, hash);
  localStorage.setItem(APP_LOCK_ENABLED_KEY, 'true');
}

export function AppLockSetupDialog({
  open,
  onOpenChange,
  onComplete,
}: AppLockSetupDialogProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (open) {
      setPin('');
      setConfirmPin('');
      setError('');
      setStep('enter');
    }
  }, [open]);

  const handleDigit = async (digit: string) => {
    setError('');
    const currentPin = step === 'confirm' ? confirmPin : pin;
    
    if (currentPin.length < PIN_LENGTH) {
      const newPin = currentPin + digit;
      
      if (step === 'confirm') {
        setConfirmPin(newPin);
        if (newPin.length === PIN_LENGTH) {
          if (newPin === pin) {
            await setupAppLockPin(newPin);
            onComplete();
            onOpenChange(false);
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

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const currentPin = step === 'confirm' ? confirmPin : pin;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-xs sm:max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-center">
            {step === 'confirm' ? 'Confirm App Lock PIN' : 'Set App Lock PIN'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === 'confirm' 
              ? 'Re-enter your 6-digit PIN to confirm'
              : 'Create a 6-digit PIN to secure your app'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          {/* PIN Dots */}
          <div className={`flex justify-center gap-3 mb-8 ${shake ? 'animate-shake' : ''}`}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                  i < currentPin.length
                    ? 'bg-primary border-primary scale-110'
                    : 'border-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center justify-center gap-2 text-destructive mb-4 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <Button
                key={digit}
                variant="outline"
                size="lg"
                className="h-14 text-xl font-semibold"
                onClick={() => handleDigit(String(digit))}
              >
                {digit}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="lg"
              className="h-14"
              onClick={() => {
                if (step === 'confirm') {
                  setStep('enter');
                  setConfirmPin('');
                }
              }}
              disabled={step !== 'confirm'}
            >
              {step === 'confirm' && <span className="text-xs">Back</span>}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 text-xl font-semibold"
              onClick={() => handleDigit('0')}
            >
              0
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-14"
              onClick={handleDelete}
              disabled={currentPin.length === 0}
            >
              <Delete className="w-6 h-6" />
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            This PIN will be required to unlock the app
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
