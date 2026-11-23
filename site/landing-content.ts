/** Product direction is explicit here; current support always comes from the reviewed catalog. */
import { icon } from './icons';
import { renderCapabilityExplorer } from './capability-explorer';
export function renderProductStories(): string {
  return `<section class="product-stories" aria-labelledby="possibilities-title">
    <div class="section-heading reveal"><h2 id="possibilities-title">What Loop Kit is<br><span>built for.</span></h2><p>Interactive applications, tools, and services that share typed contracts and explicit host boundaries.</p></div>
    <div class="product-story-list">
      <article class="product-story reveal">${icon('gamepad')}<div><h3>Games and interactive worlds</h3><p>Build simulation, input, rendering, and editor tools as replaceable components with explicit boundaries, so you can swap or extend systems without untangling the whole engine.</p><a href="docs/roadmap.html">Read the simulation roadmap ${icon('arrow-right')}</a></div><span class="story-stage">Engine direction</span></article>
      <article class="product-story reveal">${icon('code')}<div><h3>Multiple languages, shared interfaces</h3><p>Connect components across languages using the WebAssembly Component Model. Contracts stay stable as implementations change, and each component receives only the imports its host grants.</p><a href="docs/reference/compatibility.html">See current language support ${icon('arrow-right')}</a></div><span class="story-stage">Bounded profiles today</span></article>
      <article class="product-story reveal">${icon('agent')}<div><h3>Safe boundaries for coding agents</h3><p>Typed operations, owned lifetimes, and inspectable composition give agents clean boundaries to build against. Automated repair and live component replacement are longer-term goals and are not implemented yet.</p><a href="docs/reference/workspace.html">Read source and build contracts ${icon('arrow-right')}</a></div><span class="story-stage">Foundations + future work</span></article>
    </div>
    <p class="direction-note">These are long-term directions, not claims that a full game engine, universal language bridge, or autonomous repair system ships today. The capability matrix below shows what works right now.</p>
  </section>`;
}
export function renderLandingCapabilities(): string {
  return `<section class="landing-capabilities reveal" aria-label="Host capability preview">${renderCapabilityExplorer({id:'landing-capabilities',compact:true})}<div class="capability-more"><p>Compare full support details, limits, and test evidence across all 21 capabilities.</p><a href="docs/reference/support.html">Explore all host capabilities ${icon('arrow-right')}</a></div></section>`;
}
