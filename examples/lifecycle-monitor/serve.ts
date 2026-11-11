/** Development acceptance harness, isolated from Station and its active ports. */
const bundle = await Bun.build({ entrypoints: [new URL("./browser.ts", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")], target: "browser" });
if (!bundle.success) throw new AggregateError(bundle.logs, "Monitor browser build failed");
const script = await bundle.outputs[0]!.text();
const html = Bun.file(new URL("./index.html", import.meta.url));
const server = Bun.serve({ hostname: "127.0.0.1", port: 43881, fetch(request) {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/browser.js") return new Response(script, { headers: { "content-type": "text/javascript" } });
  if (pathname === "/favicon.ico") return new Response(null, { status: 204 });
  if (pathname === "/") return new Response(html, { headers: { "content-type": "text/html" } });
  return new Response("Not found", { status: 404 });
} });
console.log(server.url.href);
