/** Portable immutable source snapshots and build contracts. These values contain no
 * credentials, live grants or execution handles. Storage and builders are
 * injected adapters; accepting a descriptor never authorizes its effects. */
export type Digest = `sha256:${string}`;

/** Stable repository identity plus an immutable source revision. */
export interface PinnedAssetReference {
  readonly repository: string;
  readonly assetId: string;
  readonly revision: Digest;
}

/** Small text-source closure. Binary outputs belong in artifact storage.
 * Digest covers sorted files and pinned dependencies, not mutable display names. */
export interface SourceSnapshot {
  readonly format: "loop-source-v1";
  readonly digest: Digest;
  readonly files: Readonly<Record<string, string>>;
  readonly dependencies: readonly PinnedAssetReference[];
}

const encoder = new TextEncoder();
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const MAX_BYTES = 1024 * 1024;
function assertDigest(value: string): asserts value is Digest {
  if (!digestPattern.test(value)) throw new TypeError("Invalid SHA-256 digest");
}

/** Virtual project paths never address the OS, Git internals or parent paths. */
export function validateSourcePath(path: string): string {
  if (path.length > 240 || !/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(path)
    || path.split("/").some(part => part === "." || part === ".." || part.endsWith(".")
      || part.toLowerCase() === ".git" || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw new TypeError(`Invalid source path: ${path}`);
  }
  return path;
}

/** Hash exact UTF-8 bytes, available in browsers and Node without a platform adapter. */
export async function contentDigest(source: string): Promise<Digest> {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(source));
  return `sha256:${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

/** Validate and freeze an inert source closure. No files are read or executed.
 * Rejects case collisions for portable Windows/Unix round trips and oversized sources. */
export async function createSourceSnapshot(
  files: Readonly<Record<string, string>>,
  dependencies: readonly PinnedAssetReference[] = [],
): Promise<SourceSnapshot> {
  if (!files || typeof files !== "object" || Array.isArray(files)) throw new TypeError("Invalid source files");
  const entries = Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  if (entries.length > 512) throw new TypeError("Source file limit exceeded");
  const paths = new Set<string>();
  for (const [path, source] of entries) {
    validateSourcePath(path);
    if (typeof source !== "string") throw new TypeError("Text source required");
    if (paths.has(path.toLowerCase())) throw new TypeError("Case-colliding source paths");
    paths.add(path.toLowerCase());
  }
  if (dependencies.length > 128) throw new TypeError("Dependency limit exceeded");
  const identities = new Set<string>();
  const pinned = dependencies.map(item => {
    if (!item || typeof item.repository !== "string" || !item.repository || item.repository.length > 200
      || typeof item.assetId !== "string" || !item.assetId || item.assetId.length > 160) throw new TypeError("Invalid dependency identity");
    assertDigest(item.revision);
    const identity = JSON.stringify([item.repository, item.assetId]);
    if (identities.has(identity)) throw new TypeError("Duplicate dependency identity");
    identities.add(identity);
    return Object.freeze({ repository: item.repository, assetId: item.assetId, revision: item.revision });
  }).sort((a, b) => {
    const left = JSON.stringify([a.repository, a.assetId]), right = JSON.stringify([b.repository, b.assetId]);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const value = { format: "loop-source-v1" as const, files: Object.fromEntries(entries), dependencies: pinned };
  const encoded = JSON.stringify(value);
  if (encoder.encode(encoded).byteLength > MAX_BYTES) throw new TypeError("Source snapshot exceeds 1 MiB");
  return Object.freeze({ ...value, files: Object.freeze(value.files), dependencies: Object.freeze(pinned), digest: await contentDigest(encoded) });
}

/** Recompute source identity before trusting a transported snapshot. */
export async function verifySourceSnapshot(snapshot: SourceSnapshot): Promise<SourceSnapshot> {
  if (snapshot.format !== "loop-source-v1") throw new TypeError("Unsupported source format");
  const verified = await createSourceSnapshot(snapshot.files, snapshot.dependencies);
  if (verified.digest !== snapshot.digest) throw new Error("Source snapshot digest mismatch");
  return verified;
}

/** A pinned recipe and target request behavior; they do not grant a builder access. */
export interface BuildRequest {
  readonly source: Digest;
  readonly recipe: Digest;
  readonly targetProfile: string;
  readonly idempotencyKey: string;
}
/** Recorded provenance, not a signed attestation or reproducibility guarantee. */
export interface BuildReceipt {
  readonly source: Digest;
  readonly recipe: Digest;
  readonly toolchain: string;
  readonly targetProfile: string;
  readonly outputs: Readonly<Record<string, Digest>>;
}
/** Caller owns cancellation; the adapter must stop work or suppress late publication. */
export interface BuildProvider {
  build(request: BuildRequest, source: SourceSnapshot, signal?: AbortSignal): Promise<BuildReceipt>;
}

