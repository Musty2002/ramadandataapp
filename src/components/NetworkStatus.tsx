import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NetworkStatusBanner() {
  const { isOnline, isReconnecting, reconnect } = useNetworkStatus();

  // Don't show anything when online and not reconnecting
  if (isOnline && !isReconnecting) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium transition-all duration-300',
        isOnline
          ? 'bg-yellow-500 text-yellow-950'
          : 'bg-red-500 text-white'
      )}
    >
      <div className="flex items-center justify-center gap-2">
        {isOnline ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Reconnecting...</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>You're offline</span>
            <button
              onClick={reconnect}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function NetworkStatusIndicator() {
  const { isOnline, isReconnecting } = useNetworkStatus();

  if (isOnline && !isReconnecting) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all duration-300',
        isOnline
          ? 'bg-yellow-500 text-yellow-950'
          : 'bg-red-500 text-white'
      )}
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Syncing...</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Offline</span>
          </>
        )}
      </div>
    </div>
  );
}
