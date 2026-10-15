// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const server = base.webServer;
if (!server || Array.isArray(server)) throw new Error('Expected one public test server');
const publicBase = { ...base };
delete publicBase.globalSetup;

/** Public content/Docs checks require no DB, production credentials, or data mutation. */
export default defineConfig({
  ...publicBase,
  testMatch: 'community-launch.spec.ts',
  grep: /public (launch|Docs|local stats)/,
  webServer: {
    ...server,
    env: {
      ...server.env,
      // Explicit empties prevent Next loading a developer's real values from ignored .env files.
      DATABASE_URL: '',
      BLINK_API_KEY: '',
      OPENROUTER_API_KEY: '',
      LEDGER_SIGNING_KEY: '',
    },
  },
});
