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
const menu = document.querySelector<HTMLButtonElement>('.menu-toggle');
const sidebar = document.querySelector<HTMLElement>('.sidebar');
const backdrop = document.querySelector<HTMLElement>('.sidebar-backdrop');
const landingMenu = document.querySelector<HTMLButtonElement>('.landing-menu-toggle');
const landingNav = document.querySelector<HTMLElement>('.landing-mobile-nav');
function closeMenus() {
  sidebar?.classList.remove('open'); menu?.setAttribute('aria-expanded', 'false');
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove('sidebar-open');
  if (landingNav) landingNav.hidden = true;
  landingMenu?.setAttribute('aria-expanded', 'false');
}
menu?.addEventListener('click', () => {
  const open = !sidebar?.classList.contains('open'); closeMenus();
  sidebar?.classList.toggle('open', open); menu.setAttribute('aria-expanded', String(open));
  if (backdrop) backdrop.hidden = !open;
  document.body.classList.toggle('sidebar-open', open);
});
landingMenu?.addEventListener('click', () => {
  const open = !!landingNav?.hidden; closeMenus();
  if (landingNav) landingNav.hidden = !open;
  landingMenu.setAttribute('aria-expanded', String(open));
});
backdrop?.addEventListener('click', closeMenus);
document.addEventListener('click', event => {
  const target = event.target as Node;
  if (target instanceof Element && target.closest('.sidebar a, .landing-mobile-nav a')) closeMenus();
  else if (landingNav && !landingNav.hidden && !landingNav.contains(target) && !landingMenu?.contains(target)) closeMenus();
});
addEventListener('resize', () => { if (innerWidth > 760) closeMenus(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeMenus(); const search = document.querySelector<HTMLDialogElement>('.search-dialog'); if (search?.open) { event.preventDefault(); search.close(); } } });

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
let disposeToc: (() => void) | undefined;
function mountToc(): () => void {
  const wrap = document.querySelector<HTMLElement>('.toc-rail-wrap');
  const svg = wrap?.querySelector<SVGSVGElement>('.toc-rail');
  const track = svg?.querySelector<SVGPathElement>('.toc-rail-track');
  const fill = svg?.querySelector<SVGPathElement>('.toc-rail-fill');
  const thumb = svg?.querySelector<SVGPathElement>('.toc-rail-thumb');
  const topButton = document.querySelector<HTMLButtonElement>('.toc-top');
  const rows = [...(wrap?.querySelectorAll<HTMLElement>('[data-toc-row]') ?? [])];
  const links = rows.map(row => row.querySelector<HTMLAnchorElement>('a')!);
  const headings = links.map(link => { try { return document.getElementById(decodeURIComponent(link.hash.slice(1))); } catch { return null; } });
  if (!wrap || !svg || !track || !fill || !thumb || !rows.length) return () => {};
  const controller = new AbortController(), signal = controller.signal;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const JOG = 6;
  let starts: number[] = [], ends: number[] = [], total = 0, active = -1, locked = -1, timer = 0, frame = 0, last = 0;
  let position = 0, length = 4, velocity = 0, lengthVelocity = 0, targetPosition = 0, targetLength = 4;
  function draw() { thumb!.style.strokeDasharray = `${Math.max(0, length)} ${total + 1}`; thumb!.style.strokeDashoffset = String(-position); }
  function animate(time: number) {
    frame = 0; const dt = Math.min((time - (last || time)) / 1000, .032); last = time;
    velocity += (520 * (targetPosition - position) - 38 * velocity) / .7 * dt;
    lengthVelocity += (520 * (targetLength - length) - 38 * lengthVelocity) / .7 * dt;
    position += velocity * dt; length += lengthVelocity * dt; draw();
    if (Math.abs(targetPosition-position) + Math.abs(targetLength-length) + Math.abs(velocity) + Math.abs(lengthVelocity) > .05) frame = requestAnimationFrame(animate);
    else { position = targetPosition; length = targetLength; last = 0; draw(); }
  }
  function measure() {
    starts = []; ends = []; let d = '', distance = 0, previousX = 0, previousBottom = 0;
    rows.forEach((row, i) => {
      const y = row.offsetTop, h = row.offsetHeight, x = Number(row.dataset.depth || 0) * 10 + .5;
      if (!i) d = `M ${x} ${y}`;
      else {
        distance += Math.max(0, y-previousBottom);
        if (previousX !== x) {
          d += ` L ${previousX} ${y} L${x} ${y + JOG}`;
          distance += Math.hypot(x-previousX, JOG);
          starts.push(distance);
          distance += Math.max(0, h-JOG);
          d += ` L${x} ${y+h}`;
          ends.push(distance); previousX=x; previousBottom=y+h;
          return;
        }
        d += ` L ${x} ${y}`;
      }
      starts.push(distance); distance += h; d += ` L ${x} ${y+h}`; ends.push(distance); previousX=x; previousBottom=y+h;
    });
    total = distance; svg!.setAttribute('height', String(previousBottom));
    for (const path of [track!, fill!, thumb!]) path.setAttribute('d', d);
    update();
  }
  function update() {
    const max = document.documentElement.scrollHeight-innerHeight;
    let index = 0;
    headings.forEach((heading, i) => { if (heading && heading.getBoundingClientRect().top <= 105) index=i; });
    if (max > 0 && scrollY >= max-2) headings.forEach((heading,i) => { if (heading && heading.getBoundingClientRect().top < innerHeight) index=i; });
    if (locked >= 0) index=locked;
    if (index !== active) {
      active=index; rows.forEach((row,i) => { row.toggleAttribute('data-active', i===index); if (i===index) row.dataset.active='true'; links[i].classList.toggle('current',i===index); if (i===index) links[i].setAttribute('aria-current','location'); else links[i].removeAttribute('aria-current'); });
      const box = document.querySelector<HTMLElement>('.toc');
      if (box && box.scrollHeight > box.clientHeight) { const r=rows[index].getBoundingClientRect(), b=box.getBoundingClientRect(); if (r.top < b.top) box.scrollTop -= b.top-r.top; else if (r.bottom > b.bottom) box.scrollTop += r.bottom-b.bottom; }
    }
    const current = headings[index], next = headings[index+1];
    const start = current ? current.getBoundingClientRect().top + scrollY : 0;
    const end = next ? next.getBoundingClientRect().top + scrollY : document.documentElement.scrollHeight;
    const fraction = Math.max(0, Math.min(1, (scrollY+104-start)/Math.max(1,end-start)));
    const progress = (starts[index] ?? 0) + ((ends[index] ?? 0)-(starts[index] ?? 0))*fraction;
    fill!.style.strokeDasharray = `${progress} ${total+1}`;
    targetPosition=(starts[index] ?? 0)+3; targetLength=Math.max(4,(ends[index] ?? 0)-(starts[index] ?? 0)-6);
    if (motion.matches) { position=targetPosition; length=targetLength; draw(); } else if (!frame) { last=0; frame=requestAnimationFrame(animate); }
    if (topButton) { topButton.hidden=false; topButton.classList.toggle('visible',scrollY>innerHeight*.8); }
  }
  function unlock() { locked=-1; clearTimeout(timer); update(); }
  links.forEach((link,i) => link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !headings[i]) return;
    event.preventDefault(); locked=i; update(); history.replaceState(history.state,'',link.hash);
    const heading=headings[i]!; heading.tabIndex=-1; heading.focus({preventScroll:true});
    scrollTo({top:Math.max(0,heading.getBoundingClientRect().top+scrollY-104),behavior:motion.matches?'instant':'smooth'});
    clearTimeout(timer); timer=window.setTimeout(unlock,1200);
  }, {signal}));
  topButton?.addEventListener('click', () => scrollTo({top:0,behavior:motion.matches?'instant':'smooth'}), {signal});
  addEventListener('scroll', update, {passive:true,signal}); addEventListener('resize', measure, {signal});
  addEventListener('wheel', unlock, {passive:true,signal}); addEventListener('touchstart', unlock, {passive:true,signal}); addEventListener('scrollend', unlock, {signal});
  const observer = 'ResizeObserver' in window ? new ResizeObserver(measure) : undefined;
  rows.forEach(row => observer?.observe(row)); measure();
  return () => { controller.abort(); observer?.disconnect(); cancelAnimationFrame(frame); clearTimeout(timer); };
}
function mountDocumentContent() {
  disposeToc?.(); disposeToc = mountToc();
  for (const button of document.querySelectorAll<HTMLButtonElement>('.copy-code')) {
    if (!button.querySelector('.icon')) button.insertAdjacentHTML('afterbegin', icon('copy'));
  }
  mountCapabilityExplorers();
}
mountDocumentContent();
mountDocsNavigation(mountDocumentContent);
