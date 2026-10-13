// SPDX-License-Identifier: AGPL-3.0-only
'use client';
import { Fingerprint } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PhoneSecurityError, authenticateWithPhone } from '@/lib/auth/passkey-client';

export function PhoneSecurityCard({ required = false }: { readonly required?: boolean }) {
  const t = useTranslations('PhoneSecurity');
  const router = useRouter();
  const [status, setStatus] = useState<{ enrolled: boolean; canonicalOrigin: string } | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/auth/passkeys', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const result = (await r.json()) as { enrolled: boolean; canonicalOrigin: string };
        if (!cancelled) setStatus(result);
      })
      .catch(() => {
        if (!cancelled) setError('statusFailed');
      });
    void import('@simplewebauthn/browser')
      .then(async (b) => {
        const available =
          b.browserSupportsWebAuthn() && (await b.platformAuthenticatorIsAvailable());
        if (!cancelled) setSupported(available);
      })
      .catch(() => {
        if (!cancelled) setSupported(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function enroll() {
    setBusy(true);
    setError(null);
    try {
      await authenticateWithPhone(true);
      setStatus((s) => (s ? { ...s, enrolled: true } : s));
      if (required) router.replace('/weigh');
      router.refresh();
    } catch (e) {
      setError(
        e instanceof PhoneSecurityError && e.message === 'recent_login_required'
          ? 'recentLogin'
          : 'cancelled',
      );
    } finally {
      setBusy(false);
    }
  }
  const otherOrigin =
    status && typeof window !== 'undefined' && window.location.origin !== status.canonicalOrigin;
  return (
    <section
      aria-labelledby="phone-security-heading"
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <h2
        id="phone-security-heading"
        className="flex items-center gap-2 font-display text-xl font-bold"
      >
        <Fingerprint aria-hidden="true" className="size-5 text-primary" />
        {t('title')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('hint')}</p>
      <p role="status" className="text-sm">
        {t(status?.enrolled ? 'enrolled' : supported === false ? 'unsupported' : 'ready')}
      </p>
      {otherOrigin ? (
        <Link href={`${status.canonicalOrigin}/setup`} className="underline">
          {t('canonical')}
        </Link>
      ) : (
        <Button
          type="button"
          variant={required ? 'default' : 'outline'}
          className="min-h-14 w-full"
          disabled={busy || !status || supported !== true}
          onClick={() => void enroll()}
        >
          {t(busy ? 'settingUp' : status?.enrolled ? 'addPhone' : 'setUp')}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      ) : null}
      {error === 'recentLogin' ? (
        <Button variant="outline" onClick={() => void signOut({ callbackUrl: '/login' })}>
          {t('signInAgain')}
        </Button>
      ) : null}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer py-2">{t('help')}</summary>
        <p>{t('recovery')}</p>
      </details>
    </section>
  );
}
