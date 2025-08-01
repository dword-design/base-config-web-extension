import pathLib from 'node:path';

import { Base } from '@dword-design/base';
import { chromium, expect, test } from '@playwright/test';
import endent from 'endent';
import express from 'express';
import getPort from 'get-port';
import outputFiles from 'output-files';

test('works', async ({}, testInfo) => {
  const cwd = testInfo.outputPath();

  await outputFiles(cwd, {
    'entrypoints/content.ts': endent`
      export default defineContentScript({
        matches: ['<all_urls>'],
        main: () => globalThis.document.querySelector('body')!.classList.add('foo'),
      })\n
    `,
    'package.json': JSON.stringify({ peerDependencies: { wxt: '*' } }),
    'wxt.config.ts': endent`
      import { defineConfig } from 'wxt';

      export default defineConfig({ manifest: { name: 'Foo' } });
    `,
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
      .listen(port);

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

test('vue', async ({}, testInfo) => {
  const cwd = testInfo.outputPath();

  await outputFiles(cwd, {
    entrypoints: {
      'background.ts': 'export default defineBackground(() => {});',
      popup: {
        'index.html': endent`
          <div id="app"></div>
          <script type="module" src="./popup.ts"></script>
        `,
        'index.vue': endent`
          <template>
            <div class="foo" />
          </template>
        `,
        'popup.ts': endent`
          import Popup from './index.vue';

          createApp(Popup).mount('#app');
        `,
      },
    },
    'package.json': JSON.stringify({ peerDependencies: { wxt: '*' } }),
    'wxt.config.ts': endent`
      import { defineConfig } from 'wxt';

      export default defineConfig({
        manifest: { name: 'Foo' },
      });
    `,
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
    const page = await context.newPage();
    const [background] = context.serviceWorkers();
    const extensionId = background.url().split('/')[2];
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.locator('.foo')).toBeAttached();
  } finally {
    await context.close();
  }
});
