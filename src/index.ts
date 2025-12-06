import pathLib from 'node:path';

import { type Base, type Config, defineBaseConfig } from '@dword-design/base';
import depcheckParserSass from '@dword-design/depcheck-parser-sass';
import depcheck from 'depcheck';
import binName from 'depcheck-bin-name';
import packageName from 'depcheck-package-name';
import endent from 'endent';
import fs from 'fs-extra';
import { stringify as stringifyIni } from 'ini';
import outputFiles from 'output-files';
import { readPackageSync } from 'read-pkg';

import build from './build';
import dev from './dev';
import lint from './lint';
import prepublishOnly from './prepublish-only';
import typecheck from './typecheck';

export type ConfigWebExtension = Config & { startUrl?: string }; // TODO: Fields should be defaulted in Base

export default defineBaseConfig(function (
  this: Base<ConfigWebExtension>,
  config: ConfigWebExtension,
) {
  const packageConfig = readPackageSync({ cwd: this.cwd });
  return {
    allowedMatches: Object.keys({
      '.stylelintignore': true,
      '.stylelintrc.json': true,
      '.wxtrc': true,
      assets: true,
      components: true,
      entrypoints: true,
      'index.spec.ts': true,
      modules: true,
      public: true,
      utils: true,
      'web-ext.config.ts': true,
      'wxt.config.ts': true,
    }),
    commands: {
      build: {
        handler: (options: { browser: string }) => build.call(this, options),
        options: [
          {
            default: 'chrome',
            description: 'Specify a browser',
            name: '-b, --browser <browser>',
          },
        ],
      },
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
    ...(!packageConfig.private && {
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
            publishCmd:
              'pnpm wxt submit --chrome-zip dist/*-chrome.zip --firefox-zip dist/*-firefox.zip --firefox-sources-zip dist/*-sources.zip',
          },
        ],
      ],
      preDeploySteps: [
        { run: 'pnpm prepublishOnly' },
        { run: 'pnpm wxt zip' },
        { run: 'pnpm wxt zip -b firefox' },
      ],
    }),
    editorIgnore: [
      '.stylelintcache',
      '.stylelintignore',
      '.stylelintrc.json',
      '.wxt',
      'dist',
      'userdata',
    ],
    gitignore: ['/.stylelintcache', '/.wxt', '/dist', '/userdata'],
    isLockFileFixCommitType: true,
    lint,
    lintStagedConfig: { '.{css,scss,vue}': `${binName`stylelint`} --fix` },
    prepare: () =>
      Promise.all([
        fs.ensureDir(pathLib.join(this.cwd, 'userdata')),
        outputFiles(this.cwd, {
          '.stylelintrc.json': `${JSON.stringify(
            { extends: packageName`@dword-design/stylelint-config` },
            undefined,
            2,
          )}\n`,
          '.wxtrc': stringifyIni({
            modules: [packageName`@wxt-dev/module-vue`],
            outDir: 'dist',
            outDirTemplate: '{{browser}}',
          }),
          'web-ext.config.ts': endent`
            import { defineWebExtConfig } from 'wxt';

            export default defineWebExtConfig({
              ${[
                ...(config.startUrl
                  ? [`chromiumArgs: ['${config.startUrl}']`]
                  : []),
                "chromiumProfile: 'userdata', // chromiumArgs: ['--user-data-dir=userdata'] doesn't keep sessions across dev restarts",
                'keepProfileChanges: true',
              ]
                .map(line => `${line},`)
                .join('\n')}
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
