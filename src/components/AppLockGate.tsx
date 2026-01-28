import { ReactNode } from 'react';
import { useAppLock } from '@/hooks/useAppLock';
import { useAuth } from '@/hooks/useAuth';
import { AppLockScreen } from '@/components/auth/AppLockScreen';
import { clearStoredUserForPinLogin } from '@/components/auth/PinLoginScreen';

interface AppLockGateProps {
  children: ReactNode;
}

/**
 * Wraps protected routes to enforce app lock for returning users with PIN set.
 * Shows PIN/biometric unlock screen on cold start.
 */
export function AppLockGate({ children }: AppLockGateProps) {
  const { isLocked, storedUser, hasChecked, unlock } = useAppLock();
  const { signOut } = useAuth();

  // Still checking lock state
  if (!hasChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  // Not locked or no stored user, render children
  if (!isLocked || !storedUser) {
    return <>{children}</>;
  }

  // Handle logout (password fallback)
  const handleLogout = async () => {
    await signOut();
    clearStoredUserForPinLogin();
    // Navigate will happen automatically via ProtectedRoute
    window.location.href = '/auth';
  };

  // Show lock screen
  return (
    <AppLockScreen
      storedUser={storedUser}
      onUnlock={unlock}
      onLogout={handleLogout}
    />
  );
}
