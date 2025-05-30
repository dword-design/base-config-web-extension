import pathLib from 'node:path';

import { Base } from '@dword-design/base';
import { chromium, expect, test } from '@playwright/test';
import dedent from 'dedent';
import packageName from 'depcheck-package-name';
import express from 'express';
import fs from 'fs-extra';
import getPort from 'get-port';
import { globby } from 'globby';
import outputFiles from 'output-files';

test('action with icon', async ({}, testInfo) => {
  const cwd = testInfo.outputPath('');

  await outputFiles(cwd, {
    'config.json': JSON.stringify({
      action: {},
      name: 'Foo',
      permissions: ['storage'],
    }),
    'content.js': "console.log('content')",
    'package.json': JSON.stringify({
      description: 'foo bar',
      type: 'module',
      version: '2.0.0',
    }),
    'public/icon.png': '',
  });

  const base = new Base({ name: '../../src/index.js' }, { cwd });
  await base.prepare();
  await base.run('prepublishOnly');
});

test('babel in js', async ({}, testInfo) => {
  const cwd = testInfo.outputPath('');

  await outputFiles(cwd, {
    'config.json': JSON.stringify({ name: 'Foo' }),
    'content.js': 'console.log(1 |> x => x * 2);',
    'package.json': JSON.stringify({
      description: 'foo bar',
      type: 'module',
      version: '2.0.0',
    }),
  });

  const base = new Base({ name: '../../src/index.js' }, { cwd });
  await base.prepare();
  await base.run('prepublishOnly');

  expect(
    await fs.readFile(
      pathLib.join(cwd, 'dist', 'chrome', 'content.js'),
      'utf8',
    ),
  ).toEqual('(function(){"use strict";var o;console.log((o=1,o*2))})();\n');
});

test('babel in vue', async ({}, testInfo) => {
  const cwd = testInfo.outputPath('');

  await outputFiles(cwd, {
    'background.js': "console.log('background')",
    'config.json': JSON.stringify({ name: 'Foo' }),
    'package.json': JSON.stringify({
      dependencies: { vue: '*' },
      description: 'foo bar',
      type: 'module',
      version: '2.0.0',
    }),
    'popup.html': dedent`
      <div id="app"></div>
      <script type="module" src="./popup.js"></script>
    `,
    'popup.js': dedent`
      import { createApp } from 'vue';

      import Popup from './popup.vue';

      createApp(Popup).mount('#app');
    `,
    'popup.vue': dedent`
      <template>
        <div class="foo">{{ foo }}</div>
      </template>

      <script setup>
      const foo = 1 |> x => x * 2;
      </script>
    `,
  });

  const base = new Base({ name: '../../src/index.js' }, { cwd });
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
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');
    const extensionId = background.url().split('/')[2];
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.locator('.foo')).toHaveText('2');
  } finally {
    await context.close();
  }
});

test('browser variable', async ({}, testInfo) => {
  const cwd = testInfo.outputPath('');

  await outputFiles(cwd, {
    'background.js': dedent`
      import browser from '${packageName`webextension-polyfill`}'

      browser.action.onClicked.addListener(
        () => browser.storage.local.set({ enabled: true })
      )
    `,
    'config.json': JSON.stringify({
      action: {},
      name: 'Foo',
      permissions: ['storage'],
    }),
    'content.js': dedent`
      import browser from '${packageName`webextension-polyfill`}'

      browser.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.enabled?.newValue) {
          document.body.classList.add('foo')
        }
      })
    `,
    'package.json': JSON.stringify({
      dependencies: { 'webextension-polyfill': '*' },
      description: 'foo bar',
      type: 'module',
      version: '2.0.0',
    }),
  });

  const base = new Base({ name: '../../src/index.js' }, { cwd });
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
    const port = await getPort();

    const server = express()
      .get('/', (req, res) => res.send(''))
      .listen(port);

    try {
      await page.goto(`http://localhost:${port}`);
      let [background] = context.serviceWorkers();
      if (!background) background = await context.waitForEvent('serviceworker');

      await background.evaluate(() => {
        globalThis.chrome.tabs.query({ active: true }, tabs =>
          globalThis.chrome.action.onClicked.dispatch(tabs[0]),
        );
      });

      await expect(page.locator('.foo')).toBeAttached();
    } finally {
      await server.close();
    }
  } finally {
    await context.close();
  }
});

test('linting error', async ({}, testInfo) => {
  const cwd = testInfo.outputPath('');

  await outputFiles(cwd, {
    'config.json': JSON.stringify({ name: 'Foo' }),
    'content.js': 'const foo = 1',
    'package.json': JSON.stringify({
      description: 'foo bar',
      type: 'module',
      version: '2.0.0',
    }),
  });

  const base = new Base({ name: '../../src/index.js' }, { cwd });
  await base.prepare();

  await expect(base.run('prepublishOnly', { stderr: 'pipe' })).rejects.toThrow(
    "error  'foo' is assigned a value but never used  no-unused-vars",
  );
});

test('linting error fixable', async ({}, testInfo) => {
  const cwd = testInfo.outputPath('');

  await outputFiles(cwd, {
    'config.json': JSON.stringify({ name: 'Foo' }),
    'content.js': "console.log('foo');",
    'package.json': JSON.stringify({
      description: 'foo bar',
      type: 'module',
      version: '2.0.0',
    }),
  });

  const base = new Base({ name: '../../src/index.js' }, { cwd });
  await base.prepare();
  await base.run('prepublishOnly');
});

test('linting error in vue', async ({}, testInfo) => {
  const cwd = testInfo.outputPath('');

  await outputFiles(cwd, {
    'background.js': "console.log('background')",
    'config.json': JSON.stringify({ name: 'Foo' }),
    'package.json': JSON.stringify({
      dependencies: { vue: '*' },
      description: 'foo bar',
      type: 'module',
      version: '2.0.0',
    }),
    'popup.html': dedent`
      <div id="app"></div>
      <script type="module" src="./popup.js"></script>
    `,
    'popup.js': dedent`
      import { createApp } from 'vue';

      import Popup from './popup.vue';

      createApp(Popup).mount('#app');
    `,
    'popup.vue': dedent`
      <template>
        <div class="foo" />
      </template>

      <script setup>
      foo
      </script>
    `,
  });

  const base = new Base({ name: '../../src/index.js' }, { cwd });
  await base.prepare();

  await expect(base.run('prepublishOnly', { stderr: 'pipe' })).rejects.toThrow(
    "'foo' is not defined",
  );
});

test('sass', async ({}, testInfo) => {
  const cwd = testInfo.outputPath('');

  await outputFiles(cwd, {
    'assets/style.scss': dedent`
      $color: red;

      body {
        color: $color;
      }
    `,
    'config.json': JSON.stringify({ css: ['assets/style.scss'], name: 'Foo' }),
    'content.js': "console.log('content')",
    'package.json': JSON.stringify({
      description: 'foo bar',
      type: 'module',
      version: '2.0.0',
    }),
  });

  const base = new Base({ name: '../../src/index.js' }, { cwd });
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
    const port = await getPort();

    const server = express()
      .get('/', (req, res) => res.send(''))
      .listen(port);

    try {
      await page.goto(`http://localhost:${port}`);

      expect(
        await page.evaluate(
          () => globalThis.getComputedStyle(document.body).color,
        ),
      ).toEqual('rgb(255, 0, 0)');
    } finally {
      await server.close();
    }
  } finally {
    await context.close();
  }
});

test('svg', async ({}, testInfo) => {
  const cwd = testInfo.outputPath('');

  await outputFiles(cwd, {
    'background.js': "console.log('background')",
    'config.json': JSON.stringify({ name: 'Foo' }),
    'package.json': JSON.stringify({
      dependencies: { '@mdi/svg': '*', vue: '*' },
      description: 'foo bar',
      type: 'module',
      version: '2.0.0',
    }),
    'popup.html': dedent`
      <div id="app"></div>
      <script type="module" src="./popup.js"></script>
    `,
    'popup.js': dedent`
      import { createApp } from 'vue';

      import Popup from './popup.vue';

      createApp(Popup).mount('#app');
    `,
    'popup.vue': dedent`
      <template>
        <svg-icon />
      </template>

      <script setup>
      import SvgIcon from '${packageName`@mdi/svg`}/svg/checkbox-marked-circle.svg';
      </script>
    `,
  });

  const base = new Base({ name: '../../src/index.js' }, { cwd });
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
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');
    const extensionId = background.url().split('/')[2];
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.locator('svg')).toBeAttached();
  } finally {
    await context.close();
  }
});

test('valid', async ({}, testInfo) => {
  const cwd = testInfo.outputPath('');

  await outputFiles(cwd, {
    'assets/foo.png': '',
    'background.js': "console.log('background')",
    'config.json': JSON.stringify({ name: 'Foo' }),
    'content.js': dedent`
      import model from './model/foo.js'

      document.body.classList.add(model)
    `,
    'model/foo.js': "export default 'foo'",
    'options.html': '',
    'options.js': '',
    'package.json': JSON.stringify({
      description: 'foo bar',
      type: 'module',
      version: '2.0.0',
    }),
    'popup.html': '',
    'popup.js': '',
  });

  const base = new Base({ name: '../../src/index.js' }, { cwd });
  await base.prepare();
  await base.run('prepublishOnly');

  expect(await globby('*', { cwd, onlyFiles: false })).toEqual(
    expect.arrayContaining([
      'assets',
      'background.js',
      'content.js',
      'dist',
      'config.json',
      'model',
      'options.html',
      'options.js',
      'popup.html',
      'popup.js',
    ]),
  );

  expect(
    await globby('*', { cwd: pathLib.join(cwd, 'dist'), onlyFiles: false }),
  ).toEqual(['chrome']);

  expect(
    await globby('*', {
      cwd: pathLib.join(cwd, 'dist', 'chrome'),
      onlyFiles: false,
    }),
  ).toEqual(['background.js', 'content.js', 'manifest.json', 'popup.html']);

  expect(
    await fs.readJson(pathLib.join(cwd, 'dist', 'chrome', 'manifest.json')),
  ).toEqual({
    action: { default_popup: 'popup.html' },
    background: { service_worker: 'background.js' },
    content_scripts: [{ js: ['content.js'], matches: ['<all_urls>'] }],
    description: 'foo bar',
    manifest_version: 3,
    name: 'Foo',
    version: '2.0.0',
  });

  const context = await chromium.launchPersistentContext('', {
    args: [
      `--disable-extensions-except=${pathLib.join(cwd, 'dist', 'chrome')}`,
      `--load-extension=${pathLib.join(cwd, 'dist', 'chrome')}`,
    ],
    channel: 'chromium',
  });

  try {
    const page = await context.newPage();
    const port = await getPort();

    const server = express()
      .get('/', (req, res) => res.send(''))
      .listen(port);

    try {
      await page.goto(`http://localhost:${port}`);
      await expect(page.locator('.foo')).toBeAttached();
    } finally {
      await server.close();
    }
  } finally {
    await context.close();
  }
});

test('vue', async ({}, testInfo) => {
  const cwd = testInfo.outputPath('');

  await outputFiles(cwd, {
    'background.js': "console.log('background')",
    'config.json': JSON.stringify({ name: 'Foo' }),
    'package.json': JSON.stringify({
      dependencies: { vue: '*' },
      description: 'foo bar',
      type: 'module',
      version: '2.0.0',
    }),
    'popup.html': dedent`
      <div id="app"></div>
      <script type="module" src="./popup.js"></script>
    `,
    'popup.js': dedent`
      import { createApp } from 'vue';

      import Popup from './popup.vue';

      createApp(Popup).mount('#app');
    `,
    'popup.vue': dedent`
      <template>
        <div class="foo" />
      </template>
    `,
  });

  const base = new Base({ name: '../../src/index.js' }, { cwd });
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
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');
    const extensionId = background.url().split('/')[2];
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.locator('.foo')).toBeAttached();
  } finally {
    await context.close();
  }
});
