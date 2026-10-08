// SPDX-License-Identifier: AGPL-3.0-only
'use client';

import { Camera, MapPin, Nfc } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { isWebNfcAvailable, startTagScan } from '@/lib/nfc';
import { primeWeighCache } from '@/lib/sync/prime';
import { InstallCard } from './InstallCard';
import { PhoneSecurityCard } from '@/components/auth/PhoneSecurityCard';

type DevicePermission = 'camera' | 'geolocation' | 'nfc';
type State = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'error';
const permissions: DevicePermission[] = ['camera', 'geolocation', 'nfc'];
const icons = { camera: Camera, geolocation: MapPin, nfc: Nfc };
const bits = { camera: 1, geolocation: 2, nfc: 4 };
function deviceCapabilities() {
  return (
    (typeof navigator.mediaDevices?.getUserMedia === 'function' ? 1 : 0) |
    (navigator.geolocation ? 2 : 0) |
    (isWebNfcAvailable() ? 4 : 0)
  );
}

/** User gestures request each permission; no photo, location or tag data is retained by setup. */
export function DeviceSetup({ securityRequired = false }: { readonly securityRequired?: boolean }) {
  const t = useTranslations('FieldSetup');
  const supported = useSyncExternalStore(
    () => () => {},
    deviceCapabilities,
    () => 7,
  );
  const [states, setStates] = useState<Record<DevicePermission, State>>({
    camera: 'prompt',
    geolocation: 'prompt',
    nfc: 'prompt',
  });
  const [busy, setBusy] = useState<DevicePermission | 'session' | null>(null);
  const [session, setSession] = useState<{ location: string } | null>(null);
  const [readiness, setReadiness] = useState('sessionUnchecked');
  const mounted = useRef(true);
  const nfcAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    const watched: PermissionStatus[] = [];
    for (const permission of permissions) {
      if (
        (permission === 'nfc' && !isWebNfcAvailable()) ||
        (permission === 'camera' && !navigator.mediaDevices?.getUserMedia) ||
        (permission === 'geolocation' && !navigator.geolocation)
      ) {
        continue;
      }
      void navigator.permissions
        ?.query({ name: permission as PermissionName })
        .then((status) => {
          if (!mounted.current) return;
          const update = () => setStates((s) => ({ ...s, [permission]: status.state }));
          update();
          status.onchange = update;
          watched.push(status);
        })
        .catch(() => {});
    }
    return () => {
      mounted.current = false;
      nfcAbort.current?.abort();
      watched.forEach((s) => {
        s.onchange = null;
      });
    };
  }, []);

  async function requestPermission(permission: DevicePermission) {
    setBusy(permission);
    try {
      if (permission === 'camera') {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        stream.getTracks().forEach((track) => track.stop());
      } else if (permission === 'geolocation') {
        await new Promise<void>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(() => resolve(), reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0,
          }),
        );
      } else {
        const controller = new AbortController();
        nfcAbort.current = controller;
        try {
          await startTagScan(() => {}, controller.signal);
        } finally {
          controller.abort();
        }
      }
      if (mounted.current) setStates((s) => ({ ...s, [permission]: 'granted' }));
    } catch (error) {
      const denied =
        (error instanceof DOMException &&
          ['NotAllowedError', 'SecurityError'].includes(error.name)) ||
        (permission === 'geolocation' && (error as { code?: number })?.code === 1);
      if (mounted.current) setStates((s) => ({ ...s, [permission]: denied ? 'denied' : 'error' }));
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  async function prepareSession() {
    setBusy('session');
    try {
      // A cached old session is never shown as today's successful readiness check.
      const response = await fetch('/api/v1/weigh/bootstrap', { cache: 'no-store' });
      if (!response.ok) {
        setSession(null);
        setReadiness(
          response.status === 403
            ? 'sessionMissing'
            : response.status === 401
              ? 'signInAgain'
              : 'sessionFailed',
        );
        return;
      }
      const result = await primeWeighCache();
      if (result.source !== 'network') {
        setSession(null);
        setReadiness('sessionFailed');
        return;
      }
      setSession({ location: result.config.location });
      setReadiness('sessionReady');
      await navigator.storage?.persist?.().catch(() => false);
    } catch {
      setSession(null);
      setReadiness('sessionFailed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('supportedPhone')}</p>
      <InstallCard />
      <PhoneSecurityCard required={securityRequired} />
      {!securityRequired ? (
        <>
          <section aria-labelledby="permissions-heading" className="space-y-4">
            <h2 id="permissions-heading" className="font-display text-xl font-bold">
              {t('permissionsTitle')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('permissionsHint')}</p>
            {permissions.map((permission) => {
              const Icon = icons[permission];
              const state = supported & bits[permission] ? states[permission] : 'unsupported';
              return (
                <div
                  key={permission}
                  className="space-y-3 rounded-xl border border-border bg-card p-4"
                >
                  <h3 className="flex items-center gap-2 font-display font-bold">
                    <Icon aria-hidden="true" className="size-5 text-primary" />
                    {t(permission)}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t(`${permission}Hint`)}</p>
                  <p role="status" className="text-sm font-medium">
                    {t(state)}
                  </p>
                  {state === 'denied' ? <p className="text-sm">{t('permissionDenied')}</p> : null}
                  {state !== 'unsupported' ? (
                    <Button
                      variant="outline"
                      className="min-h-11 w-full"
                      disabled={busy !== null}
                      onClick={() => void requestPermission(permission)}
                    >
                      {t(busy === permission ? 'requesting' : 'allow', {
                        permission: t(permission),
                      })}
                    </Button>
                  ) : null}
                </div>
              );
            })}
            <p className="text-sm text-muted-foreground">{t('fallbacks')}</p>
          </section>
          <section
            aria-labelledby="session-heading"
            className="space-y-3 rounded-xl bg-secondary p-5"
          >
            <h2 id="session-heading" className="font-display text-xl font-bold">
              {t('sessionTitle')}
            </h2>
            <p role="status" className="text-sm">
              {t(readiness)}
              {session ? ` ${session.location}` : ''}
            </p>
            <Button
              className="min-h-12 w-full"
              disabled={busy !== null}
              onClick={() => void prepareSession()}
            >
              {t(busy === 'session' ? 'checkingSession' : 'checkSession')}
            </Button>
            <p className="text-sm">{t('offlineHint')}</p>
          </section>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/weigh"
              className="flex min-h-14 items-center justify-center rounded-lg bg-primary px-3 text-center font-display font-bold text-primary-foreground"
            >
              {t('openField')}
            </Link>
            <Link
              href="/cards"
              className="flex min-h-14 items-center justify-center rounded-lg border border-border px-3 text-center font-display font-bold"
            >
              {t('openCards')}
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">{t('approvalHint')}</p>
        </>
      ) : null}
    </div>
  );
}
