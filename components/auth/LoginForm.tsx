// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authenticateWithPhone } from '@/lib/auth/passkey-client';

export function LoginForm() {
  const t = useTranslations('Login');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function finishSignIn() {
    const session = (await fetch('/api/auth/session', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then((r) => r.json())
      .catch(() => null)) as { user?: { role?: string } } | null;
    const role = session?.user?.role;
    if (!role) {
      setError(t('phoneFailed'));
      return;
    }
    router.push(role === 'admin' || role === 'hub_lead' ? '/admin' : '/setup');
    router.refresh();
  }
  async function phoneSignIn() {
    setPending(true);
    setError(null);
    try {
      await authenticateWithPhone(false);
      await finishSignIn();
    } catch {
      setError(t('phoneFailed'));
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await signIn('credentials', {
      identifier: String(form.get('identifier') ?? ''),
      password: String(form.get('password') ?? ''),
      redirect: false,
    });

    setPending(false);
    if (result?.error) {
      setError(t('invalid'));
      return;
    }
    await finishSignIn();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Button
        type="button"
        size="pwa"
        className="w-full"
        disabled={pending}
        onClick={() => void phoneSignIn()}
      >
        {t('phoneSignIn')}
      </Button>
      <p className="text-sm text-muted-foreground">{t('firstLogin')}</p>
      <div className="space-y-1.5">
        <Label htmlFor="identifier">{t('identifier')}</Label>
        <Input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          required
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="pwa" disabled={pending}>
        {pending ? t('signingIn') : t('signIn')}
      </Button>
    </form>
  );
}
