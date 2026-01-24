interface ErrorInfo {
  title: string;
  description: string;
  isInsufficientBalance?: boolean;
}

// Common error patterns and their friendly messages
const ERROR_PATTERNS: { pattern: RegExp | string; title: string; message: string; isBalance?: boolean }[] = [
  {
    pattern: /insufficient (balance|funds|wallet)/i,
    title: 'Insufficient Balance',
    message: "You don't have enough funds in your wallet.",
    isBalance: true,
  },
  {
    pattern: /not enough (balance|funds|money)/i,
    title: 'Insufficient Balance',
    message: "Your wallet balance is too low for this transaction.",
    isBalance: true,
  },
  {
    pattern: /low balance/i,
    title: 'Insufficient Balance',
    message: "Your wallet balance is too low.",
    isBalance: true,
  },
  {
    pattern: /edge function/i,
    title: 'Service Temporarily Unavailable',
    message: 'Please try again in a few moments.',
  },
  {
    pattern: /network (error|failed|timeout)/i,
    title: 'Connection Error',
    message: 'Please check your internet connection and try again.',
  },
  {
    pattern: /timeout/i,
    title: 'Request Timeout',
    message: 'The request took too long. Please try again.',
  },
  {
    pattern: /not authenticated|auth.*error|session/i,
    title: 'Session Expired',
    message: 'Please log in again to continue.',
  },
  {
    pattern: /invalid (phone|number|meter|smartcard|iuc)/i,
    title: 'Invalid Number',
    message: 'Please check the number you entered and try again.',
  },
  {
    pattern: /plan.*not (found|available|active)/i,
    title: 'Plan Unavailable',
    message: 'This plan is no longer available. Please select another.',
  },
  {
    pattern: /provider.*error|api.*error|external.*service/i,
    title: 'Service Provider Error',
    message: 'The service provider is having issues. Please try again later.',
  },
  {
    pattern: /verification failed/i,
    title: 'Verification Failed',
    message: 'Could not verify the details. Please check and try again.',
  },
  {
    pattern: /duplicate|already.*processed/i,
    title: 'Duplicate Transaction',
    message: 'This transaction may have already been processed. Check your history.',
  },
  {
    pattern: /maintenance|unavailable/i,
    title: 'Service Maintenance',
    message: 'This service is temporarily under maintenance. Please try again later.',
  },
  {
    pattern: /rate limit|too many requests/i,
    title: 'Too Many Requests',
    message: 'Please wait a moment before trying again.',
  },
  {
    pattern: /failed to fetch|fetch error/i,
    title: 'Connection Error',
    message: 'Could not connect to the server. Please check your internet.',
  },
];

/**
 * Parse an error and return a user-friendly message
 */
export function parseError(error: unknown): ErrorInfo {
  let errorMessage = '';
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object') {
    errorMessage = (error as any).message || (error as any).error || JSON.stringify(error);
  }
  
  // Check against known patterns
  for (const { pattern, title, message, isBalance } of ERROR_PATTERNS) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    if (regex.test(errorMessage)) {
      return {
        title,
        description: message,
        isInsufficientBalance: isBalance,
      };
    }
  }
  
  // Default fallback
  return {
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred. Please try again.',
  };
}

/**
 * Get a friendly error for API/edge function responses
 */
export function getApiErrorMessage(data: any): ErrorInfo {
  const errorString = data?.error || data?.details || data?.message || '';
  
  if (!errorString) {
    return {
      title: 'Transaction Failed',
      description: 'The transaction could not be completed. Please try again.',
    };
  }
  
  return parseError(errorString);
}

/**
 * Check if an error is an insufficient balance error
 */
export function isInsufficientBalanceError(error: unknown): boolean {
  const { isInsufficientBalance } = parseError(error);
  return isInsufficientBalance ?? false;
}

/**
 * Common transaction error categories
 */
export const ERROR_TYPES = {
  INSUFFICIENT_BALANCE: 'insufficient_balance',
  NETWORK_ERROR: 'network_error',
  AUTH_ERROR: 'auth_error',
  VALIDATION_ERROR: 'validation_error',
  PROVIDER_ERROR: 'provider_error',
  UNKNOWN: 'unknown',
} as const;

export type ErrorType = typeof ERROR_TYPES[keyof typeof ERROR_TYPES];

/**
 * Categorize an error for analytics or handling
 */
export function categorizeError(error: unknown): ErrorType {
  const { isInsufficientBalance } = parseError(error);
  
  if (isInsufficientBalance) return ERROR_TYPES.INSUFFICIENT_BALANCE;
  
  const message = error instanceof Error ? error.message : String(error);
  
  if (/auth|session|login/i.test(message)) return ERROR_TYPES.AUTH_ERROR;
  if (/network|fetch|timeout|connection/i.test(message)) return ERROR_TYPES.NETWORK_ERROR;
  if (/invalid|missing|required/i.test(message)) return ERROR_TYPES.VALIDATION_ERROR;
  if (/provider|api|service/i.test(message)) return ERROR_TYPES.PROVIDER_ERROR;
  
  return ERROR_TYPES.UNKNOWN;
}
