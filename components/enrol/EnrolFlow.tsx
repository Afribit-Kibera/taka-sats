// SPDX-License-Identifier: AGPL-3.0-only
'use client';
import { CircleCheck, Nfc, QrCode } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrScanner } from './QrScanner';

type CollectorResponse = {
  collector: {
    id: string;
    alias: string;
    publicCode: string;
    status: string;
    recipientType?: 'individual' | 'collective';
  };
  destination?: { address: string | null; status: string } | null;
};
const KNOWN_ERRORS = new Set([
  'no_active_session',
  'forbidden',
  'spend_credential_rejected',
  'not_receive_capable',
  'unsafe_lnurl_target',
  'invalid_lightning_address',
  'destination_in_use',
  'destination_replace_forbidden',
  'not_your_collector',
  'collector_not_authorized',
  'invalid_request',
]);

/** Name and Receive wallet together. Partial failures retry the same collector UUID. */
export function EnrolFlow({
  provisioningEnabled,
  initialCollectorId,
}: {
  readonly provisioningEnabled: boolean;
  readonly initialCollectorId?: string | undefined;
}) {
  const t = useTranslations('Enrol');
  const f = useTranslations('Field');
  const [alias, setAlias] = useState('');
  const [wallet, setWallet] = useState('');
  const [recipientType, setRecipientType] = useState<'individual' | 'collective'>('individual');
  const [collector, setCollector] = useState<CollectorResponse['collector'] | null>(null);
  const [loading, setLoading] = useState(Boolean(initialCollectorId));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submission = useRef(false);
  const registrationId = useRef<string | null>(null);
  useEffect(() => {
    if (!initialCollectorId) return;
    let live = true;
    void fetch(`/api/v1/collectors/${encodeURIComponent(initialCollectorId)}`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = (await response.json()) as CollectorResponse;
        if (!live) return;
        setCollector(data.collector);
        setAlias(data.collector.alias);
        setRecipientType(data.collector.recipientType ?? 'individual');
        if (data.destination) {
          setHasWallet(true);
          setWallet(data.destination.address ?? '');
          setChecking(data.destination.status !== 'verified');
        }
      })
      .catch(() => {
        if (live) setError(t('enrolFailed'));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [initialCollectorId, t]);
  async function responseError(response: Response) {
    if (response.status === 401) return t('errors.unauthorized');
    const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
    const code = body?.error?.code;
    return code && KNOWN_ERRORS.has(code) ? t(`errors.${code}`) : t('enrolFailed');
  }
  async function save() {
    if (submission.current || loading || !alias.trim() || (initialCollectorId && !collector))
      return;
    submission.current = true;
    setBusy(true);
    setError(null);
    try {
      let saved = collector;
      if (!saved) {
        registrationId.current ??= crypto.randomUUID();
        const response = await fetch('/api/v1/collectors', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: registrationId.current, alias: alias.trim(), recipientType }),
        });
        if (!response.ok) {
          setError(await responseError(response));
          return;
        }
        saved = ((await response.json()) as CollectorResponse).collector;
        setCollector(saved);
        setAlias(saved.alias);
      }
      if (wallet.trim() && !hasWallet) {
        const response = await fetch(`/api/v1/collectors/${saved.id}/destinations`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rawCode: wallet.trim() }),
        });
        if (!response.ok) {
          setError(await responseError(response));
          return;
        }
        setHasWallet(true);
        setChecking(response.status === 202);
      }
      setDone(true);
    } catch {
      setError(t('enrolFailed'));
    } finally {
      submission.current = false;
      setBusy(false);
    }
  }
  function reset() {
    registrationId.current = null;
    setAlias('');
    setWallet('');
    setRecipientType('individual');
    setCollector(null);
    setHasWallet(false);
    setChecking(false);
    setDone(false);
    setError(null);
  }
  if (loading)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t('mine.loading')}
      </p>
    );
  if (done && collector)
    return (
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <CircleCheck aria-hidden="true" className="size-8 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="break-words font-display text-lg font-bold">
              {t(collector.status === 'active' ? 'doneTitle' : 'pendingTitle', { alias })}
            </h2>
            <p className="font-mono text-sm" data-testid="public-code">
              {collector.publicCode}
            </p>
          </div>
        </div>
        {collector.status !== 'active' ? (
          <p className="text-sm text-muted-foreground" data-testid="pending-note">
            {t('pendingBody')}
          </p>
        ) : null}
        {!hasWallet ? (
          <p className="text-sm text-muted-foreground">{t('noWalletYet')}</p>
        ) : (
          <p className="text-sm text-primary">
            {checking ? t('walletChecking') : t('receiveOnlyOk')}
          </p>
        )}
        <Button asChild size="pwa">
          <Link href="/weigh">{f('backToCollections')}</Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/cards?collector=${encodeURIComponent(collector.id)}`}
            className="flex min-h-11 items-center gap-2 text-sm text-primary"
          >
            <Nfc aria-hidden="true" className="size-4" />
            {t('cardsLink')}
          </Link>
          {!initialCollectorId ? (
            <Button variant="ghost" onClick={reset}>
              {t('enrolAnother')}
            </Button>
          ) : null}
        </div>
      </div>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="alias">{t('aliasLabel')}</Label>
        <Input
          id="alias"
          value={alias}
          onChange={(event) => setAlias(event.target.value)}
          placeholder={t('aliasPlaceholder')}
          className="h-12"
          autoComplete="off"
          required
          disabled={busy || Boolean(collector)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="manualCode">{f('lightningWallet')}</Label>
        <div className="flex gap-2">
          <Input
            id="manualCode"
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
            placeholder={t('walletPlaceholder')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            inputMode="email"
            className="h-12 min-w-0 flex-1"
            disabled={busy || hasWallet}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('scanButton')}
            className="h-12"
            disabled={busy || hasWallet}
            onClick={() => setQrOpen(true)}
          >
            <QrCode aria-hidden="true" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{f('walletHint')}</p>
      </div>
      <details className="rounded-lg border border-border bg-card px-3 py-2">
        <summary className="cursor-pointer py-1 text-sm">{f('groupOptions')}</summary>
        <fieldset className="mt-3 space-y-2" disabled={busy || Boolean(collector)}>
          <legend className="sr-only">{t('recipientType')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['individual', 'collective'] as const).map((type) => (
              <label key={type} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="recipientType"
                  checked={recipientType === type}
                  onChange={() => setRecipientType(type)}
                />
                {t(type)}
              </label>
            ))}
          </div>
        </fieldset>
        {provisioningEnabled ? (
          <p className="mt-2 text-xs text-muted-foreground">{t('provisioningTodo')}</p>
        ) : null}
      </details>
      <p className="text-xs text-muted-foreground">{t('onlineRegistration')}</p>
      {error ? (
        <div role="alert" className="space-y-1 text-sm text-destructive">
          <p>{error}</p>
          {collector ? <p className="text-foreground">{f('walletRetry')}</p> : null}
        </div>
      ) : null}
      <Button
        type="submit"
        size="pwa"
        disabled={busy || !alias.trim() || Boolean(initialCollectorId && !collector)}
      >
        {busy ? f('savingCollector') : initialCollectorId ? f('saveWallet') : f('saveCollector')}
      </Button>
      <Drawer.Root open={qrOpen} onOpenChange={setQrOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-2xl bg-background p-4">
            <Drawer.Title className="mb-2 font-display text-lg font-bold">
              {t('scanTitle')}
            </Drawer.Title>
            <Drawer.Description className="mb-3 text-sm text-muted-foreground">
              {f('scanWalletHint')}
            </Drawer.Description>
            <QrScanner
              onResult={(raw) => {
                setWallet(raw);
                setQrOpen(false);
              }}
            />
            <Drawer.Close asChild>
              <Button variant="outline" className="mt-3 w-full">
                {f('close')}
              </Button>
            </Drawer.Close>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </form>
  );
}
