import type { Base, PartialCommandOptions } from '@dword-design/base';
import { omit } from 'lodash-es';

export default async function (
  this: Base,
  options: PartialCommandOptions & { browser?: string },
) {
  await this.lint(omit(options, ['browser']));
  await this.typecheck(omit(options, ['browser']));
  return this.run('build', options);
}
