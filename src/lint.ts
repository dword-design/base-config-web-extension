import type { Base, PartialCommandOptions } from '@dword-design/base';
import { execaCommand } from 'execa';

export default function (this: Base, options: PartialCommandOptions) {
  options = {
    env: {},
    log: process.env.NODE_ENV !== 'test',
    stderr: 'inherit',
    ...options,
  };

  return execaCommand('wxt prepare', {
    ...(options.log && { stdout: 'inherit' }),
    cwd: this.cwd,
    stderr: options.stderr,
  });
}
