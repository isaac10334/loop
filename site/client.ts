/** Progressive docs interactions. Search data stays local; Markdown content is never evaluated. */
import { mountMechanism } from './mechanism';
import { icon } from './icons';
import { mountDocsNavigation } from './docs-navigation';
import { mountCapabilityExplorers } from './capability-explorer-client';
import { mountPromptWizard } from './prompt-wizard';
const mechanism = document.querySelector<HTMLElement>('.mechanism');
if (mechanism) mountMechanism(mechanism);
for (const wizard of document.querySelectorAll<HTMLElement>('[data-prompt-wizard]')) mountPromptWizard(wizard);
for (const widget of document.querySelectorAll<HTMLElement>('[data-install-widget]')) {
  const tabs = [...widget.querySelectorAll<HTMLButtonElement>('[data-install-tab]')];
  const panels = [...widget.querySelectorAll<HTMLElement>('[data-install-panel]')];
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const active = tab.dataset.installTab;
      for (const item of tabs) item.setAttribute('aria-selected', String(item.dataset.installTab === active));
      for (const panel of panels) panel.hidden = panel.dataset.installPanel !== active;
    });
  }
  for (const copyButton of widget.querySelectorAll<HTMLButtonElement>('[data-copy-text]')) {
    copyButton.addEventListener('click', async () => {
      const text = copyButton.dataset.copyText ?? '';
      try {
        await navigator.clipboard.writeText(text);
        copyButton.textContent = 'Copied';
        setTimeout(() => { copyButton.textContent = 'Copy'; }, 1600);
      } catch {
        copyButton.textContent = 'Select';
      }
    });
  }
}
if ('IntersectionObserver' in window) {
  const logo = document.querySelector('.loop-mark');
  if (logo) {
    let logoVisible = true;
    const sync = () => document.body.classList.toggle('motion-suspended', document.hidden || !logoVisible);
    new IntersectionObserver(entries => { logoVisible = entries[0]?.isIntersecting ?? false; sync(); }).observe(logo);
    document.addEventListener('visibilitychange', sync);
  }
}
interface SearchEntry { title: string; group: string; href: string; text: string }
const themeButton = document.querySelector<HTMLButtonElement>(".theme-toggle");
const setTheme = (dark: boolean) => {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  themeButton?.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  if (themeButton && !themeButton.classList.contains("orbital-toggle")) themeButton.innerHTML = icon(dark ? 'sun' : 'moon');
  document.querySelector<HTMLIFrameElement>('.app-window iframe')?.contentWindow?.postMessage({ type: 'loop-site-theme', dark }, location.origin);
};
let savedTheme: string | null = null;
try { savedTheme = localStorage.getItem("loop-docs-theme"); } catch { /* Storage may be unavailable; keep the system preference. */ }
setTheme(savedTheme !== 'light');
let themeTransition: ViewTransition | undefined;
themeButton?.addEventListener("click", event => {
  const dark = document.documentElement.dataset.theme !== "dark";
  const update = () => setTheme(dark);
  themeTransition?.skipTransition();
  if (document.body.classList.contains('landing') && document.startViewTransition && event.detail > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const bounds = themeButton.getBoundingClientRect();
    document.documentElement.style.setProperty('--theme-x', `${bounds.x + bounds.width / 2}px`);
    document.documentElement.style.setProperty('--theme-y', `${bounds.y + bounds.height / 2}px`);
    themeTransition = document.startViewTransition(update);
  } else update();
  try { localStorage.setItem("loop-docs-theme", dark ? "dark" : "light"); } catch { /* A theme remains usable without persistent storage. */ }
});
const demoFrame = document.querySelector<HTMLIFrameElement>('.app-window iframe');
demoFrame?.addEventListener('load', () => setTheme(document.documentElement.dataset.theme === 'dark'));
if (document.body.classList.contains('landing') && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const reveals = document.querySelectorAll<HTMLElement>('.reveal');
  const observer = new IntersectionObserver(changes => {
    for (const change of changes) if (change.isIntersecting) {
      change.target.classList.add('is-visible'); observer.unobserve(change.target);
    }
  }, { threshold: 0.08 });
  for (const reveal of reveals) observer.observe(reveal);
  document.body.classList.add('motion-ready');
}
const menu = document.querySelector<HTMLButtonElement>(".menu-toggle");
const sidebar = document.querySelector<HTMLElement>(".sidebar");
menu?.addEventListener("click", () => { const open = sidebar?.classList.toggle("open") ?? false; menu.setAttribute("aria-expanded", String(open)); });
document.addEventListener("keydown", event => { if (event.key === "Escape") { sidebar?.classList.remove("open"); menu?.setAttribute("aria-expanded", "false"); const search = document.querySelector<HTMLDialogElement>(".search-dialog"); if (search?.open) { event.preventDefault(); search.close(); } } });

document.addEventListener('click', async event => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.copy-code') : null;
  if (!button) return;
  const code = button.closest('.code-block')?.querySelector('code')?.textContent;
  if (code === undefined || code === null) return;
  try { await navigator.clipboard.writeText(code); button.textContent = 'Copied'; button.setAttribute('aria-label', 'Code copied'); }
  catch { button.textContent = 'Select code to copy'; }
});

const dialog = document.querySelector<HTMLDialogElement>(".search-dialog");
const input = dialog?.querySelector<HTMLInputElement>("input");
const results = dialog?.querySelector<HTMLElement>(".search-results");
const root = new URL(document.body.dataset.docsRoot ?? './', location.href).href;
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
let tocObserver: IntersectionObserver | undefined;
function mountDocumentContent() {
  tocObserver?.disconnect();
  const toc = [...document.querySelectorAll<HTMLAnchorElement>('.toc a')];
  if ('IntersectionObserver' in window && toc.length) {
    tocObserver = new IntersectionObserver(changes => {
      for (const change of changes) if (change.isIntersecting) toc.forEach(link => link.classList.toggle('current', link.hash === '#' + change.target.id));
    }, { rootMargin: '-90px 0px -65% 0px' });
    for (const link of toc) { const element = document.getElementById(link.hash.slice(1)); if (element) tocObserver.observe(element); }
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('.copy-code')) {
    if (!button.querySelector('.icon')) button.insertAdjacentHTML('afterbegin', icon('copy'));
  }
  mountCapabilityExplorers();
}
mountDocumentContent();
mountDocsNavigation(mountDocumentContent);
