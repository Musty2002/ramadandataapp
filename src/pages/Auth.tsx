import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Fingerprint, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useKeyboardSafeInput } from '@/hooks/useKeyboardSafeInput';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/ramadan-logo.jpeg';
import { 
  PinLoginScreen, 
  isPinLoginAvailable, 
  getStoredUserForPinLogin,
  storeUserForPinLogin,
  clearStoredUserForPinLogin,
} from '@/components/auth/PinLoginScreen';
import { isTransactionPinSetup } from '@/components/auth/TransactionPinDialog';

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  referralCode: z.string().optional(),
});

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type ResetStep = 'email' | 'newPassword';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStep, setResetStep] = useState<ResetStep>('email');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showPinLogin, setShowPinLogin] = useState(false);
  const [storedUser, setStoredUser] = useState<ReturnType<typeof getStoredUserForPinLogin>>(null);
  const [pinLoginChecked, setPinLoginChecked] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    referralCode: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signIn, signUp, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { registerFocus, shouldIgnoreEmailBlank } = useKeyboardSafeInput();
  const { 
    isAvailable: biometricAvailable, 
    isEnabled: biometricEnabled,
    isLoading: biometricLoading2,
    hasStoredCredentials,
    getCredentials,
    setCredentials,
    getBiometricLabel,
  } = useBiometricAuth();

  const storedCreds = hasStoredCredentials();

  // Check if we should show PIN login on mount
  // Use a small delay on native to ensure localStorage is ready
  useEffect(() => {
    const checkPinLogin = async () => {
      // Small delay for native platforms to ensure storage is accessible
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const user = getStoredUserForPinLogin();
      const pinAvailable = isPinLoginAvailable();
      
      console.log('[Auth] PIN login check:', { user: !!user, pinAvailable });
      
      setStoredUser(user);
      if (user && pinAvailable) {
        setShowPinLogin(true);
      }
      setPinLoginChecked(true);
    };
    
    checkPinLogin();
  }, []);

  // Refs to protect email from being wiped on problematic Android devices (e.g., Camon 20)
  const emailInputRef = useRef<HTMLInputElement>(null);
  const lastValidEmailRef = useRef<string>('');
  const passwordFocusTimeRef = useRef<number>(0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Guard against wiping an already-entered email on some Android devices
    if (name === 'email') {
      if (value === '' && formData.email) {
        const emailHasFocus = document.activeElement === emailInputRef.current;
        const passwordRecentlyFocused = Date.now() - passwordFocusTimeRef.current < 2000;
        const passwordHasFocus = 
          document.activeElement?.getAttribute('name') === 'password' ||
          (document.activeElement as HTMLElement)?.id === 'password';
        
        if (!emailHasFocus && (passwordHasFocus || passwordRecentlyFocused || shouldIgnoreEmailBlank(value, formData.email))) {
          return;
        }
      }
      if (value) {
        lastValidEmailRef.current = value;
      }
    }

    if (name === 'password' && value && !formData.password) {
      passwordFocusTimeRef.current = Date.now();
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handlePasswordFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    passwordFocusTimeRef.current = Date.now();
    registerFocus('password')(e);
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      const credentials = await getCredentials();
      if (credentials) {
        const { error } = await signIn(credentials.email, credentials.password);
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: error.message === 'Invalid login credentials' 
              ? 'Saved credentials are no longer valid. Please login with email/password.'
              : error.message,
          });
        } else {
          navigate('/dashboard');
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Authentication Failed',
          description: 'Biometric verification failed. Please try again or use password.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Biometric authentication failed.',
      });
    } finally {
      setBiometricLoading(false);
    }
  };

  // Check for password recovery redirect on mount
  useEffect(() => {
    const checkRecoverySession = async () => {
      // Check URL hash for recovery tokens (from magic link redirect)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      if (type === 'recovery' && accessToken) {
        // User clicked the recovery link - show password reset form
        setShowForgotPassword(true);
        setResetStep('newPassword');
        
        // Clean up URL
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
    
    checkRecoverySession();
  }, []);

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast({
        variant: 'destructive',
        title: 'Email Required',
        description: 'Please enter your email address.',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) {
        throw error;
      }

      setResetEmailSent(true);
      toast({
        title: 'Email Sent',
        description: 'Check your email for the password reset link.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to send reset email. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Invalid Password',
        description: 'Password must be at least 6 characters.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Password Mismatch',
        description: 'Passwords do not match.',
      });
      return;
    }

    setLoading(true);
    try {
      // Update password using Supabase's built-in method (user is already authenticated after OTP verification)
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      // Sign out after password change so user logs in with new password
      await supabase.auth.signOut();

      toast({
        title: 'Password Updated',
        description: 'Your password has been changed successfully. Please log in.',
      });
      
      // Reset state and go back to login
      resetForgotPasswordFlow();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update password. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForgotPasswordFlow = () => {
    setShowForgotPassword(false);
    setResetStep('email');
    setResetEmail('');
    setResetEmailSent(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      if (isLogin) {
        const result = signInSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: error.message === 'Invalid login credentials' 
              ? 'Invalid email or password. Please try again.'
              : error.message,
          });
        } else {
          // Store credentials for biometric and PIN login
          if (biometricAvailable) {
            await setCredentials(formData.email, formData.password);
            if (!biometricEnabled) {
              toast({
                title: 'Biometric Enabled',
                description: `You can now use ${getBiometricLabel()} to sign in faster.`,
              });
            }
          }
          navigate('/dashboard');
        }
      } else {
        const result = signUpSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        const { error } = await signUp(
          formData.email,
          formData.password,
          formData.fullName,
          formData.phone,
          formData.referralCode || undefined
        );

        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              variant: 'destructive',
              title: 'Account Exists',
              description: 'This email is already registered. Please log in instead.',
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Sign Up Failed',
              description: error.message,
            });
          }
        } else {
          // Store credentials for future PIN login
          if (biometricAvailable) {
            await setCredentials(formData.email, formData.password);
          }
          toast({
            title: 'Welcome!',
            description: 'Your account has been created successfully.',
          });
          navigate('/dashboard');
        }
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToPassword = () => {
    setShowPinLogin(false);
  };

  // Show loading state while checking PIN login availability
  if (!pinLoginChecked) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  // Show PIN login screen for returning users
  if (showPinLogin && storedUser && isTransactionPinSetup()) {
    return (
      <PinLoginScreen 
        storedUser={storedUser} 
        onSwitchToPassword={handleSwitchToPassword}
      />
    );
  }

  // Forgot password modal/view with OTP flow
  if (showForgotPassword) {
    return (
      <div className="min-h-[100dvh] max-h-[100dvh] overflow-y-auto flex flex-col items-center justify-center px-6 py-12 pb-[calc(6rem+env(safe-area-inset-bottom))] bg-background">
        <div className="mb-8 text-center">
          <img src={logo} alt="Ramadan Data App" className="w-20 h-20 mx-auto rounded-2xl shadow-lg mb-4" />
          <h1 className="text-2xl font-bold text-primary">Reset Password</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {resetStep === 'email' && !resetEmailSent && 'Enter your email to receive a reset link'}
            {resetStep === 'email' && resetEmailSent && 'Check your email for the reset link'}
            {resetStep === 'newPassword' && 'Create your new password'}
          </p>
        </div>

        <div className="w-full max-w-sm bg-card rounded-2xl shadow-lg p-6">
          {resetStep === 'email' && !resetEmailSent && (
            <form onSubmit={handleSendResetEmail} className="space-y-4">
              <div>
                <Label htmlFor="resetEmail">Email Address</Label>
                <Input
                  id="resetEmail"
                  type="email"
                  placeholder="you@example.com"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="mt-2"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={resetForgotPasswordFlow}
              >
                Back to Login
              </Button>
            </form>
          )}

          {resetStep === 'email' && resetEmailSent && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to <strong>{resetEmail}</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Click the link in your email to reset your password.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setResetEmailSent(false)}
              >
                Try Different Email
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleSendResetEmail}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Resend Link'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={resetForgotPasswordFlow}
              >
                Back to Login
              </Button>
            </div>
          )}

          {resetStep === 'newPassword' && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">
                  Email verified! Create your new password.
                </p>
              </div>

              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-2 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground mt-1"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-2"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || !newPassword || newPassword !== confirmPassword}>
                {loading ? 'Updating...' : 'Update Password'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={resetForgotPasswordFlow}
              >
                Cancel
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Show traditional biometric login button only when PIN login is not available
  const showBiometricLoginButton = isLogin && biometricAvailable && biometricEnabled && storedCreds?.hasCredentials && !showPinLogin;

  return (
    <div className="min-h-[100dvh] max-h-[100dvh] overflow-y-auto flex flex-col items-center justify-center px-6 py-12 pb-[calc(6rem+env(safe-area-inset-bottom))] bg-background">
      {/* Logo */}
      <div className="mb-8 text-center">
        <img src={logo} alt="Ramadan Data App" className="w-20 h-20 mx-auto rounded-2xl shadow-lg mb-4" />
        <h1 className="text-2xl font-bold text-primary">Ramadan Data App</h1>
        <p className="text-muted-foreground text-sm mt-1">Your trusted payment partner</p>
      </div>

      {/* Biometric Quick Login (only when PIN not available) */}
      {showBiometricLoginButton && (
        <div className="w-full max-w-sm mb-4">
          <Button
            variant="outline"
            className="w-full h-14 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
            onClick={handleBiometricLogin}
            disabled={biometricLoading}
          >
            {biometricLoading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Fingerprint className="w-5 h-5 mr-2 text-primary" />
            )}
            <span>
              Sign in with {getBiometricLabel()}
            </span>
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Welcome back, {storedCreds?.email}
          </p>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
        </div>
      )}

      {/* Form Card */}
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-lg p-6">
        <div className="flex mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 text-center font-medium rounded-lg transition-colors ${
              isLogin ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 text-center font-medium rounded-lg transition-colors ${
              !isLogin ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  value={formData.fullName}
                  onChange={handleChange}
                  onFocus={registerFocus('fullName')}
                  className={errors.fullName ? 'border-destructive' : ''}
                />
                {errors.fullName && (
                  <p className="text-xs text-destructive mt-1">{errors.fullName}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="08012345678"
                  inputMode="tel"
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  onFocus={registerFocus('phone')}
                  className={errors.phone ? 'border-destructive' : ''}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive mt-1">{errors.phone}</p>
                )}
              </div>
            </>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              ref={emailInputRef}
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              data-form-type="other"
              value={formData.email}
              onChange={handleChange}
              onFocus={registerFocus('email')}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={formData.password}
                onChange={handleChange}
                onFocus={handlePasswordFocus}
                className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive mt-1">{errors.password}</p>
            )}
          </div>

          {isLogin && (
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </button>
          )}

          {!isLogin && (
            <div>
              <Label htmlFor="referralCode">Referral Code (Optional)</Label>
              <Input
                id="referralCode"
                name="referralCode"
                placeholder="Enter referral code"
                autoComplete="off"
                value={formData.referralCode}
                onChange={handleChange}
                onFocus={registerFocus('referralCode')}
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create Account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
