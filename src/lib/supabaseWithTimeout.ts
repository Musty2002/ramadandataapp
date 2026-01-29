/**
 * Utility to wrap Supabase queries with timeout support.
 * This helps prevent pages from getting stuck in loading state on slow networks.
 */

const DEFAULT_TIMEOUT = 15000; // 15 seconds

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
 */
export async function withTimeout<T>(
  promiseOrThenable: Promise<T> | PromiseLike<T> | { then: (onfulfilled: (value: T) => void) => void },
  timeout: number = DEFAULT_TIMEOUT,
  errorMessage: string = 'Request timed out'
): Promise<T> {
  let timeoutId: number | undefined;
  
  // Convert to a proper Promise if it's a thenable (like Supabase's PostgrestBuilder)
  const promise = Promise.resolve(promiseOrThenable);
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeout);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Retries a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't wait after the last attempt
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
