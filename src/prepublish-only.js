import { execaCommand } from 'execa';

import getManifest from './get-manifest.js';

export default async function (...args) {
  let options = typeof args[0] === 'string' ? args[1] : args[0];

  options = {
    browser: 'chrome',
    env: {},
    log: process.env.NODE_ENV !== 'test',
    stderr: 'inherit',
    ...(typeof args[0] === 'string' && { browser: args[0] }),
    ...options,
  };

  return execaCommand('vite build', {
    env: {
      ...options.env,
      MANIFEST: JSON.stringify(
        await getManifest({ browser: options.browser, cwd: this.cwd }),
      ),
      TARGET: options.browser,
    },
    ...(options.log && { stdout: 'inherit' }),
    cwd: this.cwd,
    stderr: options.stderr,
  });
}
