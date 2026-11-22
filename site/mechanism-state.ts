/** Local illustrative mechanism; no Loop Kit authority or application state is implied. */
export interface MachineState { readonly phase: number; readonly direction: 1 | -1; readonly mode: 'idle' | 'running' | 'paused' }
export type MachineEvent = { type: 'toggle' | 'reverse' | 'step' | 'pause' } | { type: 'scrub'; phase: number } | { type: 'tick'; milliseconds: number };
export const initialMachine: MachineState = { phase: 0, direction: 1, mode: 'idle' };
const wrap = (angle: number) => ((angle % 360) + 360) % 360;
export function transitionMachine(state: MachineState, event: MachineEvent): MachineState {
  switch (event.type) {
    case 'toggle': return { ...state, mode: state.mode === 'running' ? 'paused' : 'running' };
    case 'pause': return { ...state, mode: 'paused' };
    case 'reverse': return { ...state, direction: state.direction === 1 ? -1 : 1 };
    case 'step': return { ...state, mode: 'paused', phase: wrap(state.phase + state.direction * 20) };
    case 'scrub': return Number.isFinite(event.phase) ? { ...state, mode: 'paused', phase: wrap(event.phase) } : state;
    case 'tick': return state.mode === 'running' && Number.isFinite(event.milliseconds)
      ? { ...state, phase: wrap(state.phase + Math.max(0, Math.min(64, event.milliseconds)) * .036 * state.direction) } : state;
  }
}
export function mechanismPose(phase: number) {
  const driven = 10 - phase, angle = driven * Math.PI / 180;
  const pinX = 310 + 35 * Math.cos(angle), pinY = 185 + 35 * Math.sin(angle);
  // Fixed-length connecting rod constrained to the horizontal guide.
  const sliderX = pinX + Math.sqrt(120 ** 2 - (185 - pinY) ** 2);
  return { driven, pinX, pinY, sliderX };
}
