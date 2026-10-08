// SPDX-License-Identifier: AGPL-3.0-only
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
type PwaState = {
  standalone: boolean;
  canInstall: boolean;
  installAccepted: boolean;
  install(): Promise<void>;
};
const PwaContext = createContext<PwaState>({
  standalone: false,
  canInstall: false,
  installAccepted: false,
  install: async () => {},
});

/** Capture the browser's install event early, including before client navigation to setup. */
export function PwaProvider({ children }: { readonly children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [installAccepted, setInstallAccepted] = useState(false);
  useEffect(() => {
    const mode = window.matchMedia('(display-mode: standalone)');
    const detect = () =>
      setStandalone(
        mode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
      );
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const installed = () => {
      setInstallAccepted(true);
      setPrompt(null);
    };
    detect();
    mode.addEventListener('change', detect);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    return () => {
      mode.removeEventListener('change', detect);
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setInstallAccepted(choice.outcome === 'accepted');
    setPrompt(null);
  }
  return (
    <PwaContext.Provider
      value={{ standalone, canInstall: prompt !== null, installAccepted, install }}
    >
      {children}
    </PwaContext.Provider>
  );
}
export const usePwa = () => useContext(PwaContext);
