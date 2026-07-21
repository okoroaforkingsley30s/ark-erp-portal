export function getPasswordSetupRedirectUrl() {
  if (typeof window === 'undefined') return '/#/create-password';
  return `${window.location.origin}/#/create-password`;
}

export function getWelcomeRedirectUrl() {
  if (typeof window === 'undefined') return '/#/welcome';
  return `${window.location.origin}/#/welcome`;
}
// @ts-check
