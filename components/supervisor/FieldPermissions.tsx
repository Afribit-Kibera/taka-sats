// SPDX-License-Identifier: AGPL-3.0-only
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'error';
type Permissions = { camera: PermissionState; geolocation: PermissionState };
const Context = createContext<{ states: Permissions; busy: boolean; request: () => Promise<void> }>(
  {
    states: { camera: 'prompt', geolocation: 'prompt' },
    busy: false,
    request: async () => {},
  },
);
export const useFieldPermissions = () => useContext(Context);

/** Native prompts on the first signed-in load. No media or coordinates are retained. */
export function FieldPermissions({
  enabled,
  staffId,
  children,
}: {
  readonly enabled: boolean;
  readonly staffId: string;
  readonly children: ReactNode;
}) {
  const [states, setStates] = useState<Permissions>({ camera: 'prompt', geolocation: 'prompt' });
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const requesting = useRef(false);
  const attempted = useRef(false);
  const request = useCallback(async () => {
    if (requesting.current) return;
    requesting.current = true;
    setBusy(true);
    // Independent requests: an unanswered camera prompt must not prevent location setup.
    await Promise.allSettled(
      (['camera', 'geolocation'] as const).map(async (name) => {
        let state: PermissionState = 'granted';
        try {
          if (name === 'camera') {
            if (!navigator.mediaDevices?.getUserMedia) state = 'unsupported';
            else {
              const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false,
              });
              stream.getTracks().forEach((track) => track.stop());
            }
          } else if (!navigator.geolocation) state = 'unsupported';
          else
            await new Promise<void>((resolve, reject) =>
              navigator.geolocation.getCurrentPosition(() => resolve(), reject, {
                timeout: 8000,
                maximumAge: 0,
              }),
            );
        } catch (error) {
          state =
            (error instanceof DOMException &&
              ['NotAllowedError', 'SecurityError'].includes(error.name)) ||
            (name === 'geolocation' && (error as { code?: number })?.code === 1)
              ? 'denied'
              : 'error';
        }
        if (mounted.current) setStates((s) => ({ ...s, [name]: state }));
      }),
    );
    requesting.current = false;
    if (mounted.current) setBusy(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const watched: PermissionStatus[] = [];
    for (const name of ['camera', 'geolocation'] as const) {
      void navigator.permissions
        ?.query({ name: name as PermissionName })
        .then((status) => {
          if (!mounted.current) return;
          const update = () => setStates((s) => ({ ...s, [name]: status.state }));
          update();
          status.onchange = update;
          watched.push(status);
        })
        .catch(() => {});
    }
    if (enabled && !attempted.current) {
      attempted.current = true;
      const key = `takasats:permissions:${staffId}`;
      let already = false;
      try {
        already = sessionStorage.getItem(key) === 'asked';
        sessionStorage.setItem(key, 'asked');
      } catch {
        /* Storage may be disabled. */
      }
      if (!already) void request();
      void navigator.storage?.persist?.().catch(() => false);
    }
    return () => {
      mounted.current = false;
      watched.forEach((s) => {
        s.onchange = null;
      });
    };
  }, [enabled, request, staffId]);
  return <Context.Provider value={{ states, busy, request }}>{children}</Context.Provider>;
}
