import { initialMachine, mechanismPose, transitionMachine, type MachineEvent } from './mechanism-state';
/** An explicit local state machine drives the illustration. It is not a runtime demo. */
export function mountMechanism(root: HTMLElement): void {
  const query = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const run = query<HTMLButtonElement>('#machine-run');
  const reverse = query<HTMLButtonElement>('#machine-reverse');
  const step = query<HTMLButtonElement>('#machine-step');
  const phase = query<HTMLOutputElement>('#machine-phase');
  const drive = query<SVGGElement>('#drive-gear'), driven = query<SVGGElement>('#driven-gear');
  const gearSurface = root.querySelector<SVGGElement>('#gear-drag-surface');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state = initialMachine, frame = 0, previous = 0, visible = true;
  let dragging = false, dragStartX = 0, dragStartPhase = 0;

  function draw() {
    const pose = mechanismPose(state.phase);
    drive.setAttribute('transform', `rotate(${state.phase} 210 178)`);
    driven.setAttribute('transform', `rotate(${pose.driven} 342 178)`);
    const rounded = Math.round(state.phase);
    phase.value = `${rounded}°`;
    gearSurface?.setAttribute('aria-valuenow', String(rounded));
    root.dataset.state = state.mode;
    root.dataset.direction = String(state.direction);
  }
  function describe() {
    const running = state.mode === 'running';
    query<HTMLElement>('.run-label').textContent = running ? 'Pause' : 'Run';
    run.setAttribute('aria-pressed', String(running));
    reverse.setAttribute('aria-pressed', String(state.direction === -1));
    run.disabled = reduced.matches;
    run.title = reduced.matches ? 'Continuous motion is off for your reduced-motion preference.' : (running ? 'Pause gears' : 'Run gears');
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

  reverse.disabled = step.disabled = false;
  run.addEventListener('click', () => dispatch({ type: 'toggle' }));
  reverse.addEventListener('click', () => dispatch({ type: 'reverse' }));
  step.addEventListener('click', () => dispatch({ type: 'step' }));

  gearSurface?.addEventListener('pointerdown', event => {
    dragging = true; dragStartX = event.clientX; dragStartPhase = state.phase;
    gearSurface.setPointerCapture(event.pointerId);
    gearSurface.classList.add('is-dragging');
  });
  gearSurface?.addEventListener('pointermove', event => {
    if (!dragging) return;
    dispatch({ type: 'scrub', phase: dragStartPhase + (event.clientX - dragStartX) * 0.9 });
  });
  const endDrag = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    gearSurface?.classList.remove('is-dragging');
    if (gearSurface?.hasPointerCapture(event.pointerId)) gearSurface.releasePointerCapture(event.pointerId);
  };
  gearSurface?.addEventListener('pointerup', endDrag);
  gearSurface?.addEventListener('pointercancel', endDrag);
  gearSurface?.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); dispatch({ type: 'scrub', phase: state.phase + 1 }); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); dispatch({ type: 'scrub', phase: state.phase - 1 }); }
    else if (event.key === 'Home') { event.preventDefault(); dispatch({ type: 'scrub', phase: 0 }); }
    else if (event.key === ' ') { event.preventDefault(); if (!reduced.matches) dispatch({ type: 'toggle' }); }
  });

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
