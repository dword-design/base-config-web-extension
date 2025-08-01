import { Base } from '@dword-design/base';
import { test, chromium, expect } from '@playwright/test';
import endent from 'endent';
import outputFiles from 'output-files';
import getPort from 'get-port';
import pathLib from 'node:path';
import express from 'express';

test('works', async ({}, testInfo) => {
  const cwd = testInfo.outputPath();

  await outputFiles(cwd, {
    'wxt.config.ts': endent`
      import { defineConfig } from 'wxt';

      export default defineConfig({ manifest: { name: 'Foo' } });
    `,
    'entrypoints/content.ts': endent`
      export default defineContentScript({
        matches: ['<all_urls>'],
        main: () => globalThis.document.querySelector('body')!.classList.add('foo'),
      })\n
    `,
    'package.json': JSON.stringify({ peerDependencies: { wxt: '*' } }),
  });

  const base = new Base('../../src', { cwd });
  await base.prepare();
  await base.run('prepublishOnly');
  const context = await chromium.launchPersistentContext('', {
    args: [
      `--disable-extensions-except=${pathLib.join(cwd, 'dist', 'chrome')}`,
      `--load-extension=${pathLib.join(cwd, 'dist', 'chrome')}`,
    ],
    channel: 'chromium',
  });

  try {
    const port = await getPort();

    const server = express()
      .get('/', (req, res) => res.send(''))
      .listen(port)
    try {
      const page = await context.newPage();
      await page.goto(`http://localhost:${port}`);
      await expect(page.locator('body')).toHaveClass('foo');
    } finally {
      await server.close();
    }
  } finally {
    await context.close();
  }
});
