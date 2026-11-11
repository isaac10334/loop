/** Content binding for public build-time translator output, including all adapter bytes. */
import type { TranslationResult } from "@polyengine/runtime/shim";
export type PreparedTranslation = Pick<TranslationResult, "plan" | "adapters">;
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, "0")).join("");
const digest = async (bytes: Uint8Array) => hex(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer));
/** Hashes exact JSON plan serialization plus sorted adapter-name/content hashes.
 * Pin this result in a reviewed build receipt; it establishes current bytes, not
 * compiler provenance, profile authorization or publisher authenticity.
 */
export async function translationSha256(translation: PreparedTranslation): Promise<string> {
  const plan = JSON.stringify(translation.plan);
  if (typeof plan !== "string" || plan.length > 8 * 1048576 || new TextEncoder().encode(plan).length > 8 * 1048576 || !(translation.adapters instanceof Map) || translation.adapters.size > 256) throw new TypeError("Prepared translation budget/type violation");
  let total = 0;
  const adapters: { path: string; sha256: string }[] = [];
  for (const [path, bytes] of [...translation.adapters].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (typeof path !== "string" || path.length > 256 || !(bytes instanceof Uint8Array) || (total += bytes.byteLength) > 16 * 1048576) throw new TypeError("Prepared adapter budget/type violation");
    adapters.push({ path, sha256: await digest(bytes) });
  }
  return digest(new TextEncoder().encode(JSON.stringify({ plan, adapters })));
}
