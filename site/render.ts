/** Safe Markdown projection. Text, code and raw HTML are escaped; links are resolved explicitly. */
import { posix } from "node:path";

export interface PageLink { id: string; sourcePath: string }
export interface Heading { id: string; title: string; level: number }
const repository = "https://github.com/isaac10334/loop/blob/main/";
export const escapeHtml = (value: string) => Bun.escapeHTML(value);
export const pageHref = (id: string) => id === "index" ? "index.html" : `${id}.html`;
export const relativeHref = (from: string, to: string) => posix.relative(posix.dirname(pageHref(from)), pageHref(to));

/** URL protocols are allowlisted before attribute escaping; local Markdown uses source-relative identity. */
export function resolveLink(href: string, from: PageLink, pages: readonly PageLink[]): string | undefined {
  if (/[\u0000-\u0020\u007f\\]/.test(href)) return undefined;
  if (href.startsWith("#")) return href;
  if (/^https?:\/\//i.test(href)) {
    try { const url = new URL(href); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
  }
  if (/^mailto:[^?]+$/i.test(href)) return href;
  if (/^[\w+.-]+:/.test(href) || href.startsWith("//") || href.startsWith("/")) return undefined;
  const hash = href.indexOf("#"), path = hash < 0 ? href : href.slice(0, hash), fragment = hash < 0 ? "" : href.slice(hash);
  const resolved = posix.normalize(posix.join(posix.dirname(from.sourcePath), path));
  if (resolved.startsWith("../")) return undefined;
  // Reproduced local evidence is not a published repository asset. Preserve its
  // label as inert text instead of manufacturing a broken GitHub link.
  if (resolved.split("/").some(part => [".artifacts", ".history", "target"].includes(part))) return undefined;
  const known = pages.find(page => page.sourcePath === resolved);
  return known ? `${relativeHref(from.id, known.id)}${fragment}` : `${repository}${resolved.split("/").map(encodeURIComponent).join("/")}${fragment}`;
}

/** Build-time-only renderer. Registry Markdown cannot execute scripts or inject renderer HTML. */
export function renderMarkdown(source: string, page: PageLink, pages: readonly PageLink[]): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const seen = new Map<string, number>();
  const text = (value: string) => escapeHtml(value);
  const html = Bun.markdown.render(source, {
    text,
    html: text,
    heading: (children, meta) => {
      const plain = children.replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|#39);/g, "");
      const base = plain.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/[\s_]+/g, "-").replace(/^-|-$/g, "") || "section";
      const count = seen.get(base) ?? 0; seen.set(base, count + 1);
      const id = count ? `${base}-${count}` : base;
      const level = meta.level;
      headings.push({ id, title: plain, level });
      return `<h${level} id="${id}">${children}<a class="heading-anchor" href="#${id}" aria-label="Link to ${text(plain)}">#</a></h${level}>`;
    },
    paragraph: children => `<p>${children}</p>`,
    strong: children => `<strong>${children}</strong>`, emphasis: children => `<em>${children}</em>`,
    strikethrough: children => `<del>${children}</del>`,
    codespan: children => `<code>${children}</code>`,
    code: (children, meta) => `<div class="code-block"><div class="code-toolbar"><span>${text(meta.language || "text")}</span><button class="copy-code" type="button" aria-label="Copy code">Copy</button></div><pre><code>${children}</code></pre></div>`,
    link: (children, meta) => {
      const target = resolveLink(meta.href, page, pages);
      return target ? `<a href="${text(target)}"${target.startsWith("http") ? ' rel="noreferrer"' : ""}>${children}</a>` : `<span class="unsafe-link">${children}</span>`;
    },
    image: (children, meta) => {
      const target = resolveLink(meta.src, page, pages);
      return target ? `<a class="image-reference" href="${text(target)}">Image: ${children || text(meta.src)}</a>` : children;
    },
    list: (children, meta) => meta.ordered ? `<ol start="${meta.start ?? 1}">${children}</ol>` : `<ul>${children}</ul>`,
    listItem: (children, meta) => `<li>${meta.checked === undefined ? "" : `<span aria-label="${meta.checked ? "Completed" : "Not completed"}">${meta.checked ? "☑" : "☐"}</span> `}${children}</li>`,
    blockquote: children => `<blockquote>${children}</blockquote>`, hr: () => "<hr>",
    table: children => `<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable table"><table>${children}</table></div>`,
    thead: children => `<thead>${children}</thead>`, tbody: children => `<tbody>${children}</tbody>`,
    tr: children => `<tr>${children}</tr>`, th: children => `<th scope="col">${children}</th>`, td: children => `<td>${children}</td>`,
  }, { tables: true, strikethrough: true, tasklists: true, autolinks: true });
  return { html, headings };
}
