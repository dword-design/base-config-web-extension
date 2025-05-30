import pathLib from 'node:path';

import puppeteer from '@dword-design/puppeteer';
import tester from '@dword-design/tester';
import testerPluginTmpDir from '@dword-design/tester-plugin-tmp-dir';
import dedent from 'dedent';
import packageName from 'depcheck-package-name';
import { execaCommand } from 'execa';
import express from 'express';
import fs from 'fs-extra';
import { globby } from 'globby';
import outputFiles from 'output-files';
import { expect, test, chromium } from '@playwright/test';
import { Base } from '@dword-design/base';

test('action with icon', async ({}, testInfo) => {
  const cwd = testInfo.outputPath('');
  await outputFiles(cwd, {
    'config.json': JSON.stringify({
      action: {},
      name: 'Foo',
      permissions: ['storage'],
    }),
    'content.js': '',
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
    await fs.readFile(pathLib.join(cwd, 'dist', 'chrome', 'content.js'), 'utf8'),
  ).toEqual(
    '(function(){"use strict";var o;console.log((o=1,o*2))})();\n',
  );
});

test('babel in vue', async ({ page }, testInfo) => {
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
    //channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${pathLib.join(cwd, 'dist', 'chrome')}`,
      `--load-extension=${pathLib.join(cwd, 'dist', 'chrome')}`,
    ],
  });
  const workers = context.serviceWorkers();
  const [background] = workers;
  console.log('workers.length', workers.length);
  if (!background) {
    background = await context.waitForEvent('serviceworker');
  }
  const extensionId = background.url().split('/')[2];
  await new Promise(resolve => setTimeout(resolve, 5_000));
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('.foo')).toHaveText('2');
});

const tests = {
  'browser variable': {
    files: {
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
        baseConfig: pathLib.resolve('src', 'index.js'),
        dependencies: { 'webextension-polyfill': '*' },
        description: 'foo bar',
        type: 'module',
        version: '2.0.0',
      }),
    },
    test: async ({ page, worker }) => {
      await page.goto('http://localhost:3000');
      await worker.evaluate(() => {
        globalThis.chrome.tabs.query({ active: true }, tabs =>
          globalThis.chrome.action.onClicked.dispatch(tabs[0]),
        );
      });

      await expect(page.locator('.foo')).toBeAttached();
    },
  },
  'linting error': {
    error: "error  'foo' is assigned a value but never used  no-unused-vars",
    files: {
      'config.json': JSON.stringify({ name: 'Foo' }),
      'content.js': 'const foo = 1',
      'package.json': JSON.stringify({
        baseConfig: pathLib.resolve('src', 'index.js'),
        description: 'foo bar',
        type: 'module',
        version: '2.0.0',
      }),
    },
  },
  'linting error fixable': {
    files: {
      'config.json': JSON.stringify({ name: 'Foo' }),
      'content.js': "console.log('foo');",
      'package.json': JSON.stringify({
        baseConfig: pathLib.resolve('src', 'index.js'),
        description: 'foo bar',
        type: 'module',
        version: '2.0.0',
      }),
    },
  },
  'linting error in vue': {
    error: "'foo' is not defined",
    files: {
      'background.js': '',
      'config.json': JSON.stringify({ name: 'Foo' }),
      'package.json': JSON.stringify({
        baseConfig: pathLib.resolve('src', 'index.js'),
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
    },
  },
  sass: {
    files: {
      'assets/style.scss': dedent`
        $color: red;

        body {
          color: $color;
        }
      `,
      'config.json': JSON.stringify({
        css: ['assets/style.scss'],
        name: 'Foo',
      }),
      'content.js': '',
      'package.json': JSON.stringify({
        baseConfig: pathLib.resolve('src', 'index.js'),
        description: 'foo bar',
        type: 'module',
        version: '2.0.0',
      }),
    },
    test: async ({ page }) => {
      await page.goto('http://localhost:3000');

      expect(
        await page.evaluate(
          () => globalThis.getComputedStyle(document.body).color,
        ),
      ).toEqual('rgb(255, 0, 0)');
    },
  },
  svg: {
    files: {
      'background.js': '',
      'config.json': JSON.stringify({ name: 'Foo' }),
      'package.json': JSON.stringify({
        baseConfig: pathLib.resolve('src', 'index.js'),
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
    },
    test: async ({ page, extensionId }) => {
      await page.goto('http://localhost:3000');
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await expect(page.locator('svg')).toBeAttached();
    },
  },
  valid: {
    files: {
      'assets/foo.png': '',
      'background.js': '',
      'config.json': JSON.stringify({ name: 'Foo' }),
      'content.js': dedent`
        import model from './model/foo.js'

        document.body.classList.add(model)
      `,
      'model/foo.js': "export default 'foo'",
      'options.html': '',
      'options.js': '',
      'package.json': JSON.stringify({
        baseConfig: pathLib.resolve('src', 'index.js'),
        description: 'foo bar',
        type: 'module',
        version: '2.0.0',
      }),
      'popup.html': '',
      'popup.js': '',
    },
    test: async ({ page, cwd }) => {
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

      expect(await globby('*', { cwd: pathLib.join(cwd, 'dist'), onlyFiles: false })).toEqual([
        'chrome',
      ]);

      expect(
        await globby('*', {
          cwd: pathLib.join(cwd, 'dist', 'chrome'),
          onlyFiles: false,
        }),
      ).toEqual([
        'background.js',
        'content.js',
        'manifest.json',
        'popup.html',
      ]);

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

      await page.goto('http://localhost:3000');
      await expect(page.locator('.foo')).toBeAttached();
    },
  },
  vue: {
    files: {
      'background.js': '',
      'config.json': JSON.stringify({ name: 'Foo' }),
      'package.json': JSON.stringify({
        baseConfig: pathLib.resolve('src', 'index.js'),
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
    },
    test: async ({ page, extensionId }) => {
      await page.goto('http://localhost:3000');
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await expect(page.locator('.foo')).toBeAttached();
    },
  },
};

for (const [name, testConfig] of Object.entries(tests)) {
  test(name, async ({ page }, testInfo) => {
    const cwd = testInfo.outputPath('');
    await outputFiles(cwd, test.files);
    await execaCommand('base prepare', { cwd });

    if (test.error) {
      await expect(execaCommand('base prepublishOnly', { cwd })).rejects.toThrow(
        test.error,
      );

      return;
    }

    await execaCommand('base prepublishOnly', { cwd });

    if (test.test) {
      const server = express()
        .get('/', (req, res) => res.send(''))
        .listen(3000);
      try {
        await test.test({ page, cwd });
      } finally {
        await server.close();
      }
    }
  });
}
