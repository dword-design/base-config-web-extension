import type { Base, PartialCommandOptions } from '@dword-design/base';
import { execaCommand } from 'execa';

export default function (
  this: Base,
  options: PartialCommandOptions & { browser?: string },
) {
  options = {
    browser: 'chrome',
    env: {},
    log: process.env.NODE_ENV !== 'test',
    stderr: 'inherit',
    ...options,
  };

  return execaCommand(
    `wxt build${options.browser ? ` -b ${options.browser}` : ''}`,
    {
      ...(options.log && { stdout: 'inherit' }),
      cwd: this.cwd,
      stderr: options.stderr,
    },
  );
}
