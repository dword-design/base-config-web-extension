import pathLib from 'node:path';

import { createJiti } from 'jiti';
import requirePackageName from 'require-package-name';
import type { UserConfig } from 'wxt';

export default ({ cwd = '.' }) =>
  async (path: string) => {
    if (pathLib.basename(path) === 'wxt.config.ts') {
      // TODO: Check full path including cwd so that we check config.ts at project root
      const jiti = createJiti(pathLib.resolve(cwd));

      const config = await jiti.import<UserConfig>('./wxt.config.ts', {
        default: true,
      });

      const modules = config.modules || [];
      return modules.map(name => requirePackageName(name)!);
    }

    return [];
  };
