/** Progressive navigation within the generated docs allowlist. Static links remain the fallback.
 * The document/header/sidebar survive; page-scoped enhancements remount through onNavigate.
 * Parsed HTML is trusted same-origin build output, never a general content/HTML loading API.
 */
export function mountDocsNavigation(onNavigate: () => void): void {
  const layout = document.querySelector<HTMLElement>('.docs-layout');
  const sidebar = layout?.querySelector<HTMLElement>('.sidebar');
  let main = layout?.querySelector<HTMLElement>('main.content#main');
  let toc = layout?.querySelector<HTMLElement>('aside.toc');
  if (!layout || !sidebar || !main || !toc) return;
  const docsRoot = new URL(document.body.dataset.docsRoot ?? './', location.href);
  document.body.dataset.docsRoot = docsRoot.href;
  const allowed = new Set([...sidebar.querySelectorAll<HTMLAnchorElement>('a[href]')].map(a => new URL(a.href).pathname));
  const build = main.querySelector('.build-info')?.textContent;
  const chrome = document.querySelector<HTMLElement>('.topbar');
  const normalize = (node: ParentNode, base: URL) => {
    for (const element of node.querySelectorAll('[href],[src],[poster]')) for (const attr of ['href','src','poster']) {
      const value = element.getAttribute(attr);
      if (value && !value.startsWith('#')) element.setAttribute(attr, new URL(value, base).href);
    }
  };
  if (chrome) normalize(chrome, new URL(location.href));
  // Head resources also persist across depth changes (notably ../favicon.svg).
  normalize(document.head, new URL(location.href));
  let activeUrl = new URL(location.href), serial = 0, pending: AbortController | undefined;
  const scrolls = new Map<string, { x: number; y: number }>();
  const cache = new Map<string,string>();
  const prefetches = new Map<string,Promise<string | undefined>>();
  history.scrollRestoration = 'manual';
  function rememberScroll() {
    scrolls.set(activeUrl.href, { x: scrollX, y: scrollY });
    if (scrolls.size > 100) scrolls.delete(scrolls.keys().next().value!);
  }
  addEventListener('scroll', rememberScroll, { passive: true });
  const status = document.getElementById('navigation-status');
  function cancel() {
    serial++; pending?.abort(); pending = undefined;
    main!.removeAttribute('aria-busy'); document.body.classList.remove('docs-loading');
  }
  const eligible = (url: URL) => url.origin === location.origin && allowed.has(url.pathname) && !url.search && url.pathname.endsWith('.html');
  const pageKey = (url: URL) => url.origin + url.pathname;
  function cachePage(key: string, html: string) {
    cache.delete(key); cache.set(key,html);
    if (cache.size > 8) cache.delete(cache.keys().next().value!);
  }
  async function fetchPage(url: URL, signal?: AbortSignal): Promise<string> {
    const key = pageKey(url);
    if (cache.has(key)) return cache.get(key)!;
    const response = await fetch(key, { signal, headers: { Accept: 'text/html' } });
    if (!response.ok || !/^text\/html\b/i.test(response.headers.get('content-type') ?? '') || new URL(response.url).pathname !== url.pathname || new URL(response.url).origin !== location.origin) throw Error('Unexpected docs response');
    const html = await response.text();
    if (html.length > 3_000_000) throw Error('Docs page exceeds navigation budget');
    cachePage(key,html); return html;
  }
  function prefetch(event: Event) {
    if ('connection' in navigator && (navigator as Navigator & {connection?: {saveData?: boolean}}).connection?.saveData) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href), key = pageKey(url);
    if (!eligible(url) || key === pageKey(activeUrl) || cache.has(key) || prefetches.has(key) || prefetches.size >= 2) return;
    const request = fetchPage(url).catch(() => undefined).finally(() => prefetches.delete(key));
    prefetches.set(key,request);
  }
  document.addEventListener('pointerover', prefetch, { passive: true });
  document.addEventListener('focusin', prefetch);
  const fragmentTarget = (hash: string) => { try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return null; } };
  async function navigate(url: URL, push: boolean, pop = false) {
    rememberScroll(); cancel(); const ticket = ++serial;
    const controller = new AbortController(); pending = controller;
    main!.setAttribute('aria-busy','true'); document.body.classList.add('docs-loading');
    if (status) status.textContent = 'Loading documentation';
    try {
      const prefetched = prefetches.get(pageKey(url));
      // A prefetch may fail; the navigation's own fetch still has an ordinary-link fallback.
      const html = (prefetched ? await prefetched : undefined) ?? await fetchPage(url,controller.signal);
      if (ticket !== serial || controller.signal.aborted) return;
      const parsed = new DOMParser().parseFromString(html,'text/html');
      const nextMain=parsed.querySelector<HTMLElement>('main.content#main'), nextToc=parsed.querySelector<HTMLElement>('.docs-layout>.toc'), nextSidebar=parsed.querySelector<HTMLElement>('.docs-layout>.sidebar');
      if (!nextMain || !nextToc || !nextSidebar || parsed.querySelector('.build-info')?.textContent !== build || !parsed.body.classList.contains('documentation')) throw Error('Incompatible docs build');
      parsed.querySelectorAll('script').forEach(script => script.remove());
      normalize(nextMain,url); normalize(nextToc,url); normalize(nextSidebar,url);
      const sideScroll = sidebar!.scrollTop;
      main!.replaceWith(nextMain); toc!.replaceWith(nextToc); main=nextMain; toc=nextToc;
      sidebar!.replaceChildren(...nextSidebar.childNodes); sidebar!.scrollTop=sideScroll;
      document.title=parsed.title;
      const description=parsed.querySelector<HTMLMetaElement>('meta[name=description]');
      const currentDescription=document.querySelector<HTMLMetaElement>('meta[name=description]');
      if (description && currentDescription) currentDescription.content=description.content;
      document.body.dataset.docPage=parsed.body.dataset.docPage;
      if (push) history.pushState(null,'',url.href);
      activeUrl=new URL(url.href);
      document.querySelector<HTMLDialogElement>('.search-dialog')?.close();
      sidebar!.classList.remove('open'); document.querySelector('.menu-toggle')?.setAttribute('aria-expanded','false');
      onNavigate(); pending=undefined; main.removeAttribute('aria-busy'); document.body.classList.remove('docs-loading');
      if (status) status.textContent=`${parsed.title.replace(' · Loop Kit','')} loaded`;
      const saved=pop?scrolls.get(url.href):undefined, target=url.hash?fragmentTarget(url.hash):null;
      if (saved) scrollTo(saved.x,saved.y); else if (target) target.scrollIntoView(); else scrollTo(0,0);
      const focus=target ?? main.querySelector<HTMLElement>('h1') ?? main;
      focus.tabIndex=-1; focus.focus({preventScroll:true});
    } catch {
      if (ticket !== serial || controller.signal.aborted) return;
      cancel();
      if (push) location.assign(url.href); else location.replace(url.href);
    }
  }
  document.addEventListener('click', event => {
    const link=event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link || event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    const url=new URL(link.href);
    if (pageKey(url)===pageKey(activeUrl) && url.search===activeUrl.search && url.hash) { cancel(); return; }
    if (!eligible(url)) return;
    event.preventDefault(); void navigate(url,true);
  });
  addEventListener('popstate',()=>{
    const url=new URL(location.href);
    if (pageKey(url)===pageKey(activeUrl)) {
      rememberScroll(); cancel(); activeUrl=url;
      const target=url.hash?fragmentTarget(url.hash):null, point=scrolls.get(url.href);
      if (point) scrollTo(point.x,point.y); else if (target) target.scrollIntoView(); else scrollTo(0,0);
    } else if (eligible(url)) void navigate(url,false,true);
    else location.reload();
  });
  addEventListener('hashchange',()=>{
    if (pageKey(new URL(location.href))!==pageKey(activeUrl)) return;
    rememberScroll(); cancel(); activeUrl=new URL(location.href);
  });
}
