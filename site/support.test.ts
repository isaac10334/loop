import { describe, expect, test } from 'bun:test';
import { capabilityMatrix, support, supportMarkdown, type CapabilityStatus } from './support';

const requestedIds = [
  'application-lifecycle', 'browser-host', 'rust-desktop-host', 'headless-host',
  'webgpu-compute-rendering', 'gpu-resources', 'simulation-clocks', 'spatial-fields-grids',
  'adaptive-scheduling', 'deterministic-rng', 'checkpoints', 'typed-events-dataflow',
  'instrumentation', 'component-loading', 'permissions', 'input', 'semantic-ui',
  'solver-coupling', 'network', 'schema-contract-ir',
  'jettbot-labeled-multistream-audio-turn-taking',
];
const statuses = new Set<CapabilityStatus>(['supported', 'experimental', 'proposed', 'application-owned', 'unsupported', 'untested']);

describe('engine capability support matrix', () => {
  test('contains each requested stable capability id exactly once', () => {
    expect(capabilityMatrix.map(({ id }) => id).sort()).toEqual([...requestedIds].sort());
    expect(new Set(capabilityMatrix.map(({ id }) => id)).size).toBe(capabilityMatrix.length);
  });

  test('has a valid, separately stated state and evidence for each host profile', () => {
    for (const capability of capabilityMatrix) {
      expect(capability.evidence.length).toBeGreaterThan(0);
      for (const profile of ['browser', 'rust-desktop', 'headless'] as const) {
        expect(statuses.has(capability.hosts[profile].status)).toBe(true);
        expect(capability.hosts[profile].note.length).toBeGreaterThan(0);
      }
    }
  });

  test('does not claim implemented WebGPU/GPU support and renders explanations', () => {
    for (const item of capabilityMatrix.filter(({ id }) => id.includes('gpu'))) {
      expect(item.hosts.browser.status).not.toBe('supported');
      expect(item.hosts['rust-desktop'].status).not.toBe('supported');
      expect(item.hosts.headless.status).not.toBe('supported');
    }
    const markdown = supportMarkdown();
    expect(markdown).toContain('Engine capability roadmap and support matrix');
    expect(markdown).toContain('**application-owned**');
    expect(markdown).toContain('**proposed**');
    expect(markdown).toContain('Browser platform API availability alone does not establish Loop support.');
  });

  test('preserves the original structured catalog and its JSON field shape', () => {
    expect(support.some(({ id }) => id === '@loop-kit/host')).toBe(true);
    expect(support.some(({ id }) => id === 'platform:dom/raw-access')).toBe(true);
    const oldEntry = support[0]!;
    expect(Object.keys(oldEntry).sort()).toEqual(['authority', 'bindings', 'contract', 'evidence', 'id', 'kit', 'platforms', 'provider', 'restrictions', 'status', 'version']);
  });
});
