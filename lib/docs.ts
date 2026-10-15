// SPDX-License-Identifier: AGPL-3.0-only
import { SOURCE_CODE_URL } from '@/lib/site';

/** Explicit public allowlist. Private plans/audits are never traversed or rendered. */
export const PUBLIC_DOCS = [
  { slug: 'purpose', file: 'PURPOSE.md', key: 'purpose' },
  { slug: 'run-your-community', file: 'FORK_TO_PRODUCTION.md', key: 'deploy' },
  { slug: 'open-source', file: 'OPEN_SOURCE.md', key: 'open' },
  { slug: 'records-and-claims', file: 'RECORDS_AND_CLAIMS.md', key: 'records' },
  { slug: 'field-integrity', file: 'FIELD_INTEGRITY.md', key: 'integrity' },
  { slug: 'community-network', file: 'FEDERATION.md', key: 'network' },
  { slug: 'benchmark', file: 'LANDSCAPE.md', key: 'benchmark' },
] as const;

export function findPublicDoc(slug: string) {
  return PUBLIC_DOCS.find((doc) => doc.slug === slug);
}

const REFERENCES = new Set([
  'COMMUNITY_SETUP.md',
  'SELF_HOSTING.md',
  'CONFIGURATION.md',
  'PHONE_ACCESS.md',
  'LEDGER.md',
  'VERIFICATION.md',
  'DEVELOPMENT.md',
  'providers/README.md',
]);

/** Map repository-relative Markdown links to this portal or the public source tree. */
export function publicDocHref(href: string): string {
  if (href.startsWith('#') || href.startsWith('/docs/')) return href;
  if (/^https?:\/\//i.test(href)) return href;
  const [file = '', fragment] = href.split('#', 2);
  const doc = PUBLIC_DOCS.find((entry) => entry.file === file);
  if (doc) return `/docs/${doc.slug}${fragment ? `#${fragment}` : ''}`;
  // Unknown paths may only point at public Markdown files, never arbitrary files or protocols.
  if (REFERENCES.has(file)) {
    return `${SOURCE_CODE_URL}/blob/main/docs/${file}${fragment ? `#${fragment}` : ''}`;
  }
  return '';
}
