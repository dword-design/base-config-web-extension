import P from 'node:path';

import vue from '@vitejs/plugin-vue/dist/index.mjs'; // TODO
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';
import eslint from 'vite-plugin-eslint/dist/index.mjs'; // TODO
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
  build: { outDir: P.join('dist', process.env.TARGET) },
  plugins: [
    vue(),
    webExtension({
      browser: process.env.TARGET,
      manifest: () => JSON.parse(process.env.MANIFEST),
      scriptViteConfig: { plugins: [eslint({ fix: true }), babel()] },
    }),
  ],
});
