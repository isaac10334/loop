import { describe, expect, test } from 'bun:test';
import { buildAgentPrompt, renderPromptWizard, toProjectSlug } from './prompt-wizard';

describe('agent prompt wizard', () => {
  test('generates harness- and target-specific prompts with CLI and skill steps', () => {
    const dshNative = buildAgentPrompt({ harness: 'dsh', target: 'native', goal: 'Wizard Tower tactics prototype' });
    expect(dshNative).toContain('Desktop (Rust / WASM) target, via DeepSeek Harness');
    expect(dshNative).toContain('loop skills install --target agents');
    expect(dshNative).toContain('loop create wizard-tower-tactics-prototy --kit native --yes');
    expect(dshNative).toContain('wasm32-wasip2');

    const codexHeadless = buildAgentPrompt({ harness: 'codex', target: 'headless', goal: 'File sync daemon' });
    expect(codexHeadless).toContain('loop skills install --target codex');
    expect(codexHeadless).toContain('loop create file-sync-daemon --kit headless --yes');

    const claudeBrowser = buildAgentPrompt({ harness: 'claude', target: 'browser', goal: 'Pixel editor' });
    expect(claudeBrowser).toContain('loop skills install --target claude');
    expect(claudeBrowser).toContain('loop create pixel-editor --kit browser --yes');
  });

  test('sanitizes project slugs and falls back cleanly on blank input', () => {
    expect(toProjectSlug('  My Cool App!! v2  ')).toBe('my-cool-app-v2');
    expect(toProjectSlug('   ')).toBe('my-loop-app');
  });

  test('renders static no-JS default prompt HTML safely', () => {
    const html = renderPromptWizard();
    expect(html).toContain('data-prompt-wizard');
    expect(html).toContain('data-wizard-harness="dsh"');
    expect(html).toContain('data-wizard-target="native"');
    expect(html).toContain('loop create');
    expect(html).toContain('llms.txt');
  });
});
