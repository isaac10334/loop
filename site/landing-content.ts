/** Product direction is explicit here; current support always comes from the reviewed catalog. */
import { icon } from './icons';
import { renderCapabilityExplorer } from './capability-explorer';
export function renderProductStories(): string {
  return `<section class="product-stories" aria-labelledby="possibilities-title">
    <div class="section-heading reveal"><h2 id="possibilities-title">One foundation.<br><span>More than one kind of software.</span></h2><p>The ambition is an engine for interactive, evolving applications—not just services behind an API.</p></div>
    <div class="product-story-list">
      <article class="product-story reveal">${icon('gamepad')}<div><h3>Worlds you can keep building.</h3><p>A game engine direction built around replaceable components: simulation, input, rendering, and tools with explicit boundaries. Grow a world without welding every system together.</p><a href="docs/roadmap.html">Explore the simulation direction ${icon('arrow-right')}</a></div><span class="story-stage">Engine direction</span></article>
      <article class="product-story reveal">${icon('code')}<div><h3>Different languages. Shared interfaces.</h3><p>Use the Component Model to connect code across language boundaries. Keep the contract stable as implementations change, with imports chosen by the host—not ambient access.</p><a href="docs/reference/compatibility.html">See current language support ${icon('arrow-right')}</a></div><span class="story-stage">Bounded profiles today</span></article>
      <article class="product-story reveal">${icon('agent')}<div><h3>Give agents building blocks, not the keys.</h3><p>Typed operations, owned lifetimes, and inspectable composition form a foundation for agent-built software. Self-evolving and self-healing programs are the longer-term goal; automated repair and replacement remain future work.</p><a href="docs/reference/workspace.html">Explore source and build contracts ${icon('arrow-right')}</a></div><span class="story-stage">Foundations + future work</span></article>
    </div>
    <p class="direction-note">These are product directions, not a claim that a complete game engine, universal language bridge, or autonomous repair system ships today. The explorer below shows the implementation boundary.</p>
  </section>`;
}
export function renderLandingCapabilities(): string {
  return `<section class="landing-capabilities reveal" aria-label="Host capability preview">${renderCapabilityExplorer({id:'landing-capabilities',compact:true})}<div class="capability-more"><p>One composition model. Different hosts, explicit limits.</p><a href="docs/reference/support.html">Explore all host capabilities ${icon('arrow-right')}</a></div></section>`;
}
