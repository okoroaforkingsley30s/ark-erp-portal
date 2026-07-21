// @ts-check

import { toast } from '@/components/ui/use-toast';

const SENSITIVE_KEY = /authorization|cookie|password|secret|session|token/i;

function safeValue(value, key = '') {
  if (SENSITIVE_KEY.test(key)) return '[redacted]';
  if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeValue(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).slice(0, 30).map(([itemKey, itemValue]) => [itemKey, safeValue(itemValue, itemKey)])
    );
  }
  return String(value);
}

export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message.trim() || fallback;
  }
  return fallback;
}

export function reportError(error, {
  context = 'application.unknown',
  userMessage = 'The operation could not be completed. Please try again.',
  metadata = {},
  notify = true,
  severity = 'error',
} = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    severity,
    context,
    message: errorMessage(error),
    code: error && typeof error === 'object' && 'code' in error ? safeValue(error.code) : undefined,
    metadata: safeValue(metadata),
  };

  const logger = severity === 'warning' ? console.warn : console.error;
  logger('[ARK ONE]', event);

  if (notify) {
    toast({
      variant: 'destructive',
      title: 'Action unsuccessful',
      description: userMessage,
    });
  }

  return event;
}

export async function captureFailure(operation, options) {
  try {
    return await operation();
  } catch (error) {
    reportError(error, options);
    throw error;
  }
}
