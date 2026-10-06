// SPDX-License-Identifier: AGPL-3.0-only

'use client';

import { CreditCard, Nfc, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CredentialQr } from '@/components/console/CredentialQr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isWebNfcAvailable, readCard, writeCollectorCard } from '@/lib/nfc';

type Found = { id: string; alias: string; publicCode: string; status: string };
type Detail = Found & { reference: { payload: string; url: string } };

type Step =
  | { kind: 'pick' }
  | { kind: 'writing' }
  | { kind: 'saved'; serial: string }
  | { kind: 'reading' }
  | {
      kind: 'read';
      serial: string;
      payload: string | null;
      alias: string | null;
      matches: boolean;
    };

/**
 * Write and check collector NFC cards from an Android phone (Web NFC, Chrome). The card carries
 * the collector's public reference only (D-24); the chip serial is then linked to the collector so
 * a tap finds them. Needs a collector that is already approved.
 */
export function CardWriter() {
  const t = useTranslations('Cards');
  const supported = useSyncExternalStore(
    () => () => undefined,
    isWebNfcAvailable,
    () => true,
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[]>([]);
  const [chosen, setChosen] = useState<Detail | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [message, setMessage] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/collectors?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const body = (await res.json()) as { collectors: Found[] };
          setResults(body.collectors);
        } else setMessage(t('loadFailed'));
      } catch {
        if (!controller.signal.aborted) setMessage(t('loadFailed'));
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, t]);

  const choose = useCallback(
    async (found: Found) => {
      setMessage(null);
      setStep({ kind: 'pick' });
      setChosen(null);
      try {
        const res = await fetch(`/api/v1/collectors/${found.id}`);
        if (!res.ok) {
          setMessage(t('loadFailed'));
          return;
        }
        const body = (await res.json()) as { collector: Detail };
        setChosen(body.collector);
      } catch {
        setMessage(t('loadFailed'));
      }
    },
    [t],
  );

  const write = useCallback(async () => {
    if (!chosen) {
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setMessage(null);
    setStep({ kind: 'writing' });
    let serial: string;
    try {
      serial = await writeCollectorCard(chosen.reference, controller.signal);
    } catch {
      setStep({ kind: 'pick' });
      if (!controller.signal.aborted) setMessage(t('writeFailed'));
      return;
    }
    try {
      const res = await fetch(`/api/v1/collectors/${chosen.id}/tags`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newTagId: serial }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        setStep({ kind: 'pick' });
        setMessage(body?.error?.code === 'conflict' ? t('cardTaken') : t('linkFailed'));
        return;
      }
      setStep({ kind: 'saved', serial });
    } catch {
      setStep({ kind: 'pick' });
      setMessage(t('linkFailed'));
    }
  }, [chosen, t]);

  const verify = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setMessage(null);
    setStep({ kind: 'reading' });
    try {
      const card = await readCard(controller.signal);
      const payload = card.texts.find((text) => text.startsWith('takasats:')) ?? null;
      const res = await fetch(`/api/v1/tags/${encodeURIComponent(card.serial)}`);
      const body = res.ok
        ? ((await res.json()) as { collector: { alias: string; publicCode: string } })
        : null;
      setStep({
        kind: 'read',
        serial: card.serial,
        payload,
        alias: body?.collector.alias ?? null,
        matches: !!body && payload === `takasats:${body.collector.publicCode}`,
      });
    } catch {
      setStep({ kind: 'pick' });
      if (!controller.signal.aborted) setMessage(t('readFailed'));
    }
  }, [t]);

  const linkWritten = useCallback(async () => {
    if (!chosen || chosen.status !== 'active') return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setMessage(null);
    setStep({ kind: 'reading' });
    try {
      const card = await readCard(controller.signal);
      if (
        !card.serial ||
        !card.texts.includes(chosen.reference.payload) ||
        !card.texts.includes(chosen.reference.url)
      ) {
        setMessage(t('linkMismatch'));
        setStep({ kind: 'pick' });
        return;
      }
      const response = await fetch(`/api/v1/collectors/${chosen.id}/tags`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newTagId: card.serial }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { code?: string };
        } | null;
        setMessage(body?.error?.code === 'conflict' ? t('cardTaken') : t('linkFailed'));
        setStep({ kind: 'pick' });
      } else setStep({ kind: 'saved', serial: card.serial });
    } catch {
      if (!controller.signal.aborted) setMessage(t('linkFailed'));
      setStep({ kind: 'pick' });
    }
  }, [chosen, t]);

  const busy = step.kind === 'writing' || step.kind === 'reading';

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      {!supported ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm">{t('unavailable')}</p>
      ) : null}
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>{t('stepPick')}</li>
        <li>{t('stepWrite')}</li>
        <li>{t('stepPrint')}</li>
      </ol>

      <div className="space-y-2">
        <label htmlFor="card-search" className="font-display text-sm font-bold">
          {t('searchLabel')}
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-3.5 size-4 text-muted-foreground"
          />
          <Input
            id="card-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="min-h-11 pl-9"
            disabled={busy}
            autoComplete="off"
          />
        </div>
        <ul className="space-y-2">
          {(query.trim().length < 2 ? [] : results).map((found) => (
            <li key={found.id}>
              <button
                type="button"
                onClick={() => void choose(found)}
                disabled={busy}
                className="flex min-h-[52px] w-full items-center justify-between rounded-lg border border-border bg-card px-4 text-left active:bg-secondary"
              >
                <span className="font-display font-bold">{found.alias}</span>
                <span className="font-mono text-xs text-muted-foreground">{found.publicCode}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {chosen ? (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <CreditCard aria-hidden="true" className="size-6 text-primary" />
            <div>
              <p className="font-display text-lg font-bold">{chosen.alias}</p>
              <p className="font-mono text-xs text-muted-foreground">{chosen.reference.payload}</p>
            </div>
          </div>
          {chosen.status !== 'active' ? (
            <p role="alert" className="text-sm">
              {t('notApproved')}
            </p>
          ) : supported ? (
            <Button
              type="button"
              className="min-h-14 w-full"
              disabled={busy}
              onClick={() => void write()}
            >
              <Nfc aria-hidden="true" className="size-5" />{' '}
              {step.kind === 'writing' ? t('writing') : t('writeButton')}
            </Button>
          ) : null}
          {step.kind === 'saved' ? (
            <p role="status" className="rounded-lg bg-secondary p-3 text-sm">
              {t('saved', { code: chosen.publicCode })}{' '}
              <span className="font-mono text-xs">{step.serial}</span>
            </p>
          ) : null}
          {supported && chosen.status === 'active' ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              disabled={busy}
              onClick={() => void linkWritten()}
            >
              {t('linkWritten')}
            </Button>
          ) : null}
          <CredentialQr
            payload={chosen.reference.payload}
            publicCode={chosen.publicCode}
            alias={chosen.alias}
          />
        </div>
      ) : null}

      {supported ? (
        <div className="space-y-3 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            className="min-h-14 w-full"
            disabled={busy}
            onClick={() => void verify()}
          >
            <Nfc aria-hidden="true" className="size-5" />{' '}
            {step.kind === 'reading' ? t('reading') : t('readButton')}
          </Button>
          {busy ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full"
              onClick={() => {
                abort.current?.abort();
                setStep({ kind: 'pick' });
              }}
            >
              {t('cancel')}
            </Button>
          ) : null}
          {step.kind === 'read' ? (
            <div
              role="status"
              className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm"
            >
              <p>
                {t('readPayload')}:{' '}
                <span className="font-mono">{step.payload ?? t('readEmpty')}</span>
              </p>
              <p>
                {t('readCollector')}:{' '}
                <span className="font-bold">{step.alias ?? t('readUnlinked')}</span>
              </p>
              <p className="font-mono text-xs text-muted-foreground">{step.serial}</p>
              <p className="font-medium">{step.matches ? t('readVerified') : t('readMismatch')}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p role="alert" className="text-sm font-medium">
          {message}
        </p>
      ) : null}
    </div>
  );
}
