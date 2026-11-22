import { initialMachine, mechanismPose, transitionMachine, type MachineEvent } from './mechanism-state';
/** An explicit local state machine drives the illustration. It is not a runtime demo. */
export function mountMechanism(root: HTMLElement): void {
  const query = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const scrub = query<HTMLInputElement>('#machine-scrub');
  const run = query<HTMLButtonElement>('#machine-run');
  const reverse = query<HTMLButtonElement>('#machine-reverse');
  const step = query<HTMLButtonElement>('#machine-step');
  const status = query<HTMLOutputElement>('#machine-status');
  const phase = query<HTMLOutputElement>('#machine-phase');
  const drive = query<SVGGElement>('#drive-gear'), driven = query<SVGGElement>('#driven-gear');
  const rod = query<SVGPathElement>('#connecting-rod'), highlight = query<SVGPathElement>('#rod-highlight');
  const pin = query<SVGCircleElement>('#crank-pin'), slider = query<SVGGElement>('#slider');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state = initialMachine, frame = 0, previous = 0, visible = true;
  function draw() {
    const pose = mechanismPose(state.phase);
    drive.setAttribute('transform', `rotate(${state.phase} 180 185)`);
    driven.setAttribute('transform', `rotate(${pose.driven} 310 185)`);
    rod.setAttribute('d', `M${pose.pinX} ${pose.pinY}L${pose.sliderX} 185`);
    highlight.setAttribute('d', `M${pose.pinX} ${pose.pinY - 3}L${pose.sliderX} 182`);
    pin.setAttribute('cx', String(pose.pinX)); pin.setAttribute('cy', String(pose.pinY));
    slider.setAttribute('transform', `translate(${pose.sliderX} 185)`);
    scrub.value = String(Math.round(state.phase)); phase.value = `${Math.round(state.phase)}°`;
    root.dataset.state = state.mode;
  }
  function describe() {
    query<HTMLElement>('.run-label').textContent = state.mode === 'running' ? 'Pause' : 'Run';
    query<HTMLElement>('.run-icon').textContent = state.mode === 'running' ? 'Ⅱ' : '▶';
    reverse.setAttribute('aria-pressed', String(state.direction === -1));
    status.value = reduced.matches ? 'Manual mode. Turn or step.' : state.mode === 'idle' ? 'Give it a turn.' : state.mode === 'running' ? (state.direction === 1 ? 'Connected. In motion.' : 'Running in reverse.') : 'Paused. Still connected.';
    run.disabled = reduced.matches;
    run.title = reduced.matches ? 'Continuous motion is off for your reduced-motion preference.' : '';
  }
  function tick(now: number) {
    frame = 0;
    state = transitionMachine(state, { type: 'tick', milliseconds: previous ? now - previous : 0 });
    previous = now; draw(); schedule();
  }
  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (state.mode === 'running' && visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    else previous = 0;
  }
  function dispatch(event: MachineEvent) { state = transitionMachine(state, event); draw(); describe(); schedule(); }
  scrub.disabled = reverse.disabled = step.disabled = false;
  run.addEventListener('click', () => dispatch({ type: 'toggle' }));
  reverse.addEventListener('click', () => dispatch({ type: 'reverse' }));
  step.addEventListener('click', () => dispatch({ type: 'step' }));
  scrub.addEventListener('input', () => dispatch({ type: 'scrub', phase: scrub.valueAsNumber }));
  reduced.addEventListener('change', () => dispatch({ type: 'pause' }));
  document.addEventListener('visibilitychange', schedule);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; schedule(); });
    observer.observe(root);
  }
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; previous = 0; });
  window.addEventListener('pageshow', schedule);
  draw(); describe();
}
