/** TypeScript 7.1 protocol-v1 content mapper for standalone WIT files.
 * It runs only under the compiler's explicit external-code/workspace-trust gate.
 * Generated declarations are synthesized; precise WIT rename/span mapping is not claimed.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateWitContract, virtualWitModule } from './wit-contracts';

export async function mapWitContent(content: string, world = 'svg-editor') {
  if (Buffer.byteLength(content) > 256 * 1024) throw new Error('WIT source limit exceeded');
  const directory = await mkdtemp(join(tmpdir(), 'loop-wit-mapper-'));
  try {
    const file = join(directory, 'world.wit');
    await writeFile(file, content);
    const generated = await generateWitContract(file, world);
    return { text: virtualWitModule(generated, world), extension: '.ts', mappings: [] };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

if (import.meta.main) {
  let buffer = Buffer.alloc(0);
  const projects = new Map<string, string>();
  const reply = (value: unknown) => {
    const payload = Buffer.from(JSON.stringify(value));
    process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
    process.stdout.write(payload);
  };
  const request = async (message: { id?: string | number; method: string; params?: Record<string, unknown> }) => {
    if (message.id === undefined) return;
    try {
      let result: unknown;
      const params = message.params ?? {};
      switch (message.method) {
        case 'initialize':
          if (params.protocolVersion !== undefined && params.protocolVersion !== 1) throw new Error('Unsupported mapper protocol');
          if (!Array.isArray(params.positionEncodings) || !params.positionEncodings.includes('utf-16')) throw new Error('UTF-16 mapper positions are required');
          result = { protocolVersion: 1, positionEncoding: 'utf-16', diagnosticSource: 'loop-wit' }; break;
        case 'openProject': {
          const options = params.options as { world?: string } | undefined;
          projects.set(String(params.projectHandle), options?.world ?? 'svg-editor');
          result = {}; break;
        }
        case 'closeProject': projects.delete(String(params.projectHandle)); result = null; break;
        case 'transform':
          try { result = await mapWitContent(String(params.content ?? ''), projects.get(String(params.projectHandle))); }
          catch (error) { result = { text: 'export {};', extension: '.ts', mappings: [], diagnostics: [{ start: 0, length: 1, code: 1, messageText: String(error).slice(0, 4096) }] }; }
          break;
        default: throw new Error(`Unknown mapper method ${message.method}`);
      }
      reply({ jsonrpc: '2.0', id: message.id, result });
    } catch (error) { reply({ jsonrpc: '2.0', id: message.id, error: { code: -32602, message: String(error) } }); }
  };
  let queued = Promise.resolve();
  process.stdin.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const boundary = buffer.indexOf('\r\n\r\n');
      if (boundary < 0) return;
      const header = buffer.subarray(0, boundary).toString('ascii');
      const length = Number(/^Content-Length:\s*(\d+)$/im.exec(header)?.[1]);
      if (!Number.isSafeInteger(length) || length < 0 || length > 1024 * 1024) throw new Error('Invalid mapper frame');
      if (buffer.length < boundary + 4 + length) return;
      const message = JSON.parse(buffer.subarray(boundary + 4, boundary + 4 + length).toString('utf8'));
      buffer = buffer.subarray(boundary + 4 + length);
      queued = queued.then(() => request(message));
    }
  });
}
