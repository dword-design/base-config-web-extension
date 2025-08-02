import pathLib from 'node:path';

import { type Base, defineBaseConfig } from '@dword-design/base';
import depcheckParserSass from '@dword-design/depcheck-parser-sass';
import depcheck from 'depcheck';
import binName from 'depcheck-bin-name';
import packageName from 'depcheck-package-name';
import endent from 'endent';
import fs from 'fs-extra';
import { stringify as stringifyIni } from 'ini';
import outputFiles from 'output-files';

import dev from './dev';
import lint from './lint';
import prepublishOnly from './prepublish-only';
import typecheck from './typecheck';

export default defineBaseConfig(function (this: Base) {
  return {
    allowedMatches: Object.keys({
      '.wxtrc': true,
      assets: true,
      components: true,
      entrypoints: true,
      'index.spec.ts': true,
      modules: true,
      utils: true,
      public: true,
      'web-ext.config.ts': true,
      'wxt.config.ts': true,
    }),
    commands: {
      dev: {
        handler: (options: { browser: string }) => dev.call(this, options),
        options: [
          {
            default: 'chrome',
            description: 'Specify a browser',
            name: '-b, --browser <browser>',
          },
        ],
      },
      prepublishOnly: {
        handler: (options: { browser: string }) =>
          prepublishOnly.call(this, options),
        options: [
          {
            default: 'chrome',
            description: 'Specify a browser',
            name: '-b, --browser <browser>',
          },
        ],
      },
    },
    depcheckConfig: {
      parsers: {
        '**/*.scss': depcheckParserSass,
        '**/*.vue': depcheck.parser.vue,
      },
    },

    deployAssets: [{ label: 'Extension', path: 'extension.zip' }],
    deployEnv: {
      CHROME_CLIENT_ID: '${{ secrets.CHROME_CLIENT_ID }}',
      CHROME_CLIENT_SECRET: '${{ secrets.CHROME_CLIENT_SECRET }}',
      CHROME_EXTENSION_ID: '${{ secrets.CHROME_EXTENSION_ID }}',
      CHROME_REFRESH_TOKEN: '${{ secrets.CHROME_REFRESH_TOKEN }}',
      FIREFOX_EXTENSION_ID: '${{ secrets.FIREFOX_EXTENSION_ID }}',
      FIREFOX_JWT_ISSUER: '${{ secrets.FIREFOX_JWT_ISSUER }}',
      FIREFOX_JWT_SECRET: '${{ secrets.FIREFOX_JWT_SECRET }}',
    },
    deployPlugins: [
      [
        packageName`@semantic-release/exec`,
        {
          publishCmd: `pnpm ${binName`publish-extension`} --chrome-zip=dist/chrome.zip --firefox-zip=dist/firefox.zip --firefox-sources-zip=dist/firefox-sources.zip`,
        },
      ],
    ],
    editorIgnore: ['.wxt', 'dist', 'userdata'],
    gitignore: ['/.wxt', '/dist', '/userdata'],
    isLockFileFixCommitType: true,
    lint,
    preDeploySteps: [
      { run: 'pnpm prepublishOnly' },
      {
        env: { FIREFOX_EXTENSION_ID: '${{ secrets.FIREFOX_EXTENSION_ID }}' },
        run: 'pnpm prepublishOnly firefox',
      },
      { run: 'zip -r ../chrome.zip .', 'working-directory': 'dist/chrome' },
      { run: 'zip -r ../firefox.zip .', 'working-directory': 'dist/firefox' },
      { run: 'git archive --output=dist/firefox-sources.zip HEAD' },
    ],
    prepare: () =>
      Promise.all([
        fs.ensureDir(pathLib.join(this.cwd, 'userdata')),
        outputFiles(this.cwd, {
          '.wxtrc': stringifyIni({
            modules: [packageName`@wxt-dev/module-vue`],
            outDir: 'dist',
            outDirTemplate: '{{browser}}',
          }),
          'web-ext.config.ts': endent`
            import { defineWebExtConfig } from 'wxt';

            export default defineWebExtConfig({
              keepProfileChanges: true,
              chromiumProfile: 'userdata', // chromiumArgs: ['--user-data-dir=userdata'] doesn't keep sessions across dev restarts
            });\n
          `,
        }),
      ]),
    readmeInstallString: endent`
      ## Recommended setup
      * Node.js 20.11.1
      * pnpm 9.15.3

      ## Install
      \`\`\`bash
      $ pnpm install --frozen-lockfile
      \`\`\`

      ## Running a development server
      \`\`\`bash
      $ pnpm dev -b <browser>
      \`\`\`
      Available browsers are \`firefox\` and \`chrome\`. Default is \`firefox\`.

      ## Building the extension for upload
      \`\`\`bash
      $ pnpm prepublishOnly -b <browser>
      \`\`\`
    `,
    typecheck,
    typescriptConfig: {
      compilerOptions: {
        declaration: false, // OtherwiseTypeScript error when declaring a content script via defineContentScript: "The inferred type of 'default' cannot be named without a reference to '@/node_modules/wxt/dist/types'. This is likely not portable. A type annotation is necessary.",
      },
      extends: './.wxt/tsconfig.json',
    },
  };
});
