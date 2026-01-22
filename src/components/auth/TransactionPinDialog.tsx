import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Delete, AlertCircle } from 'lucide-react';
import logo from '@/assets/logo.jpeg';

interface TransactionPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  mode?: 'setup' | 'verify' | 'change';
  title?: string;
  description?: string;
}

const PIN_LENGTH = 4;
const TRANSACTION_PIN_HASH_KEY = 'transaction_pin_hash';

// Simple hash function for PIN (for local storage only)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'rds_data_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyTransactionPin(pin: string): Promise<boolean> {
  const storedHash = localStorage.getItem(TRANSACTION_PIN_HASH_KEY);
  if (!storedHash) return false;
  const inputHash = await hashPin(pin);
  return storedHash === inputHash;
}

export function isTransactionPinSetup(): boolean {
  return !!localStorage.getItem(TRANSACTION_PIN_HASH_KEY);
}

export function clearTransactionPin(): void {
  localStorage.removeItem(TRANSACTION_PIN_HASH_KEY);
}

export function TransactionPinDialog({
  open,
  onOpenChange,
  onComplete,
  mode = 'setup',
  title,
  description,
}: TransactionPinDialogProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm' | 'verify'>('enter');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (open) {
      setPin('');
      setConfirmPin('');
      setError('');
      setStep(mode === 'verify' ? 'verify' : 'enter');
    }
  }, [open, mode]);

  const handleDigit = async (digit: string) => {
    setError('');
    const currentPin = step === 'confirm' ? confirmPin : pin;
    
    if (currentPin.length < PIN_LENGTH) {
      const newPin = currentPin + digit;
      
      if (step === 'confirm') {
        setConfirmPin(newPin);
        if (newPin.length === PIN_LENGTH) {
          // Validate confirmation
          if (newPin === pin) {
            const hash = await hashPin(newPin);
            localStorage.setItem(TRANSACTION_PIN_HASH_KEY, hash);
            onComplete();
            onOpenChange(false);
          } else {
            setError('PINs do not match');
            triggerShake();
            setConfirmPin('');
          }
        }
      } else if (step === 'verify') {
        setPin(newPin);
        if (newPin.length === PIN_LENGTH) {
          const isValid = await verifyTransactionPin(newPin);
          if (isValid) {
            onComplete();
            onOpenChange(false);
          } else {
            setError('Incorrect PIN');
            triggerShake();
            setPin('');
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

  const getTitle = () => {
    if (title) return title;
    if (mode === 'verify') return 'Enter Transaction PIN';
    if (step === 'confirm') return 'Confirm Your PIN';
    return 'Set Transaction PIN';
  };

  const getDescription = () => {
    if (description) return description;
    if (mode === 'verify') return 'Enter your 4-digit PIN to authorize this transaction';
    if (step === 'confirm') return 'Re-enter your PIN to confirm';
    return 'Create a 4-digit PIN to secure your transactions';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs sm:max-w-sm">
        <DialogHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl overflow-hidden shadow-md">
            <img src={logo} alt="RDS Data" className="w-full h-full object-cover" />
          </div>
          <DialogTitle className="text-center">{getTitle()}</DialogTitle>
          <DialogDescription className="text-center">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          {/* PIN Dots */}
          <div className={`flex justify-center gap-4 mb-8 ${shake ? 'animate-shake' : ''}`}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Shake animation - add to index.css
// .animate-shake {
//   animation: shake 0.5s ease-in-out;
// }
// @keyframes shake {
//   0%, 100% { transform: translateX(0); }
//   25% { transform: translateX(-8px); }
//   75% { transform: translateX(8px); }
// }
