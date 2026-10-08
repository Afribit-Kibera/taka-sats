// SPDX-License-Identifier: AGPL-3.0-only
'use client';
import { signIn } from 'next-auth/react';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

export class PhoneSecurityError extends Error {}
async function post(action: string, response?: unknown) {
  const result = await fetch('/api/auth/passkeys', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ action, ...(response ? { response } : {}) }),
  });
  const json = await result.json();
  if (!result.ok)
    throw new PhoneSecurityError(typeof json.error === 'string' ? json.error : 'invalid_passkey');
  return json;
}
/** Invoked from a button; the phone owns the screen-lock prompt and secret key. */
export async function authenticateWithPhone(register: boolean) {
  const browser = await import('@simplewebauthn/browser');
  if (!browser.browserSupportsWebAuthn()) throw new PhoneSecurityError('unsupported');
  const response = register
    ? await browser.startRegistration({
        optionsJSON: (await post('register-options')) as PublicKeyCredentialCreationOptionsJSON,
      })
    : await browser.startAuthentication({
        optionsJSON: (await post('login-options')) as PublicKeyCredentialRequestOptionsJSON,
      });
  await post(register ? 'register-verify' : 'login-verify', response);
  // Proof is an HttpOnly cookie, not a reusable token exposed to JavaScript.
  const result = await signIn('passkey', { redirect: false });
  if (result?.error) throw new PhoneSecurityError('session_failed');
}
