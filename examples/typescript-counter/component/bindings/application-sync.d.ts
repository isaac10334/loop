// world loopkit:app/application-sync@0.1.0
export type Action = import('./interfaces/loopkit-app-ui.js').Action;
export type View = import('./interfaces/loopkit-app-ui.js').View;
export type * as LoopkitAppNotes010 from './interfaces/loopkit-app-notes.js'; // import loopkit:app/notes@0.1.0
export type * as LoopkitAppUi010 from './interfaces/loopkit-app-ui.js'; // import loopkit:app/ui@0.1.0
export function dispatch(input: Action): View;
