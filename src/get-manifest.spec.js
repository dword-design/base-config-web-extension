import { expect, test } from '@playwright/test';
import outputFiles from 'output-files';

import self from './get-manifest.js';

const tests = {
  'browser action': {
    files: { 'config.json': JSON.stringify({ action: { foo: 'bar' } }) },
    result: { action: { foo: 'bar' }, manifest_version: 3 },
  },
  'browser action and icon': {
    files: {
      'config.json': JSON.stringify({ action: { foo: 'bar' } }),
      'public/icon.png': '',
    },
    result: {
      action: { default_icon: { 128: 'icon.png' }, foo: 'bar' },
      icons: { 128: 'icon.png' },
      manifest_version: 3,
    },
  },
  'browser action true': {
    files: { 'config.json': JSON.stringify({ action: true }) },
    result: { action: {}, manifest_version: 3 },
  },
  'content script': {
    files: { 'content.js': '' },
    result: {
      content_scripts: [{ js: ['content.js'], matches: ['<all_urls>'] }],
      manifest_version: 3,
    },
  },
  empty: { result: { manifest_version: 3 } },
  'firefox id and firefox': {
    browser: 'firefox',
    env: { FIREFOX_EXTENSION_ID: '{95cd69f2-2600-4bf7-aab9-ceb5d27e5685}' },
    result: {
      browser_specific_settings: {
        gecko: { id: '{95cd69f2-2600-4bf7-aab9-ceb5d27e5685}' },
      },
      manifest_version: 3,
    },
  },
  'firefox id outside firefox': {
    env: { FIREFOX_EXTENSION_ID: '{95cd69f2-2600-4bf7-aab9-ceb5d27e5685}' },
    result: { manifest_version: 3 },
  },
  icon: {
    files: { 'public/icon.png': '' },
    result: { icons: { 128: 'icon.png' }, manifest_version: 3 },
  },
  matches: {
    files: {
      'config.json': JSON.stringify({ matches: ['foo'] }),
      'content.js': '',
    },
    result: {
      content_scripts: [{ js: ['content.js'], matches: ['foo'] }],
      manifest_version: 3,
    },
  },
  name: {
    files: { 'config.json': JSON.stringify({ name: 'Foo' }) },
    result: { manifest_version: 3, name: 'Foo' },
  },
  package: {
    files: {
      'package.json': JSON.stringify({ description: 'foo', version: '1.0.0' }),
    },
    result: { description: 'foo', manifest_version: 3, version: '1.0.0' },
  },
  permissions: {
    files: { 'config.json': JSON.stringify({ permissions: ['storage'] }) },
    result: { manifest_version: 3, permissions: ['storage'] },
  },
  'popup.html': {
    files: { 'popup.html': '' },
    result: { action: { default_popup: 'popup.html' }, manifest_version: 3 },
  },
  'service worker': {
    files: { 'background.js': '' },
    result: {
      background: { service_worker: 'background.js' },
      manifest_version: 3,
    },
  },
  'service worker firefox': {
    browser: 'firefox',
    files: { 'background.js': '' },
    result: { background: { scripts: ['background.js'] }, manifest_version: 3 },
  },
  web_accessible_resources: {
    browser: 'firefox',
    files: {
      'config.json': JSON.stringify({
        web_accessible_resources: [
          { matches: ['<all_urls>'], resources: ['popup.html'] },
        ],
      }),
    },
    result: {
      manifest_version: 3,
      web_accessible_resources: [
        { matches: ['<all_urls>'], resources: ['popup.html'] },
      ],
    },
  },
};

for (const [name, _testConfig] of Object.entries(tests)) {
  const testConfig = { browser: 'chrome', files: {}, ..._testConfig };

  test(name, async ({}, testInfo) => {
    const cwd = testInfo.outputPath('');
    await outputFiles(cwd, testConfig.files);
    const previousEnv = { ...process.env };
    Object.assign(process.env, testConfig.env);

    try {
      expect(await self({ browser: testConfig.browser, cwd })).toEqual(
        testConfig.result,
      );
    } finally {
      process.env = previousEnv;
    }
  });
}
