/** Pure static + client-side prompt generator for agentic Loop Kit onboarding. */

export type AgentHarness = 'dsh' | 'codex' | 'claude' | 'generic';
export type LoopTarget = 'browser' | 'native' | 'headless';

export interface PromptWizardOptions {
  harness: AgentHarness;
  target: LoopTarget;
  goal: string;
}

const HARNESS_INFO: Record<AgentHarness, { label: string; skillStep: string }> = {
  dsh: {
    label: 'DeepSeek Harness',
    skillStep: 'Run `loop skills list` and install the bundled skills into `.agents/skills/` (`loop skills install --target agents`) so DSH loads them automatically.'
  },
  codex: {
    label: 'OpenAI Codex',
    skillStep: 'Run `loop skills list` and install the bundled skills for Codex (`loop skills install --target codex`), then read the installed Loop Kit skill before editing.'
  },
  claude: {
    label: 'Claude Code',
    skillStep: 'Run `loop skills list` and install the bundled skills for Claude Code (`loop skills install --target claude`), then follow the installed skill instructions.'
  },
  generic: {
    label: 'Any coding agent',
    skillStep: 'Run `loop skills list` and `loop skills inspect <name>` to read the bundled Loop Kit guidance before scaffolding.'
  }
};

const TARGET_INFO: Record<LoopTarget, { label: string; kit: string; runHint: string; prereqs: string }> = {
  browser: {
    label: 'Browser (TypeScript)',
    kit: 'browser',
    runHint: 'Run the local browser host and verify interactive state updates, stop/disposal cleanup, and fresh restart.',
    prereqs: 'Bun + a local browser. Note: `@loop-kit/*` npm publication is pending, so use reviewed packed packages from a source checkout if needed.'
  },
  native: {
    label: 'Desktop (Rust / WASM)',
    kit: 'native',
    runHint: 'Compile the guest component to `wasm32-wasip2`, run the native desktop host, and verify window launch, resource cleanup, and clean exit.',
    prereqs: 'Rust toolchain with `wasm32-wasip2`, MSVC Build Tools, Windows SDK, and WebView2 on Windows.'
  },
  headless: {
    label: 'Headless service (TypeScript)',
    kit: 'headless',
    runHint: 'Run `loop run . --config loop.config.ts --target service --instance local --trust-local-config` and verify lifecycle start, health/state, and explicit stop/disposal.',
    prereqs: 'Bun. Use reviewed packed `@loop-kit/*` packages from a source checkout until npm publication completes.'
  }
};

export function toProjectSlug(goal: string): string {
  const cleaned = goal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28)
    .replace(/-+$/g, '');
  return cleaned || 'my-loop-app';
}

export function buildAgentPrompt(options: PromptWizardOptions): string {
  const harness = HARNESS_INFO[options.harness] ?? HARNESS_INFO.dsh;
  const target = TARGET_INFO[options.target] ?? TARGET_INFO.browser;
  const trimmedGoal = options.goal.trim() || 'a small interactive application with typed provider state';
  const slug = toProjectSlug(trimmedGoal);

  return [
    `Build ${trimmedGoal} using Loop Kit (${target.label} target, via ${harness.label}).`,
    '',
    '1. Verify the Loop CLI:',
    '   - Check `loop --help` for the `create --kit` and `skills` subcommands.',
    '   - If `loop` is missing or only the older v0.1.0 release is installed, build `loop-dev` from source (`git clone https://github.com/isaac10334/loop && cd loop && .\\scripts\\install-dev.ps1`) and use `loop-dev` for the steps below.',
    `   - Prerequisites: ${target.prereqs}`,
    '',
    '2. Load Loop Kit skills and docs:',
    `   - ${harness.skillStep}`,
    '   - Check https://isaac10334.github.io/loop/llms.txt and https://isaac10334.github.io/loop/docs/reference/support.html before assuming any host capability is implemented.',
    '',
    '3. Scaffold the project:',
    `   - Run \`loop create ${slug} --kit ${target.kit} --yes\` and inspect the generated \`loop.config.ts\` and host entrypoints.`,
    '',
    '4. Follow Loop Kit conventions while implementing:',
    '   - Define capabilities as typed contracts; keep permissions, secrets, and live host callbacks in the trusted host.',
    '   - Bind every acquired resource to an explicit host scope and verify disposal on stop/restart.',
    '   - Grant guest components only the imports they need; do not bypass host boundaries with ambient globals.',
    `   - ${target.runHint}`
  ].join('\n');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

export function renderPromptWizard(): string {
  const defaultGoal = 'an interactive tool with swappable provider state';
  const defaultPrompt = buildAgentPrompt({ harness: 'dsh', target: 'browser', goal: defaultGoal });
  return `<section id="agent-setup" class="wizard-section" aria-labelledby="wizard-title" data-prompt-wizard>
    <div class="section-heading">
      <h2 id="wizard-title">Set up your<br><span>coding agent.</span></h2>
      <p>Pick your harness, target host, and what you want to build. Copy the generated prompt straight into a new session.</p>
    </div>
    <div class="wizard-shell">
      <div class="wizard-controls">
        <div class="wizard-field">
          <span class="wizard-label" id="wizard-harness-label">Agent harness</span>
          <div class="wizard-pills" role="group" aria-labelledby="wizard-harness-label">
            <button type="button" data-wizard-harness="dsh" aria-pressed="true">DeepSeek Harness</button>
            <button type="button" data-wizard-harness="codex" aria-pressed="false">Codex</button>
            <button type="button" data-wizard-harness="claude" aria-pressed="false">Claude Code</button>
            <button type="button" data-wizard-harness="generic" aria-pressed="false">Other agent</button>
          </div>
        </div>
        <div class="wizard-field">
          <span class="wizard-label" id="wizard-target-label">Target host</span>
          <div class="wizard-pills" role="group" aria-labelledby="wizard-target-label">
            <button type="button" data-wizard-target="browser" aria-pressed="true">Browser (TS)</button>
            <button type="button" data-wizard-target="native" aria-pressed="false">Desktop (Rust/WASM)</button>
            <button type="button" data-wizard-target="headless" aria-pressed="false">Headless (TS)</button>
          </div>
        </div>
        <div class="wizard-field">
          <label class="wizard-label" for="wizard-goal-input">What do you want to build?</label>
          <input id="wizard-goal-input" class="wizard-input" type="text" value="${escapeHtml(defaultGoal)}" placeholder="e.g. a 2D tilemap editor with undo history" autocomplete="off">
          <div class="wizard-presets" aria-label="Example ideas">
            <button type="button" data-wizard-preset="an interactive tool with swappable provider state">Interactive tool</button>
            <button type="button" data-wizard-preset="a 2D simulation sandbox with deterministic ticks">2D game / sim</button>
            <button type="button" data-wizard-preset="a local background watcher service with scoped state">Headless service</button>
          </div>
        </div>
      </div>
      <div class="wizard-output">
        <div class="wizard-output-bar">
          <span>agent-setup-prompt.txt</span>
          <button type="button" class="wizard-copy" data-wizard-copy>Copy prompt</button>
        </div>
        <pre><code data-wizard-code>${escapeHtml(defaultPrompt)}</code></pre>
      </div>
    </div>
  </section>`;
}

export function mountPromptWizard(root: HTMLElement): void {
  const harnessButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-wizard-harness]')];
  const targetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-wizard-target]')];
  const presetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-wizard-preset]')];
  const goalInput = root.querySelector<HTMLInputElement>('#wizard-goal-input');
  const codeEl = root.querySelector<HTMLElement>('[data-wizard-code]');
  const copyButton = root.querySelector<HTMLButtonElement>('[data-wizard-copy]');
  if (!goalInput || !codeEl || !copyButton) return;

  let harness: AgentHarness = 'dsh';
  let target: LoopTarget = 'browser';

  const update = () => {
    codeEl.textContent = buildAgentPrompt({ harness, target, goal: goalInput.value });
  };

  for (const button of harnessButtons) {
    button.addEventListener('click', () => {
      harness = (button.dataset.wizardHarness as AgentHarness) ?? 'dsh';
      for (const item of harnessButtons) item.setAttribute('aria-pressed', String(item === button));
      update();
    });
  }

  for (const button of targetButtons) {
    button.addEventListener('click', () => {
      target = (button.dataset.wizardTarget as LoopTarget) ?? 'browser';
      for (const item of targetButtons) item.setAttribute('aria-pressed', String(item === button));
      update();
    });
  }

  for (const preset of presetButtons) {
    preset.addEventListener('click', () => {
      goalInput.value = preset.dataset.wizardPreset ?? '';
      update();
    });
  }

  goalInput.addEventListener('input', update);

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(codeEl.textContent ?? '');
      copyButton.textContent = 'Copied';
      setTimeout(() => { copyButton.textContent = 'Copy prompt'; }, 1600);
    } catch {
      copyButton.textContent = 'Select prompt';
    }
  });

  update();
}
