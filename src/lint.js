import { execaCommand } from 'execa';

export default options => {
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
  })
};
