import type { Base, PartialCommandOptions } from '@dword-design/base';
import { execaCommand } from 'execa';
import { omit } from 'lodash-es';

export default async function (
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
  await this.lint(omit(options, ['browser']));
  await this.typecheck(omit(options, ['browser']));

  return execaCommand(
    `wxt build${options.browser ? ` -b ${options.browser}` : ''}`,
    {
      ...(options.log && { stdout: 'inherit' }),
      cwd: this.cwd,
      stderr: options.stderr,
    },
  );
}
