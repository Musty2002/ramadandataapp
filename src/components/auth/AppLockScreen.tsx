import { useState, useCallback, useEffect } from 'react';
import { Delete, Fingerprint, Loader2, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useToast } from '@/hooks/use-toast';
import { verifyTransactionPin } from '@/components/auth/TransactionPinDialog';
import { WhatsAppButton } from '@/components/dashboard/WhatsAppButton';
import defaultAvatar from '@/assets/default-avatar.png';

interface StoredUserCredentials {
  email: string;
  fullName: string;
  avatarUrl?: string;
}

const PIN_LENGTH = 4;

interface AppLockScreenProps {
  storedUser: StoredUserCredentials;
  onUnlock: () => void;
  onLogout: () => void;
}

export function AppLockScreen({ storedUser, onUnlock, onLogout }: AppLockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const { toast } = useToast();

  const {
    isAvailable: biometricAvailable,
    isEnabled: biometricEnabled,
    verifyIdentity,
  } = useBiometricAuth();

  const showBiometricOption = biometricAvailable && biometricEnabled;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleBiometricUnlock = useCallback(async () => {
    setBiometricLoading(true);
    try {
      const verified = await verifyIdentity('Unlock Ramadan Data');
      if (verified) {
        onUnlock();
      } else {
        setError('Biometric verification failed');
        triggerShake();
      }
    } catch {
      setError('Biometric verification failed');
      triggerShake();
    } finally {
      setBiometricLoading(false);
    }
  }, [verifyIdentity, onUnlock]);

  const handleDigit = async (digit: string) => {
    if (loading || pin.length >= PIN_LENGTH) return;
    setError('');
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === PIN_LENGTH) {
      setLoading(true);
      try {
        const isValid = await verifyTransactionPin(newPin);
        if (isValid) {
          onUnlock();
        } else {
          setError('Incorrect PIN');
          triggerShake();
          setPin('');
        }
      } catch {
        setError('Verification failed');
        triggerShake();
        setPin('');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDelete = () => {
    setError('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleUsePassword = () => {
    toast({
      title: 'Use Password',
      description: 'You will be logged out and can sign in with your email and password.',
    });
    onLogout();
  };

  // Auto-trigger biometric on mount if available
  useEffect(() => {
    if (showBiometricOption) {
      handleBiometricUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys: Array<{ label: string; action: () => void; type?: 'digit' | 'action'; icon?: React.ReactNode; disabled?: boolean }> = [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => ({
      label: String(d),
      action: () => handleDigit(String(d)),
      type: 'digit' as const,
    })),
    {
      label: 'bio',
      type: 'action',
      icon: biometricLoading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : (
        <Fingerprint className={`w-7 h-7 ${showBiometricOption ? 'text-primary' : 'text-muted-foreground/30'}`} />
      ),
      action: handleBiometricUnlock,
      disabled: !showBiometricOption || biometricLoading,
    },
    { label: '0', action: () => handleDigit('0'), type: 'digit' },
    {
      label: 'del',
      type: 'action',
      icon: <Delete className="w-6 h-6 text-foreground/70" />,
      action: handleDelete,
      disabled: pin.length === 0,
    },
  ];

  return (
    <div
      className="fixed inset-0 flex flex-col bg-gradient-to-b from-primary/10 via-background to-background overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />

      {/* Top: avatar + welcome */}
      <div className="relative flex flex-col items-center pt-8 px-6">
        <div className="w-24 h-24 rounded-full p-[3px] bg-gradient-to-br from-primary via-primary/70 to-primary/40 shadow-xl shadow-primary/20">
          <Avatar className="w-full h-full border-[3px] border-background">
            <AvatarImage src={storedUser.avatarUrl || defaultAvatar} alt={storedUser.fullName} />
            <AvatarFallback className="bg-primary/10">
              <img src={defaultAvatar} alt="Default avatar" className="w-full h-full object-cover" />
            </AvatarFallback>
          </Avatar>
        </div>

        <h1 className="text-2xl font-bold mt-5 text-foreground tracking-tight">Welcome Back</h1>
        <p className="text-foreground/80 text-sm mt-1 font-medium">{storedUser.fullName}</p>
        <p className="text-muted-foreground text-xs mt-1">Enter your PIN to unlock</p>

        {/* PIN dots */}
        <div className={`flex justify-center gap-4 mt-6 ${shake ? 'animate-shake' : ''}`}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                i < pin.length
                  ? 'bg-primary border-primary scale-125 shadow-md shadow-primary/40'
                  : 'border-muted-foreground/30 bg-transparent'
              }`}
            />
          ))}
        </div>

        {/* Status line */}
        <div className="h-5 mt-3 flex items-center">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : error ? (
            <p className="text-destructive text-sm font-medium">{error}</p>
          ) : null}
        </div>
      </div>

      {/* Keypad - flex grows to fill */}
      <div className="flex-1 flex flex-col justify-end px-6 pb-2">
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto w-full">
          {keys.map((k, idx) => (
            <button
              key={idx}
              type="button"
              onClick={k.action}
              disabled={loading || k.disabled}
              className={`
                aspect-square w-full max-w-[80px] mx-auto rounded-full
                flex items-center justify-center
                text-2xl font-semibold
                transition-all duration-150
                active:scale-90
                disabled:opacity-40
                ${k.type === 'digit'
                  ? 'bg-card text-foreground shadow-md shadow-black/5 hover:bg-primary/5 active:bg-primary/10'
                  : 'bg-transparent hover:bg-card/60'}
              `}
            >
              {k.icon ?? k.label}
            </button>
          ))}
        </div>

        {/* Use password */}
        <button
          onClick={handleUsePassword}
          className="text-primary font-semibold text-sm mt-5 mx-auto block"
          disabled={loading}
        >
          Use password instead
        </button>
      </div>

      {/* Bottom actions */}
      <div className="px-6 pb-4 pt-2 flex justify-between items-center">
        <button
          onClick={handleUsePassword}
          className="w-11 h-11 rounded-full bg-card shadow-md shadow-black/5 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Sign out"
        >
          <LogOut className="w-5 h-5 text-foreground/70" />
        </button>
        <WhatsAppButton />
      </div>
    </div>
  );
}
