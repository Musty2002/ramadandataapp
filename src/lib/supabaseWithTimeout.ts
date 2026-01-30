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
  // Create timeout tracking
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let hasTimedOut = false;
  
  // Convert to a proper Promise immediately to avoid thenable issues
  const promise = new Promise<T>((resolve, reject) => {
    // Wrap the thenable resolution
    Promise.resolve(promiseOrThenable).then(resolve).catch(reject);
  });
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      hasTimedOut = true;
      reject(new Error(errorMessage));
    }, timeout);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    
    // If it's a timeout error, throw with clear message
    if (hasTimedOut) {
      throw new Error(errorMessage);
    }
    throw error;
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
