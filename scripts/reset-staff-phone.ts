// SPDX-License-Identifier: AGPL-3.0-only
/** Operator-only recovery/issuance. Never expose it through an anonymous reset endpoint. */
import { execFileSync } from 'node:child_process';
import { closeSync, fsyncSync, openSync, writeSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { resetStaffPhoneAccess } from '@/lib/auth/bootstrap';
import { closeDb, getDb } from '@/lib/db/client';

const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
};
async function main() {
  const codes = flag('staff')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const out = flag('out');
  if (!codes?.length || !out)
    throw new Error(
      'Usage: pnpm staff:reset-phone --staff CODE1,CODE2 --out /private/new-phrases.txt',
    );
  const file = resolve(out);
  const rel = relative(process.cwd(), file);
  if (!isAbsolute(rel) && !rel.startsWith('..')) {
    execFileSync('git', ['check-ignore', '-q', rel], { stdio: 'ignore' });
  }
  // Refuse overwriting any credential file; establish private output before changing the DB.
  const fd = openSync(file, 'wx', 0o600);
  try {
    const credentials = await resetStaffPhoneAccess(getDb(), codes, (prepared) => {
      writeSync(
        fd,
        `# Taka Sats private setup phrases. Created ${new Date().toISOString()}\n# Use https://taka.afribit.africa/login. Staff code + phrase once, then phone security.\n# Phrases expire ${prepared[0]!.expiresAt.toISOString()}; disabled after successful enrollment.\n# Recovery revokes old passkeys and signed-in sessions. Hand out each phrase privately.\n\n${prepared.map((c) => `${c.identifier}\t${c.password}`).join('\n')}\n`,
      );
      fsyncSync(fd);
    });
    console.log(
      `${credentials.length} staff account(s) reset. Private phrases saved; no secrets printed.`,
    );
  } finally {
    closeSync(fd);
    await closeDb();
  }
}
main().catch(() => {
  console.error(
    'Staff phone reset failed. Check codes, private output path and database availability.',
  );
  process.exitCode = 1;
});
