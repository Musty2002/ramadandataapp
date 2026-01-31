import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Minimal network status indicator using TanStack Query's online manager.
 * TanStack Query handles all the reconnection logic automatically.
 */
export function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(onlineManager.isOnline());

  useEffect(() => {
    // Subscribe to online manager changes
    const unsubscribe = onlineManager.subscribe((online) => {
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all duration-300',
        'bg-destructive text-destructive-foreground'
      )}
    >
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span>Offline</span>
      </div>
    </div>
  );
}

interface ConnectionTimeoutOverlayProps {
  isVisible: boolean;
  onRetry: () => void;
  message?: string;
}

/**
 * Overlay shown when a page is stuck loading due to connection issues
 */
export function ConnectionTimeoutOverlay({ 
  isVisible, 
  onRetry, 
  message = "Connection seems slow" 
}: ConnectionTimeoutOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card rounded-2xl p-6 mx-4 shadow-xl max-w-sm w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-yellow-500" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{message}</h3>
        <p className="text-muted-foreground text-sm mb-4">
          The page is taking longer than expected to load. Please check your internet connection.
        </p>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => window.location.reload()}
          >
            Refresh App
          </Button>
          <Button 
            className="flex-1"
            onClick={onRetry}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
