import defaults from '@dword-design/defaults';
import { expect, test } from '@playwright/test';
import depcheck from 'depcheck';
import endent from 'endent';
import type { Files } from 'output-files';
import outputFiles from 'output-files';

import self from '.';

type TestConfig = { files?: Files; dependency?: string; fail?: boolean };

const tests: Record<string, TestConfig> = {
  modules: {
    files: {
      'wxt.config.ts': endent`
        import { defineConfig } from 'wxt';

        export default defineConfig({
          modules: [
            'foo',
          ],
        });
      `,
    },
  },
  'relative path': {
    fail: true,
    files: {
      'wxt.config.ts': endent`
        import { defineConfig } from 'wxt';

        export default defineConfig({
          modules: [
            './modules/foo.ts',
          ],
        });
      `,
    },
  },
  scoped: {
    dependency: '@name/foo',
    files: {
      'wxt.config.ts': endent`
        import { defineConfig } from 'wxt';

        export default defineConfig({
          modules: [
            '@name/foo',
          ],
        });
      `,
    },
  },
  'scoped and subpath': {
    dependency: '@name/foo',
    files: {
      'wxt.config.ts': endent`
        import { defineConfig } from 'wxt';

        export default defineConfig({
          modules: [
            '@name/foo/bar',
          ],
        });
      `,
    },
  },
  subpath: {
    files: {
      'wxt.config.ts': endent`
        import { defineConfig } from 'wxt';

        export default defineConfig({
          modules: [
            'foo/bar',
          ],
        });
      `,
    },
  },
  'unused dependency': { fail: true },
};

for (const [name, _testConfig] of Object.entries(tests)) {
  const testConfig = defaults(_testConfig, {
    dependency: 'foo',
    fail: false,
    files: {},
  });

  test(name, async ({}, testInfo) => {
    const cwd = testInfo.outputPath();
    await outputFiles(cwd, testConfig.files);

    const result = await depcheck(cwd, {
      package: { dependencies: { [testConfig.dependency]: '^1.0.0' } },
      specials: [self({ cwd })],
    });

    expect(result.dependencies.length > 0).toEqual(testConfig.fail);
  });
}
