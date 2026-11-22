import { expect, test } from 'bun:test';
import { initialMachine, transitionMachine as transition, mechanismPose } from './mechanism-state';
test('mechanism has explicit, interruptible run/pause/reverse states', () => {
  expect(initialMachine.mode).toBe('idle');
  const running = transition(initialMachine, { type: 'toggle' });
  expect(running.mode).toBe('running');
  const ticked = transition(running, { type: 'tick', milliseconds: 50 });
  expect(ticked.phase).toBeCloseTo(1.8);
  const paused = transition(ticked, { type: 'toggle' });
  expect(transition(paused, { type: 'tick', milliseconds: 50 })).toBe(paused);
  const reversed = transition(paused, { type: 'reverse' });
  expect(reversed.direction).toBe(-1);
  expect(reversed.phase).toBe(paused.phase);
  expect(transition(reversed, { type: 'step' }).phase).toBeCloseTo(341.8);
});
test('scrubbing pauses; bad input and stalled frame times remain bounded', () => {
  const running = transition(initialMachine, { type: 'toggle' });
  expect(transition(running, { type: 'scrub', phase: 450 })).toEqual({ phase: 90, mode: 'paused', direction: 1 });
  expect(transition(running, { type: 'scrub', phase: NaN })).toBe(running);
  expect(transition(running, { type: 'tick', milliseconds: Infinity })).toBe(running);
  expect(transition(running, { type: 'tick', milliseconds: 10000 }).phase).toBeCloseTo(2.304);
  expect(transition(running, { type: 'tick', milliseconds: -2 }).phase).toBe(0);
});
test('connecting rod retains length and slider stays on its rail through a full cycle', () => {
  for (let angle=0; angle<=360; angle++) {
    const pose=mechanismPose(angle);
    expect(Math.hypot(pose.sliderX-pose.pinX,185-pose.pinY)).toBeCloseTo(120,8);
    expect(pose.sliderX).toBeGreaterThanOrEqual(395);
    expect(pose.sliderX).toBeLessThanOrEqual(465);
    expect(pose.driven+angle).toBe(10);
  }
});
