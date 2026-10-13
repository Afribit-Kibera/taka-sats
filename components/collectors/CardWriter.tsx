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
type Detail = Found & { nfcTagId: string | null; reference: { payload: string; url: string } };

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
 * a tap finds them. Pending collectors can be tagged; tagging never authorizes payment.
 */
export function CardWriter({
  initialCollectorId,
}: {
  readonly initialCollectorId?: string | undefined;
}) {
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
    if (!initialCollectorId) return;
    const controller = new AbortController();
    void fetch(`/api/v1/collectors/${encodeURIComponent(initialCollectorId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('load_failed');
        const body = (await response.json()) as { collector: Detail };
        if (!controller.signal.aborted) setChosen(body.collector);
      })
      .catch(() => {
        if (!controller.signal.aborted) setMessage(t('loadFailed'));
      });
    return () => controller.abort();
  }, [initialCollectorId, t]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        // A supervisor may search active identities and their own pending registrations.
        // Do not request the administrator-only all-status queue.
        const responses = await Promise.all(
          ['active', 'pending'].map((status) =>
            fetch(`/api/v1/collectors?status=${status}&q=${encodeURIComponent(q)}`, {
              signal: controller.signal,
            }),
          ),
        );
        if (responses.every((response) => response.ok)) {
          const bodies = (await Promise.all(responses.map((response) => response.json()))) as {
            collectors: Found[];
          }[];
          setResults(bodies.flatMap((body) => body.collectors));
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
    if (!chosen || chosen.status === 'revoked') {
      return;
    }
    if (!navigator.onLine) {
      setMessage(t('onlineRequired'));
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
      if (controller.signal.aborted) return;
    } catch (error) {
      setStep({ kind: 'pick' });
      if (!controller.signal.aborted)
        setMessage(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? t('permissionDenied')
            : t('writeFailed'),
        );
      return;
    }
    try {
      const res = await fetch(`/api/v1/collectors/${chosen.id}/tags`, {
        signal: controller.signal,
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
      if (controller.signal.aborted) return;
      const payload = card.texts.find((text) => text.startsWith('takasats:')) ?? null;
      const res = await fetch(`/api/v1/tags/${encodeURIComponent(card.serial)}`, {
        signal: controller.signal,
      });
      let body = res.ok
        ? ((await res.json()) as { collector: { alias: string; publicCode: string } })
        : null;
      // Pending tags deliberately cannot resolve through the weighing lookup.
      // Check the selected identity's stored mapping without changing eligibility.
      if (!body && res.status === 409 && chosen && payload === chosen.reference.payload) {
        const detailResponse = await fetch(`/api/v1/collectors/${chosen.id}`, {
          signal: controller.signal,
        });
        if (detailResponse.ok) {
          const detail = (await detailResponse.json()) as { collector: Detail };
          if (detail.collector.status !== 'revoked' && detail.collector.nfcTagId === card.serial) {
            body = { collector: detail.collector };
          }
        }
      }
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
  }, [chosen, t]);

  const linkWritten = useCallback(async () => {
    if (!chosen || chosen.status === 'revoked') return;
    if (!navigator.onLine) {
      setMessage(t('onlineRequired'));
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setMessage(null);
    setStep({ kind: 'reading' });
    try {
      const card = await readCard(controller.signal);
      if (controller.signal.aborted) return;
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
        signal: controller.signal,
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
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      {!supported ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm">{t('unavailable')}</p>
      ) : null}
      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer py-2">{t('instructions')}</summary>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>{t('stepPick')}</li>
          <li>{t('stepWrite')}</li>
          <li>{t('stepPrint')}</li>
        </ol>
      </details>

      <details open={!initialCollectorId} className="space-y-2">
        <summary className="cursor-pointer py-2 font-display text-sm">{t('searchLabel')}</summary>
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
                  <span className="font-mono text-xs text-muted-foreground">
                    {found.publicCode}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {chosen ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-3">
            <CreditCard aria-hidden="true" className="size-6 text-primary" />
            <div className="min-w-0">
              <p className="break-words font-display text-lg font-bold">{chosen.alias}</p>
              <p className="break-all font-mono text-xs text-muted-foreground">
                {chosen.reference.payload}
              </p>
            </div>
          </div>
          {chosen.status === 'pending' ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t('pendingIdentity')}
            </p>
          ) : null}
          {chosen.status === 'revoked' ? (
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
          {supported && chosen.status !== 'revoked' ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              disabled={busy}
              onClick={() => void linkWritten()}
            >
              <Nfc aria-hidden="true" className="size-5" />
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
