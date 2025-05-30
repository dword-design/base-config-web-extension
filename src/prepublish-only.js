import { execaCommand } from 'execa';

export default function (...args) {
  let options = typeof args[0] === 'string' ? args[1] : args[0];

  options = {
    browser: 'chrome',
    env: {},
    log: process.env.NODE_ENV !== 'test',
    stderr: 'inherit',
    ...(typeof args[0] === 'string' && { browser: args[0] }),
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
