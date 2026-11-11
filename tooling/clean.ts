/** Remove only this package's generated distribution. */
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
const output = resolve(process.cwd(), 'dist');
if (!process.cwd().replaceAll('\\','/').match(/\/packages\/[^/]+$/)) throw new Error('Run from a package');
rmSync(output, {recursive:true, force:true});
