// SPDX-License-Identifier: AGPL-3.0-only
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findPublicDoc } from './docs';

// Literal reads are deliberate: a dynamic docs filename makes Next trace the whole directory,
// which can include operator-private ignored Markdown during a local build.
const READERS = {
  purpose: () => readFile(join(process.cwd(), 'docs/PURPOSE.md'), 'utf8'),
  'run-your-community': () => readFile(join(process.cwd(), 'docs/FORK_TO_PRODUCTION.md'), 'utf8'),
  'open-source': () => readFile(join(process.cwd(), 'docs/OPEN_SOURCE.md'), 'utf8'),
  'records-and-claims': () => readFile(join(process.cwd(), 'docs/RECORDS_AND_CLAIMS.md'), 'utf8'),
  'field-integrity': () => readFile(join(process.cwd(), 'docs/FIELD_INTEGRITY.md'), 'utf8'),
  'community-network': () => readFile(join(process.cwd(), 'docs/FEDERATION.md'), 'utf8'),
  benchmark: () => readFile(join(process.cwd(), 'docs/LANDSCAPE.md'), 'utf8'),
} as const;

export async function publicDocContent(slug: string): Promise<string | null> {
  const doc = findPublicDoc(slug);
  return doc ? READERS[doc.slug]() : null;
}
