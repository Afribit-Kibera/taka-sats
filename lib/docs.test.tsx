// SPDX-License-Identifier: AGPL-3.0-only
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocsArticle } from '@/components/public/DocsArticle';
import { findPublicDoc, PUBLIC_DOCS, publicDocHref } from './docs';
import { loadSettings } from './config';
import { publicDocContent } from './docs-content';

describe('public documentation boundary', () => {
  it.each(['../../internal/secret', '../AGENTS.md', 'ROADMAP', '__proto__', 'constructor'])(
    'never resolves a private or unexpected slug: %s',
    (slug) => {
      expect(findPublicDoc(slug)).toBeUndefined();
    },
  );
  it('the content loader denies private slugs and loads every approved article', async () => {
    expect(await publicDocContent('../../internal/secret')).toBeNull();
    expect(await publicDocContent('__proto__')).toBeNull();
    for (const doc of PUBLIC_DOCS) {
      expect(await publicDocContent(doc.slug)).toBe(await readFile(join('docs', doc.file), 'utf8'));
    }
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    '//untrusted.example',
    '../../internal/key.env',
    'ROADMAP.md',
    'AGENTS.md',
  ])('removes an unsafe or non-public document link: %s', (href) => {
    expect(publicDocHref(href)).toBe('');
  });
  it('renders neither raw HTML, remote image requests nor executable link protocols', () => {
    const html = renderToStaticMarkup(
      createElement(DocsArticle, {
        content:
          '<script>alert(1)</script>\n\n<img src="https://secret.example/image">\n\n![image](https://secret.example/image)\n\n[bad](javascript:alert%281%29)\n\n[good](OPEN_SOURCE.md)',
        tableLabel: 'Document table',
        codeLabel: 'Code example',
      }),
    );
    expect(html).not.toMatch(/<script|<img|secret\.example|javascript:/);
    expect(html).toContain('href="/docs/open-source"');
  });
  it('all published documents exist and their Markdown links resolve to public targets', async () => {
    const files = new Set<string>();
    for (const doc of PUBLIC_DOCS) {
      expect(files.has(doc.file)).toBe(false);
      files.add(doc.file);
      const content = await readFile(join(process.cwd(), 'docs', doc.file), 'utf8');
      expect(content).toMatch(/^# /);
      for (const match of content.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)) {
        expect(publicDocHref(match[1]!), `${doc.file}: ${match[1]}`).not.toBe('');
      }
    }
  });
  it('the deployment recipe overrides Kibera identity and uses its own origin and demo rail', async () => {
    const content = await readFile(join(process.cwd(), 'docs/FORK_TO_PRODUCTION.md'), 'utf8');
    const toml = content.match(/```toml\n([\s\S]*?)```/)?.[1];
    const dotenv = content.match(/```dotenv\n([\s\S]*?)```/)?.[1];
    expect(toml).toBeTruthy();
    expect(dotenv).toBeTruthy();
    const env = Object.fromEntries(
      dotenv!
        .trim()
        .split('\n')
        .map((line) => {
          const i = line.indexOf('=');
          return [line.slice(0, i), line.slice(i + 1)];
        }),
    );
    const dir = await mkdtemp(join(tmpdir(), 'takasats-doc-recipe-'));
    try {
      await copyFile('config/settings.default.toml', join(dir, 'settings.default.toml'));
      await writeFile(join(dir, 'settings.toml'), toml!);
      const settings = loadSettings({ configDir: dir, env });
      expect(settings.community.name).toBe('Example Community');
      expect(settings.community.operator).toBe('Example Cooperative');
      expect(settings.auth.passkey_origin).toBe('https://waste.example.org');
      expect(settings.programme.public_base_url).toBe(settings.auth.passkey_origin);
      expect(settings.lightning.float_provider).toBe('fake');
      expect(settings.community.reserve.setup_confirmed).toBe(false);
      expect(settings.payouts.review_threshold_fiat_minor).toBe(0);
    } finally {
      if (!resolve(dir).startsWith(join(resolve(tmpdir()), 'takasats-doc-recipe-')))
        throw new Error('Unexpected recipe test directory');
      await rm(dir, { recursive: true, force: true });
    }
  });
});
