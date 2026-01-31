import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// 4 minutes - before Supabase's 5-minute timeout
const KEEP_ALIVE_INTERVAL = 4 * 60 * 1000;

/**
 * Simple keep-alive hook that pings the backend every 4 minutes
 * to prevent connection timeouts. Based on proven pattern from
 * stable mobile app implementation.
 */
export function useKeepAlive() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const pingBackend = async () => {
      try {
        await supabase.functions.invoke('keep-alive');
        console.log('[Keep-Alive] Backend pinged successfully');
      } catch (error) {
        console.log('[Keep-Alive] Ping failed:', error);
      }
    };

    // Initial ping
    pingBackend();

    // Set up interval
    intervalRef.current = setInterval(pingBackend, KEEP_ALIVE_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);
}
