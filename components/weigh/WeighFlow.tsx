// SPDX-License-Identifier: AGPL-3.0-only
'use client';
import {
  ArrowLeft,
  Camera,
  Check,
  CircleCheck,
  MapPin,
  MapPinOff,
  Recycle,
  TriangleAlert,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InstallCard } from '@/components/supervisor/InstallCard';
import { OPEN_COLLECTION_EVENT } from '@/components/supervisor/field-actions';
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  isAllowedPhotoType,
} from '@/lib/storage/photo-types';
import {
  captureCollectionEvent,
  drainEventQueue,
  drainPhotoQueue,
  primeWeighCache,
  sessionSummary,
  sha256HexBytes,
  type SessionSummary as LocalSummary,
} from '@/lib/sync';
import type {
  CachedCollector,
  CachedSessionConfig,
  GeoFix,
  RegistrationType,
} from '@/types/domain';
import { QUEUE_CHANGED_EVENT } from './SyncStatusIndicator';
import { WeighCollectorStep } from './WeighCollectorStep';

type Rate = CachedSessionConfig['rates'][number];
const number = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 3 });
const money = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 });
function requestGeo(): Promise<GeoFix> {
  if (!navigator.geolocation)
    return Promise.resolve({ kind: 'unavailable', reason: 'geolocation-unsupported' });
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          kind: 'fix',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        }),
      (err) => resolve({ kind: 'unavailable', reason: `geolocation-error-${err.code}` }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15_000 },
    ),
  );
}
/** Compact capture still commits to IndexedDB before success or network work. */
export function WeighFlow({
  supervisorId,
}: {
  readonly supervisorId: string;
  readonly supervisorName?: string | undefined;
}) {
  const t = useTranslations('Weigh');
  const f = useTranslations('Field');
  const [step, setStep] = useState<'loading' | 'blocked' | 'home' | 'form' | 'done'>('loading');
  const [config, setConfig] = useState<CachedSessionConfig | null>(null);
  const [summary, setSummary] = useState<LocalSummary | null>(null);
  const [cacheSource, setCacheSource] = useState<'network' | 'cache' | null>(null);
  const [blockedReason, setBlockedReason] = useState('');
  const [collector, setCollector] = useState<CachedCollector | null>(null);
  const [registrationType, setRegistrationType] = useState<RegistrationType>('walk_in');
  const [rate, setRate] = useState<Rate | null>(null);
  const [weight, setWeight] = useState('');
  const weightKg = Number(weight.replace(',', '.'));
  const validWeight = /^\d{1,3}([.,]\d{1,3})?$/.test(weight) && weightKg > 0 && weightKg <= 999.999;
  const [photoSha256, setPhotoSha256] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [geoReason, setGeoReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const confirming = useRef(false);
  const photoVersion = useRef(0);
  const draftVersion = useRef(0);
  const manualFocus = useRef(false);
  const invalidateDraft = useCallback(() => {
    draftVersion.current++;
    photoVersion.current++;
  }, []);
  const refreshSummary = useCallback((sessionId?: string) => {
    void sessionSummary(sessionId).then(setSummary);
  }, []);
  useEffect(() => {
    let live = true;
    void primeWeighCache().then((result) => {
      if (!live) return;
      if (result.config) {
        setConfig(result.config);
        setCacheSource(result.source);
        refreshSummary(result.config.sessionId);
        setStep('home');
      } else {
        setBlockedReason(result.reason);
        setStep('blocked');
      }
    });
    return () => {
      live = false;
      invalidateDraft();
    };
  }, [refreshSummary, invalidateDraft]);
  useEffect(() => {
    const refresh = () => refreshSummary(config?.sessionId);
    window.addEventListener(QUEUE_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(QUEUE_CHANGED_EVENT, refresh);
  }, [config?.sessionId, refreshSummary]);
  useEffect(() => {
    let frame = 0;
    const manual = () => {
      if (confirming.current) return;
      manualFocus.current = true;
      setStep((current) => (current === 'form' || current === 'done' ? 'home' : current));
      frame = requestAnimationFrame(() => {
        const picker = document.getElementById('collector-picker');
        if (picker) {
          picker.focus();
          manualFocus.current = false;
        }
      });
    };
    window.addEventListener(OPEN_COLLECTION_EVENT, manual);
    return () => {
      window.removeEventListener(OPEN_COLLECTION_EVENT, manual);
      cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    if (step !== 'home' || !manualFocus.current) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById('collector-picker')?.focus();
      manualFocus.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );
  function selectCollector(next: CachedCollector, method: RegistrationType = 'walk_in') {
    const version = ++draftVersion.current;
    photoVersion.current++;
    setCollector(next);
    setRegistrationType(method);
    setRate(config?.rates.length === 1 ? config.rates[0]! : null);
    setWeight('');
    setPhotoSha256(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoBusy(false);
    setGeo(null);
    setGeoReason('');
    setError(null);
    setStep('form');
    void requestGeo().then((fix) => {
      if (draftVersion.current === version) setGeo(fix);
    });
  }
  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const version = ++photoVersion.current;
    setPhotoBusy(true);
    setPhotoSha256(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setError(null);
    try {
      if (file.size > MAX_PHOTO_BYTES) {
        setError(f('photoTooLarge'));
        return;
      }
      if (!file.size || !isAllowedPhotoType(file.type)) throw new Error();
      const hash = await sha256HexBytes(await file.arrayBuffer());
      if (photoVersion.current !== version) return;
      setPhotoFile(file);
      setPhotoSha256(hash);
      setPhotoPreview(URL.createObjectURL(file));
    } catch {
      if (photoVersion.current === version) setError(f('photoInvalid'));
    } finally {
      if (photoVersion.current === version) setPhotoBusy(false);
    }
  }
  async function confirm() {
    if (
      !collector ||
      !rate ||
      !config ||
      !photoSha256 ||
      !photoFile ||
      !validWeight ||
      !geo ||
      photoBusy ||
      confirming.current
    )
      return;
    if (geo.kind === 'unavailable' && !geoReason.trim()) {
      setError(t('geoReasonRequired'));
      return;
    }
    confirming.current = true;
    setBusy(true);
    setError(null);
    try {
      await captureCollectionEvent(
        {
          collectorId: collector.id,
          supervisorId,
          sessionId: config.sessionId,
          material: rate.material,
          weightKg,
          rateId: rate.rateId,
          rateFiatMinor: rate.rateFiatMinor,
          exchangeRate: config.exchangeRate,
          photoSha256,
          geo: geo.kind === 'fix' ? geo : { kind: 'unavailable', reason: geoReason.trim() },
          registrationType,
        },
        { blob: photoFile, sha256: photoSha256, contentType: photoFile.type },
      );
      window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
      setStep('done');
      if (navigator.onLine)
        void Promise.allSettled([drainPhotoQueue(), drainEventQueue()]).then(() =>
          window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT)),
        );
    } catch {
      setError(t('saveFailed'));
    } finally {
      confirming.current = false;
      setBusy(false);
    }
  }
  if (step === 'loading')
    return <p className="p-4 text-sm text-muted-foreground">{t('loading')}</p>;
  if (step === 'blocked' || !config)
    return (
      <div className="space-y-2 p-4">
        <h1 className="font-display text-xl font-bold">{t('blockedTitle')}</h1>
        <p className="text-sm text-muted-foreground">{blockedReason}</p>
        <Button asChild variant="outline">
          <Link href="/setup">{f('phoneSettings')}</Link>
        </Button>
      </div>
    );
  if (step === 'home')
    return (
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-[60%]">
            <h1 className="break-words font-display text-[clamp(1.25rem,8vw,1.5rem)] font-bold">
              {f('collectionArea')}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin aria-hidden="true" className="size-4 shrink-0" />
              <span className="break-words">{config.location}</span>
            </p>
          </div>
          <Link href="/session" className="shrink-0 rounded-lg bg-secondary px-3 py-2 text-right">
            <strong className="block font-mono text-base">
              {number.format(summary?.totalKg ?? 0)} kg
            </strong>
            <span className="text-xs text-muted-foreground">
              {f('collectionCount', { count: summary?.count ?? 0 })}
            </span>
          </Link>
        </div>
        <InstallCard compact />
        {cacheSource === 'cache' ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
            {t('offlineCache')}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">{f('chooseCollector')}</p>
        <div
          id="collector-picker"
          tabIndex={-1}
          role="region"
          aria-label={f('chooseCollector')}
          className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <WeighCollectorStep onResolved={selectCollector} />
        </div>
      </div>
    );
  if (step === 'done')
    return (
      <div className="space-y-4 px-4 py-8 text-center">
        <CircleCheck aria-hidden="true" className="mx-auto size-12 text-primary" />
        <h1 className="font-display text-2xl font-bold">{t('savedQueued')}</h1>
        <p className="break-words text-sm">
          {collector?.alias} · {rate?.material} · {number.format(weightKg)} kg
        </p>
        <p className="text-sm text-muted-foreground">{t('checkedLater')}</p>
        <Button size="pwa" onClick={() => setStep('home')}>
          {t('weighAnother')}
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/session">{f('viewCollections')}</Link>
        </Button>
      </div>
    );
  const indicative = rate
    ? Math.floor(
        (rate.rateFiatMinor * (validWeight ? weightKg : 0) * 1_000_000) / config.exchangeRate,
      )
    : 0;
  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t('back')}
          disabled={busy}
          onClick={() => setStep('home')}
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h1 className="min-w-0 break-words font-display text-xl font-bold">{f('newCollection')}</h1>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2.5">
        <span className="min-w-0">
          <strong className="block break-words font-display text-lg">{collector?.alias}</strong>
          <span className="font-mono text-xs text-muted-foreground">{collector?.publicCode}</span>
        </span>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => setStep('home')}>
          {f('change')}
        </Button>
      </div>
      <fieldset className="space-y-2" disabled={busy}>
        <legend className="mb-2 text-sm font-medium">{t('material')}</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-2">
          {config.rates.map((item) => (
            <button
              type="button"
              key={item.rateId}
              aria-pressed={rate?.rateId === item.rateId}
              onClick={() => setRate(item)}
              className={`flex min-h-14 min-w-0 items-center gap-2 rounded-lg border p-2.5 text-left ${rate?.rateId === item.rateId ? 'border-primary bg-secondary' : 'border-border bg-card'}`}
            >
              <Recycle aria-hidden="true" className="size-5 shrink-0 text-primary" />
              <span className="min-w-0 break-words">
                <strong className="block break-words text-sm">{item.material}</strong>
                <span className="block text-xs text-muted-foreground">
                  {item.fiatCurrency} {money.format(item.rateFiatMinor / 100)}/kg
                </span>
              </span>
            </button>
          ))}
        </div>
        {config.rates.length === 0 ? <p className="text-sm">{t('noRates')}</p> : null}
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="weight">{t('weightLabel')}</Label>
        <div className="relative">
          <Input
            id="weight"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            className="h-14 pr-12 font-mono text-2xl"
            disabled={busy}
            aria-describedby="weight-hint"
          />
          <span className="absolute right-4 top-4 text-muted-foreground">kg</span>
        </div>
        <p id="weight-hint" className="text-xs text-muted-foreground">
          {f('weightHint')}
        </p>
        {weight && !validWeight ? (
          <p role="alert" className="text-sm text-destructive">
            {f('invalidWeight')}
          </p>
        ) : null}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={ALLOWED_PHOTO_TYPES.join(',')}
        capture="environment"
        className="hidden"
        disabled={busy}
        onChange={(event) => void onPhoto(event)}
      />
      <div className="space-y-2">
        <Label>{t('scalePhoto')}</Label>
        <button
          type="button"
          disabled={busy || photoBusy}
          onClick={() => fileInput.current?.click()}
          className="flex min-h-20 w-full items-center gap-3 rounded-xl border border-dashed border-border bg-card p-3 text-left"
        >
          {photoPreview ? (
            <Image
              src={photoPreview}
              alt={t('photoAlt')}
              width={64}
              height={64}
              unoptimized
              className="size-[64px] shrink-0 rounded-lg object-cover"
            />
          ) : (
            <Camera aria-hidden="true" className="size-7 shrink-0 text-primary" />
          )}
          <span>
            <strong className="block text-sm">
              {photoBusy
                ? f('preparingPhoto')
                : photoPreview
                  ? t('photoRetake')
                  : t('photoTakeScale')}
            </strong>
            <span className="text-xs text-muted-foreground">{f('photoHint')}</span>
          </span>
        </button>
      </div>
      {!geo ? (
        <p role="status" className="text-xs text-muted-foreground">
          {f('findingLocation')}
        </p>
      ) : geo.kind === 'unavailable' ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPinOff aria-hidden="true" className="size-4" />
            {t('geoUnavailable')}
          </p>
          <Label htmlFor="geo-reason">{t('geoReasonLabel')}</Label>
          <Input
            id="geo-reason"
            value={geoReason}
            onChange={(event) => setGeoReason(event.target.value)}
            placeholder={t('geoReasonPlaceholder')}
            disabled={busy}
          />
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin aria-hidden="true" className="size-4" />
          {f('locationAttached')}
        </p>
      )}
      {rate && validWeight ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
          <strong>
            {rate.fiatCurrency} {money.format((rate.rateFiatMinor * weightKg) / 100)}
          </strong>
          <span className="font-mono">≈ {number.format(indicative)} sats</span>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">{f('saveHint')}</p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="pwa"
        disabled={
          busy ||
          photoBusy ||
          !rate ||
          !validWeight ||
          !photoSha256 ||
          !geo ||
          (geo.kind === 'unavailable' && !geoReason.trim())
        }
      >
        <Check aria-hidden="true" />
        {busy ? t('saving') : t('confirmCollection')}
      </Button>
    </form>
  );
}
