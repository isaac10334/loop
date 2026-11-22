/** Verified document and import-free Components in dedicated Polyengine 0.6.7 workers; no ambient authority. */
export { createPureComponentSession, type PureComponentSession, type PureComponentSessionOptions, type PureComponentArtifact } from './pure-session.js';
export { installPureComponentWorker } from './pure-worker.js';
export { createDocumentOwner, DocumentOperationError, checkSource, type DocumentOwner, type DocumentGrant, type DocumentSnapshot, type DocumentFailure } from "./documents.js";
export { createPolyengineSession, ComponentOutcomeUncertainError, type PolyengineSession, type PolyengineSessionOptions, type ComponentArtifact } from "./session.js";
export { installPolyengineWorker } from "./worker.js";
export { translationSha256, type PreparedTranslation } from "./translation.js";
