// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from 'next-intl/server';
import { DeviceSetup } from '@/components/supervisor/DeviceSetup';

export default async function SetupPage() {
  const t = await getTranslations('FieldSetup');
  return (
    <div className="space-y-6 px-5 py-6">
      <h1 className="font-display text-2xl font-bold">{t('title')}</h1>
      <DeviceSetup />
    </div>
  );
}
