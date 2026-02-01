/**
 * Utility to wrap Supabase queries with timeout support.
 * This helps prevent pages from getting stuck in loading state on slow networks.
 */

const DEFAULT_TIMEOUT = 10000; // 10 seconds - reduced for better UX

/**
 * Creates an AbortController that will abort after the specified timeout
 */
export function createTimeoutController(timeout: number = DEFAULT_TIMEOUT): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);
  return controller;
}

/**
 * Wraps a promise or thenable (like Supabase's PostgrestBuilder) with a timeout.
 * Rejects if the promise doesn't resolve within the timeout.
 * 
 * IMPORTANT: This properly handles Supabase's PostgrestBuilder which is a thenable
 * but not a proper Promise. We convert it to a Promise first.
 */
export async function withTimeout<T>(
  promiseOrThenable: Promise<T> | PromiseLike<T> | { then: (onfulfilled: (value: T) => void) => void },
  timeout: number = DEFAULT_TIMEOUT,
  errorMessage: string = 'Request timed out'
): Promise<T> {
  // Convert to a proper Promise immediately to avoid thenable issues.
  const promise = Promise.resolve(promiseOrThenable as any) as Promise<T>;

  // IMPORTANT (mobile): Android/iOS may pause JS timers when the app is backgrounded.
  // A plain setTimeout-based Promise.race can therefore fire “late” on resume and falsely
  // mark successful requests as timed out.
  //
  // This timeout only counts time while the document is visible.
  let activeElapsedMs = 0;
  let lastTickMs = Date.now();
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let didTimeout = false;
  let rejectTimeout: ((err: Error) => void) | undefined;

  const isVisible = () => {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible';
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  };

  const cleanup = () => {
    stop();
    rejectTimeout = undefined;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };

  const tick = () => {
    if (!isVisible() || didTimeout) return;
    const now = Date.now();
    activeElapsedMs += Math.max(0, now - lastTickMs);
    lastTickMs = now;
    if (activeElapsedMs >= timeout) {
      didTimeout = true;
      stop();
      rejectTimeout?.(new Error(errorMessage));
    }
  };

  const start = () => {
    if (intervalId || didTimeout) return;
    lastTickMs = Date.now();
    intervalId = setInterval(tick, 250);
  };

  const onVisibilityChange = () => {
    // Pause the timeout clock while hidden, resume when visible again.
    if (isVisible()) {
      lastTickMs = Date.now();
      start();
    } else {
      stop();
    }
  };

  const timeoutPromise = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  if (isVisible()) start();

  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (error) {
    if (didTimeout) throw new Error(errorMessage);
    throw error;
  } finally {
    cleanup();
  }
}

/**
 * Retries a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't wait after the last attempt
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Combines timeout and retry for maximum resilience
 */
export async function withTimeoutAndRetry<T>(
  fn: () => Promise<T> | PromiseLike<T>,
  options: {
    timeout?: number;
    maxRetries?: number;
    baseDelay?: number;
    errorMessage?: string;
  } = {}
): Promise<T> {
  const { 
    timeout = DEFAULT_TIMEOUT, 
    maxRetries = 1, 
    baseDelay = 500,
    errorMessage = 'Request failed'
  } = options;
  
  return withRetry(
    () => withTimeout(fn(), timeout, errorMessage),
    maxRetries,
    baseDelay
  );
}
