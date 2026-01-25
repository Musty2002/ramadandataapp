import { useAutoRegisterPush } from '@/hooks/useAutoRegisterPush';

/**
 * Global component that initializes push notifications on app launch
 * Place this at the root level to auto-register devices
 */
export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  // Auto-register for push notifications on mount
  useAutoRegisterPush();
  
  return <>{children}</>;
}
