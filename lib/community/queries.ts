// SPDX-License-Identifier: AGPL-3.0-only
import { and, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import { getSettings } from '@/lib/config';
import type { Database } from '@/lib/db/client';
import {
  exchangeRateSnapshots,
  materialRates,
  sessions,
  sessionSupervisors,
  staffPasskeys,
  supervisors,
} from '@/lib/db/schema';
import { getOperatingWallet } from '@/lib/treasury/operating';
import type { FloatReader } from '@/lib/treasury/topups';
import { communityReadiness } from './readiness';

export async function getCommunityReadiness(
  db: Database,
  provider: FloatReader,
  keyConfigured: boolean,
) {
  const settings = getSettings();
  const now = new Date();
  const [wallet, [session], [rate], [exchange], staff] = await Promise.all([
    getOperatingWallet(db, provider),
    db
      .select({
        count: sql<number>`count(distinct ${sessions.id})::int`,
        end: sql<Date | null>`min(${sessions.scheduledEnd})`,
      })
      .from(sessions)
      .innerJoin(sessionSupervisors, eq(sessionSupervisors.sessionId, sessions.id))
      .innerJoin(supervisors, eq(supervisors.id, sessionSupervisors.supervisorId))
      .where(
        and(
          eq(sessions.status, 'active'),
          lte(sessions.scheduledStart, now),
          gt(sessions.scheduledEnd, now),
          eq(supervisors.active, true),
        ),
      ),
    db
      .select({ count: sql<number>`count(distinct ${materialRates.material})::int` })
      .from(materialRates)
      .where(lte(materialRates.effectiveFrom, now)),
    db
      .select({ exists: sql<boolean>`count(*) > 0` })
      .from(exchangeRateSnapshots)
      .where(
        and(
          eq(exchangeRateSnapshots.quote, settings.programme.fiat_currency),
          eq(exchangeRateSnapshots.base, 'BTC'),
          gt(
            exchangeRateSnapshots.fetchedAt,
            new Date(now.getTime() - settings.money.rate_staleness_ttl_seconds * 1000),
          ),
          lte(exchangeRateSnapshots.fetchedAt, now),
        ),
      ),
    db
      .select({
        code: supervisors.phone,
        role: supervisors.role,
        enrolled: sql<boolean>`exists(select 1 from ${staffPasskeys} where ${staffPasskeys.supervisorId} = ${supervisors.id} and ${staffPasskeys.revokedAt} is null)`,
      })
      .from(supervisors)
      .where(
        and(
          eq(supervisors.active, true),
          inArray(supervisors.role, ['admin', 'hub_lead', 'supervisor']),
        ),
      ),
  ]);
  const production = staff.filter((row) =>
    row.code.startsWith(settings.community.production_staff_prefix),
  );
  return communityReadiness(
    settings,
    keyConfigured,
    wallet,
    {
      activeSessions: session?.count ?? 0,
      nextSessionEnd: session?.end ? new Date(session.end).toISOString() : null,
      publishedRates: rate?.count ?? 0,
      freshExchangeRate: exchange?.exists ?? false,
      productionStaff: production.length,
      enrolledStaff: production.filter((row) => row.enrolled).length,
      enrolledOperators: production.filter((row) => row.enrolled && row.role === 'admin').length,
      legacyStaff: staff.length - production.length,
    },
    now,
  );
}
