import { expect, test } from "bun:test";
import { renderMarkdown, resolveLink } from "./render";
const page = { id: "guides/example", sourcePath: "docs/example.md" };
const pages = [page, { id: "reference/host", sourcePath: "packages/host/README.md" }];
test("Markdown renders raw HTML and code as inert text", () => {
  const result = renderMarkdown('# Safe\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n```ts\nconst value = "<script>";\n```', page, pages);
  expect(result.html).not.toContain("<script>"); expect(result.html).not.toContain("<img");
  expect(result.html).toContain("&lt;script&gt;"); expect(result.html).toContain("const value");
});
test("URL protocols reject executable and opaque links without mounting remote images", () => {
  for (const href of ["javascript:alert(1)", "data:text/html,x", "file:///C:/secret", "//evil.invalid/a", "https://user:secret@example.com", "java\nscript:alert(1)", "https:\\evil.invalid"]) expect(resolveLink(href, page, pages)).toBeUndefined();
  const result = renderMarkdown('[bad](javascript:alert%281%29)\n\n![picture](https://example.com/picture.png)', page, pages);
  expect(result.html).not.toContain('href="javascript:'); expect(result.html).not.toContain("<img"); expect(result.html).toContain("Image: picture");
});
test("relative repository links target local built pages and retain fragments", () => {
  expect(resolveLink("../packages/host/README.md#resources", page, pages)).toBe("../reference/host.html#resources");
  expect(resolveLink("../contracts/tool.wit", page, pages)).toBe("https://github.com/isaac10334/loop/blob/main/contracts/tool.wit");
  expect(resolveLink("../../outside", page, pages)).toBeUndefined();
});
test("generated local evidence labels do not manufacture unpublished repository URLs", () => {
  const example = { id: "guides/custom-provider", sourcePath: "examples/host-kits/custom-provider/README.md" };
  expect(resolveLink(".artifacts/browser-receipt.json", example, pages)).toBeUndefined();
  expect(resolveLink("../target/receipt.json", page, pages)).toBeUndefined();
  const rendered = renderMarkdown("[local receipt](.artifacts/browser-receipt.json)", example, pages);
  expect(rendered.html).toContain("local receipt");
  expect(rendered.html).not.toContain("github.com");
});
test("duplicate headings have stable unique anchors and tables remain semantic", () => {
  const result = renderMarkdown('# Title\n\n## Resources\n\n## Resources\n\n| Item | State |\n|---|---|\n| Clock | Ready |', page, pages);
  expect(result.headings.map(heading => heading.id)).toEqual(["title", "resources", "resources-1"]);
  expect(result.html).toContain('<th scope="col">Item</th>'); expect(result.html).toContain('aria-label="Scrollable table"');
});
