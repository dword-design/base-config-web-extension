/**
 * Source: https://playwright.dev/docs/chrome-extensions
 */

import { test as base, chromium } from '@playwright/test';
import pathLib from 'node:path';

export const test = base.extend({
  context: async ({}, use, testInfo) => {
    const cwd = testInfo.outputPath('');
    const pathToExtension = pathLib.join(cwd, 'dist', 'chrome');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    
    try {
      await use(context);
    } finally {
      await context.close();
    }
  },
  worker: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    await use(background);
  },
  extensionId: async ({ worker }, use) => {
    const extensionId = worker.url().split('/')[2];
    await use(extensionId);
  },
});
