/** Isolated loopback preview of the built Pages directory; no execution or account APIs. */
import { resolve, sep } from "node:path";
const root = resolve(import.meta.dir, '../target/site');
if (!await Bun.file(resolve(root, 'index.html')).exists()) throw new Error('Run bun run docs:build before previewing');
const server = Bun.serve({ hostname: "127.0.0.1", port: Number(process.env.PORT ?? 3098), async fetch(request) {
  let path: string;
  try { path = decodeURIComponent(new URL(request.url).pathname); } catch { return new Response("Invalid path", { status: 400 }); }
  const filePath = resolve(root, "." + path + (path.endsWith("/") ? "index.html" : ""));
  if (!filePath.startsWith(root + sep)) return new Response("Not found", { status: 404 });
  const file = Bun.file(filePath);
  if (!await file.exists()) return new Response("Not found", { status: 404 });
  return new Response(file, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
} });
console.log(`Loop docs preview: ${server.url.href}`);
