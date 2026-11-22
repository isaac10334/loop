/** Typed capability resolution, hierarchical ownership and cooperative structured concurrency.
 * Authorization and semantic UI/script execution remain separate application concerns.
 * @example
 * ```ts
 * await using host = createHost();
 * await using scope = host.scope({ name: "request" });
 * const resource = scope.own({ [Symbol.dispose]() { console.log("closed"); } });
 * await using lease = resource.retain(host.scope({ name: "consumer" }));
 * ```
 */
export type * from "./contracts.js";
export { createHost, createResourceOwner, toLegacyHandle } from "./runtime.js";
export type * from "./kits/contracts.js";
export { headless, bootstrapHeadless } from "./kits/headless.js";
export type { HeadlessApplicationContext, HeadlessPluginContext, HeadlessStart, HeadlessSetup } from "./kits/headless.js";
export { HostPlanError, hostPlanData, canonicalHostJson, defineConfig, defineHostKit, defineHostPlugin, extractHostConfig, resolveHostPlan } from "./kits/resolve.js";
