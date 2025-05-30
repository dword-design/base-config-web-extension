import { execaCommand } from 'execa';

import getManifest from './get-manifest.js';

export default async function (browser = 'chrome', options) {
  options = {
    env: {},
    log: process.env.NODE_ENV !== 'test',
    stderr: 'inherit',
    ...options,
  };

  return execaCommand('vite build', {
    env: {
      ...options.env,
      MANIFEST: JSON.stringify(await getManifest({ cwd: this.cwd, browser })),
      TARGET: browser,
    },
    ...(options.log && { stdout: 'inherit' }),
    cwd: this.cwd,
    reject: process.env.NODE_ENV !== 'test',
    stderr: options.stderr,
  });
}
