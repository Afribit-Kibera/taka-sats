// SPDX-License-Identifier: AGPL-3.0-only
'use client';
import { ChevronRight, Nfc, QrCode, Search, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Drawer } from 'vaul';
import { QrScanner } from '@/components/enrol/QrScanner';
import { Button } from '@/components/ui/button';
import { OPEN_COLLECTION_EVENT } from '@/components/supervisor/field-actions';
import { Input } from '@/components/ui/input';
import { parseCollectorRef } from '@/lib/collectors/reference';
import { isWebNfcAvailable, startTagScan } from '@/lib/nfc';
import { getCachedCollectorByTag, listCachedCollectors, searchCachedCollectors } from '@/lib/sync';
import type { CachedCollector, RegistrationType } from '@/types/domain';

export function WeighCollectorStep({
  onResolved,
}: {
  readonly onResolved: (collector: CachedCollector, method?: RegistrationType) => void;
}) {
  const t = useTranslations('Weigh');
  const f = useTranslations('Field');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CachedCollector[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const nfcAvailable = useSyncExternalStore(
    () => () => {},
    isWebNfcAvailable,
    () => false,
  );
  const [message, setMessage] = useState<string | null>(null);
  const scan = useRef<AbortController | null>(null);
  useEffect(() => {
    const manual = () => {
      scan.current?.abort();
      scan.current = null;
      setScanning(false);
      setMessage(null);
      setQrOpen(false);
    };
    window.addEventListener(OPEN_COLLECTION_EVENT, manual);
    return () => {
      scan.current?.abort();
      window.removeEventListener(OPEN_COLLECTION_EVENT, manual);
    };
  }, []);
  useEffect(() => {
    let live = true;
    void (query.trim() ? searchCachedCollectors(query, 50) : listCachedCollectors(50)).then(
      (rows) => {
        if (live) setResults(rows);
      },
    );
    return () => {
      live = false;
    };
  }, [query]);
  const resolveReference = useCallback(
    async (raw: string) => {
      const code = parseCollectorRef(raw) ?? raw.trim();
      const rows = await searchCachedCollectors(code, 50);
      // QR identities must match exactly, never use a fuzzy name match.
      const hit = rows.find((row) => row.publicCode?.toLowerCase() === code.toLowerCase());
      if (hit) {
        setQrOpen(false);
        onResolved(hit, 'walk_in');
      } else setMessage(t('codeUnknownOffline'));
    },
    [onResolved, t],
  );
  function scanNfc() {
    if (scan.current) {
      scan.current.abort();
      scan.current = null;
      setScanning(false);
      setMessage(null);
      return;
    }
    const controller = new AbortController();
    scan.current = controller;
    setScanning(true);
    setMessage(t('holdTag'));
    void startTagScan(async (serial) => {
      const hit = await getCachedCollectorByTag(serial);
      if (controller.signal.aborted) return;
      controller.abort();
      scan.current = null;
      setScanning(false);
      if (hit) onResolved(hit, 'tap');
      else setMessage(t('tagUnknownOffline'));
    }, controller.signal).catch(() => {
      if (!controller.signal.aborted) {
        scan.current = null;
        setScanning(false);
        setMessage(t('scanError'));
      }
    });
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 size-5 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchNameCode')}
            aria-label={t('searchNameCode')}
            className="h-11 bg-card pl-10"
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={t('scanQr')}
          onClick={() => {
            setMessage(null);
            setQrOpen(true);
          }}
        >
          <QrCode aria-hidden="true" />
        </Button>
        {nfcAvailable ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={scanning ? f('cancelNfc') : t('tapOptional')}
            onClick={scanNfc}
          >
            <Nfc aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {results.map((collector) => (
          <li key={collector.id} className="flex min-w-0 items-center">
            <button
              type="button"
              onClick={() => onResolved(collector, 'walk_in')}
              className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left active:bg-accent"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary font-display font-bold text-primary">
                {collector.alias.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block break-words text-sm">{collector.alias}</strong>
                <span className="block font-mono text-xs text-muted-foreground">
                  {collector.publicCode}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </button>
            <Link
              href={`/cards?collector=${encodeURIComponent(collector.id)}`}
              aria-label={f('linkNfc', { alias: collector.alias })}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-accent"
            >
              <Nfc aria-hidden="true" className="size-5" />
            </Link>
          </li>
        ))}
      </ul>
      {results.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">
          {query.trim() ? t('noMatches') : f('noCollectors')}
        </p>
      ) : null}
      <Button asChild size="pwa" variant="outline">
        <Link href="/enrol">
          <UserPlus aria-hidden="true" />
          {t('addCollector')}
        </Link>
      </Button>
      <Drawer.Root open={qrOpen} onOpenChange={setQrOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-foreground/45" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-2xl bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Drawer.Title className="mb-3 font-display text-lg font-bold">
              {t('scanQr')}
            </Drawer.Title>
            <Drawer.Description className="mb-3 text-sm text-muted-foreground">
              {t('scanQrHint')}
            </Drawer.Description>
            <QrScanner onResult={(raw) => void resolveReference(raw)} />
            {message ? (
              <p role="status" className="mt-2 text-sm">
                {message}
              </p>
            ) : null}
            <Drawer.Close asChild>
              <Button variant="outline" className="mt-3 w-full">
                {f('close')}
              </Button>
            </Drawer.Close>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
