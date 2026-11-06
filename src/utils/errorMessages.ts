// User-facing error message mapping
// Translates internal technical error codes into friendly, actionable copy.

const ERROR_MESSAGES: Record<string, string> = {
  ERR_PRICE_CALC_FAILED:
    "We couldn't update the price just now. Please try changing an option again, or reload the page.",
  ERR_NETWORK_TIMEOUT_PRICE:
    'The price update timed out. Please check your connection and try again.',
  VALIDATION_CONFLICT_47:
    'Some of your selections are not compatible. Please review and adjust your options.',
  ERR_INVALID_QTY: 'Please enter a valid quantity.',
  ERR_DEP_MISSING_47:
    'This add-on needs another option to be enabled first. Please turn on the required option and try again.',
};

const GENERIC_ERROR_MESSAGE =
  'Something went wrong. Please try again, or contact support if it keeps happening.';

export function getUserFriendlyErrorMessage(code: string | null | undefined): string {
  if (!code) return GENERIC_ERROR_MESSAGE;
  return ERROR_MESSAGES[code] ?? GENERIC_ERROR_MESSAGE;
}
