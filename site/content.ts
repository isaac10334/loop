/// <reference path="./markdown.d.ts" />
/** Explicit PUBLIC publication allowlist. Never discover repository Markdown recursively. */
import overview from '../docs/public/overview.md' with { type: 'text' };
import installation from '../docs/public/installation.md' with { type: 'text' };
import quickstart from '../docs/public/quickstart.md' with { type: 'text' };
import concepts from '../docs/public/concepts.md' with { type: 'text' };
import nativeGuide from '../docs/public/native.md' with { type: 'text' };
import providers from '../docs/public/providers.md' with { type: 'text' };
import composition from '../docs/public/composition.md' with { type: 'text' };
import examples from '../docs/public/examples.md' with { type: 'text' };
import cli from '../docs/public/cli.md' with { type: 'text' };
import compatibility from '../docs/public/compatibility.md' with { type: 'text' };
import roadmap from '../docs/public/roadmap.md' with { type: 'text' };
import capabilities from '../packages/capabilities/README.md' with { type: 'text' };
import host from '../packages/host/README.md' with { type: 'text' };
import ui from '../packages/ui/README.md' with { type: 'text' };
import scripting from '../packages/scripting/README.md' with { type: 'text' };
import workspace from '../packages/workspace/README.md' with { type: 'text' };
import hostBrowser from '../packages/host-browser/README.md' with { type: 'text' };
import hostNative from '../packages/host-native/README.md' with { type: 'text' };
import rendererDom from '../packages/renderer-dom/README.md' with { type: 'text' };
import componentPolyengine from '../packages/component-polyengine/README.md' with { type: 'text' };
import { supportMarkdown } from './support';
import supportIntro from '../docs/public/support.md' with { type: 'text' };

export type PageGroup = 'Get started' | 'Guides' | 'Reference' | 'Advanced APIs';
export interface DocPage {
  id: string; title: string; group: PageGroup; sourcePath: string; markdown: string;
  status: 'current' | 'reference' | 'proposal'; package?: string; notice?: string;
}
const guide = (id: string, title: string, group: PageGroup, file: string, markdown: string): DocPage => ({ id, title, group, sourcePath: `docs/public/${file}.md`, markdown, status: 'current' });
const api = (name: string, title: string, markdown: string): DocPage => ({ id: `reference/${name}`, title, group: 'Advanced APIs', sourcePath: `packages/${name}/README.md`, markdown, status: 'reference', package: name });
/** Every HTML page, search item, sitemap entry and agent export comes from this list. */
export const pages: readonly DocPage[] = [
  guide('index', 'Overview', 'Get started', 'overview', overview),
  guide('installation', 'Installation', 'Get started', 'installation', installation),
  guide('quickstart', 'Browser quick start', 'Get started', 'quickstart', quickstart),
  guide('concepts', 'Concepts', 'Get started', 'concepts', concepts),
  guide('guides/providers', 'Capabilities and providers', 'Guides', 'providers', providers),
  guide('guides/composition', 'Composition and host kits', 'Guides', 'composition', composition),
  guide('examples', 'Runnable examples', 'Guides', 'examples', examples),
  guide('guides/native', 'Rust and native applications', 'Guides', 'native', nativeGuide),
  guide('reference/cli', 'CLI and configuration', 'Reference', 'cli', cli),
  guide('reference/compatibility', 'Languages and compatibility', 'Reference', 'compatibility', compatibility),
  guide('reference/support', 'Capability support', 'Reference', 'support', supportIntro + '\n' + supportMarkdown()),
  guide('roadmap', 'Roadmap and limits', 'Reference', 'roadmap', roadmap),
  api('capabilities', 'Capability definitions', capabilities),
  api('host', 'Resource host', host), api('ui', 'Semantic UI', ui),
  api('host-browser', 'Browser host kit', hostBrowser), api('host-native', 'Native host kit', hostNative),
  api('renderer-dom', 'DOM renderer', rendererDom), api('component-polyengine', 'Component worker adapter', componentPolyengine),
  api('scripting', 'Authored execution', scripting), api('workspace', 'Source/build contracts', workspace),
];
