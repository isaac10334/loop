/** Progressive docs interactions. Search data stays local; Markdown content is never evaluated. */
interface SearchEntry { title: string; group: string; href: string; text: string }
const themeButton = document.querySelector<HTMLButtonElement>(".theme-toggle");
const setTheme = (dark: boolean) => {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  themeButton?.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  if (themeButton) themeButton.textContent = dark ? "☼" : "☾";
};
let savedTheme: string | null = null;
try { savedTheme = localStorage.getItem("loop-docs-theme"); } catch { /* Storage may be unavailable; keep the system preference. */ }
setTheme(savedTheme ? savedTheme === "dark" : matchMedia("(prefers-color-scheme:dark)").matches);
themeButton?.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  setTheme(dark);
  try { localStorage.setItem("loop-docs-theme", dark ? "dark" : "light"); } catch { /* A theme remains usable without persistent storage. */ }
});
const menu = document.querySelector<HTMLButtonElement>(".menu-toggle");
const sidebar = document.querySelector<HTMLElement>(".sidebar");
menu?.addEventListener("click", () => { const open = sidebar?.classList.toggle("open") ?? false; menu.setAttribute("aria-expanded", String(open)); });
document.addEventListener("keydown", event => { if (event.key === "Escape") { sidebar?.classList.remove("open"); menu?.setAttribute("aria-expanded", "false"); const search = document.querySelector<HTMLDialogElement>(".search-dialog"); if (search?.open) { event.preventDefault(); search.close(); } } });

for (const button of document.querySelectorAll<HTMLButtonElement>(".copy-code")) button.addEventListener("click", async () => {
  const code = button.closest(".code-block")?.querySelector("code")?.textContent;
  if (code === undefined || code === null) return;
  try { await navigator.clipboard.writeText(code); button.textContent = "Copied"; button.setAttribute("aria-label", "Code copied"); }
  catch { button.textContent = "Select code to copy"; }
});

const dialog = document.querySelector<HTMLDialogElement>(".search-dialog");
const input = dialog?.querySelector<HTMLInputElement>("input");
const results = dialog?.querySelector<HTMLElement>(".search-results");
const root = document.body.dataset.docsRoot ?? "./";
let entries: SearchEntry[] | undefined;
let failed = false;
function showResults() {
  if (!results || !input) return;
  results.replaceChildren();
  if (failed) { const message = document.createElement("p"); message.className = "search-empty"; message.textContent = "Search could not load. Browse the documentation navigation instead."; results.append(message); return; }
  if (!entries) return;
  const query = input.value.trim().toLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  const matches = entries.map(entry => ({ entry, score: words.reduce((score, word) => score + (entry.title.toLowerCase().includes(word) ? 5 : entry.text.includes(word) ? 1 : -100), 0) }))
    .filter(item => item.score >= 0).sort((a, b) => b.score - a.score).slice(0, 10);
  if (!matches.length) { const message = document.createElement("p"); message.className = "search-empty"; message.textContent = "No matching pages. Try a contract, package or guide name."; results.append(message); }
  for (const { entry } of matches) {
    const link = document.createElement("a"); link.href = root + entry.href;
    const title = document.createElement("strong"); title.textContent = entry.title;
    const group = document.createElement("span"); group.textContent = entry.group;
    link.append(title, group); results.append(link);
  }
}
async function openSearch() {
  if (!dialog || !input) return;
  dialog.showModal(); input.focus();
  if (!entries && !failed) {
    try { const response = await fetch(root + "search-index.json"); if (!response.ok) throw Error("Search unavailable"); entries = await response.json() as SearchEntry[]; }
    catch { failed = true; }
  }
  showResults();
}
document.querySelector(".search-trigger")?.addEventListener("click", () => { void openSearch(); });
dialog?.querySelector(".search-close")?.addEventListener("click", () => dialog.close());
input?.addEventListener("input", showResults);
dialog?.addEventListener("click", event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
document.addEventListener("keydown", event => {
  const target = event.target;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLElement && target.isContentEditable)) { event.preventDefault(); void openSearch(); }
});
const toc = [...document.querySelectorAll<HTMLAnchorElement>(".toc a")];
if ("IntersectionObserver" in window && toc.length) {
  const observer = new IntersectionObserver(changes => {
    for (const change of changes) if (change.isIntersecting) {
      toc.forEach(link => link.classList.toggle("current", link.hash === "#" + change.target.id));
    }
  }, { rootMargin: "-90px 0px -65% 0px" });
  for (const link of toc) { const element = document.getElementById(link.hash.slice(1)); if (element) observer.observe(element); }
}
