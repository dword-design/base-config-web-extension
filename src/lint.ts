import type { Base, PartialCommandOptions } from '@dword-design/base';
import { execaCommand } from 'execa';

export default async function (this: Base, options: PartialCommandOptions) {
  options = {
    env: {},
    log: process.env.NODE_ENV !== 'test',
    stderr: 'inherit',
    ...options,
  };

  await execaCommand('wxt prepare', {
    ...(options.log && { stdout: 'inherit' }),
    cwd: this.cwd,
    stderr: options.stderr,
  });

  await execaCommand(
    'stylelint --fix --allow-empty-input --ignore-path .gitignore **/*.{css,scss,vue}',
    {
      ...(options.log && { stdout: 'inherit' }),
      cwd: this.cwd,
      stderr: options.stderr,
    },
  );
}
