import { useState, useEffect, useCallback } from 'react';
import { Delete, Fingerprint, Loader2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { 
  verifyTransactionPin, 
  isTransactionPinSetup,
} from '@/components/auth/TransactionPinDialog';
import { WhatsAppButton } from '@/components/dashboard/WhatsAppButton';
import defaultAvatar from '@/assets/default-avatar.png';

interface StoredUserCredentials {
  email: string;
  fullName: string;
  avatarUrl?: string;
}

const PIN_LENGTH = 4;
const STORED_USER_KEY = 'pin_login_user';

// Store user info when they log in
export function storeUserForPinLogin(email: string, fullName: string, avatarUrl?: string): void {
  localStorage.setItem(STORED_USER_KEY, JSON.stringify({ email, fullName, avatarUrl }));
}

// Get stored user for PIN login
export function getStoredUserForPinLogin(): StoredUserCredentials | null {
  const stored = localStorage.getItem(STORED_USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

// Check if PIN login is available
export function isPinLoginAvailable(): boolean {
  return getStoredUserForPinLogin() !== null && isTransactionPinSetup();
}

// Clear stored user
export function clearStoredUserForPinLogin(): void {
  localStorage.removeItem(STORED_USER_KEY);
}

interface PinLoginScreenProps {
  onSwitchToPassword: () => void;
  storedUser: StoredUserCredentials;
}

export function PinLoginScreen({ onSwitchToPassword, storedUser }: PinLoginScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { 
    isAvailable: biometricAvailable, 
    isEnabled: biometricEnabled,
    getCredentials,
    getBiometricLabel,
  } = useBiometricAuth();

  const showBiometricOption = biometricAvailable && biometricEnabled;

  // Get initials from full name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  // Handle successful PIN/biometric verification
  const handleSuccessfulLogin = useCallback(async (credentials: { email: string; password: string }) => {
    setLoading(true);
    try {
      const { error: signInError } = await signIn(credentials.email, credentials.password);
      if (signInError) {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: 'Your stored credentials may have changed. Please login with email/password.',
        });
        onSwitchToPassword();
      } else {
        navigate('/dashboard');
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to sign in. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [signIn, toast, navigate, onSwitchToPassword]);

  // Handle biometric login
  const handleBiometricLogin = useCallback(async () => {
    setBiometricLoading(true);
    try {
      const credentials = await getCredentials();
      if (credentials) {
        await handleSuccessfulLogin(credentials);
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
  }, [getCredentials, handleSuccessfulLogin]);

  // Handle PIN digit input
  const handleDigit = async (digit: string) => {
    setError('');
    
    if (pin.length < PIN_LENGTH) {
      const newPin = pin + digit;
      setPin(newPin);
      
      if (newPin.length === PIN_LENGTH) {
        setLoading(true);
        try {
          const isValid = await verifyTransactionPin(newPin);
          if (isValid) {
            // PIN is correct, now get stored credentials to sign in
            const credentials = await getCredentials();
            if (credentials) {
              await handleSuccessfulLogin(credentials);
            } else {
              // No biometric credentials, user needs to use password
              toast({
                variant: 'destructive',
                title: 'Session Expired',
                description: 'Please login with your email and password.',
              });
              onSwitchToPassword();
            }
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
    }
  };

  const handleDelete = () => {
    setError('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleForgotPin = () => {
    toast({
      title: 'Forgot PIN?',
      description: 'Please login with your email and password to reset your PIN.',
    });
    onSwitchToPassword();
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-secondary/30">
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-start pt-16 px-6">
        {/* Avatar with golden ring */}
        <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-br from-primary via-primary/80 to-primary/60 shadow-lg">
          <Avatar className="w-full h-full border-2 border-background">
            <AvatarImage src={storedUser.avatarUrl || defaultAvatar} alt={storedUser.fullName} />
            <AvatarFallback className="bg-primary/10">
              <img src={defaultAvatar} alt="Default avatar" className="w-full h-full object-cover" />
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Welcome Text */}
        <h1 className="text-2xl font-bold mt-6 text-foreground">Welcome Back</h1>
        <p className="text-muted-foreground mt-1">{storedUser.fullName}</p>

        {/* PIN Dots */}
        <div className={`flex justify-center gap-4 mt-8 ${shake ? 'animate-shake' : ''}`}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
                i < pin.length
                  ? 'bg-primary border-primary scale-110'
                  : 'border-muted-foreground/40 bg-transparent'
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-destructive text-sm mt-4">{error}</p>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="mt-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-4 mt-8 max-w-[280px] w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <Button
              key={digit}
              variant="secondary"
              size="lg"
              className="h-16 w-16 mx-auto text-2xl font-semibold rounded-full bg-card shadow-sm hover:bg-muted"
              onClick={() => handleDigit(String(digit))}
              disabled={loading}
            >
              {digit}
            </Button>
          ))}
          
          {/* Biometric Button */}
          <Button
            variant="secondary"
            size="lg"
            className="h-16 w-16 mx-auto rounded-full bg-card shadow-sm hover:bg-muted"
            onClick={handleBiometricLogin}
            disabled={!showBiometricOption || biometricLoading || loading}
          >
            {biometricLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Fingerprint className={`w-6 h-6 ${showBiometricOption ? 'text-primary' : 'text-muted-foreground/40'}`} />
            )}
          </Button>

          {/* Zero */}
          <Button
            variant="secondary"
            size="lg"
            className="h-16 w-16 mx-auto text-2xl font-semibold rounded-full bg-card shadow-sm hover:bg-muted"
            onClick={() => handleDigit('0')}
            disabled={loading}
          >
            0
          </Button>

          {/* Delete Button */}
          <Button
            variant="secondary"
            size="lg"
            className="h-16 w-16 mx-auto rounded-full bg-card shadow-sm hover:bg-muted"
            onClick={handleDelete}
            disabled={pin.length === 0 || loading}
          >
            <Delete className="w-6 h-6" />
          </Button>
        </div>

        {/* Forgot PIN */}
        <button
          onClick={handleForgotPin}
          className="text-foreground font-medium mt-8 underline underline-offset-2"
          disabled={loading}
        >
          Forgot PIN?
        </button>
      </div>

      {/* Bottom Actions */}
      <div className="pb-8 px-6 flex justify-between items-center">
        <Button
          variant="ghost"
          size="icon"
          className="w-12 h-12 rounded-full bg-card shadow-sm"
          onClick={onSwitchToPassword}
        >
          <RefreshCcw className="w-5 h-5" />
        </Button>
        
        <WhatsAppButton />
      </div>
    </div>
  );
}
