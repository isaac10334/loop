import { test, expect } from 'bun:test';
import { releaseRequirements, dryRunPublishArgs, registry } from './release';
import { ordered, root } from './packages';
import { join } from 'node:path';
test('host publication is explicit and OIDC is isolated behind the protected environment',async()=>{
  const text=await Bun.file(join(root,'.github/workflows/publish-host.yml')).text();
  const workflow=Bun.YAML.parse(text) as any;
  expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
  expect(workflow.on.workflow_dispatch.inputs.publish).toMatchObject({type:'boolean',default:false});
  expect(workflow.permissions).toEqual({contents:'read'});
  expect(workflow.concurrency).toEqual({group:'publish-host','cancel-in-progress':false});
  const {verify,publish}=workflow.jobs;
  expect(verify.environment).toBeUndefined();
  expect(JSON.stringify(verify)).not.toMatch(/id-token|crates-io-auth-action|CARGO_REGISTRY_TOKEN/);
  expect(verify.steps.some((step:any)=>step.run?.includes('cargo test --locked --workspace --all-features'))).toBe(true);
  expect(verify.steps.some((step:any)=>step.run?.includes('cargo publish --locked -p loop-host --dry-run'))).toBe(true);
  expect(publish.if).toBe('${{ inputs.publish }}');
  expect(publish.needs).toBe('verify');
  expect(publish.environment).toBe('crates');
  expect(publish.permissions).toEqual({contents:'read','id-token':'write'});
  expect(publish.steps.find((step:any)=>step.id==='auth').uses).toBe('rust-lang/crates-io-auth-action@v1');
  expect(publish.steps.find((step:any)=>step.env?.CARGO_REGISTRY_TOKEN).env.CARGO_REGISTRY_TOKEN).toBe('${{ steps.auth.outputs.token }}');
  for(const job of [verify,publish])expect(job.steps[0].with.ref).toBe('${{ github.sha }}');
  expect(text).not.toContain('secrets.');
});
test('initial release inventory includes all nine public packages in dependency order',()=>{
  const inventory=ordered();
  expect(inventory.map(pkg=>pkg.name).sort()).toEqual(['@loop-kit/capabilities','@loop-kit/component-polyengine','@loop-kit/host','@loop-kit/host-browser','@loop-kit/host-native','@loop-kit/renderer-dom','@loop-kit/scripting','@loop-kit/ui','@loop-kit/workspace']);
  expect(releaseRequirements(inventory.map(pkg=>pkg.name)).map(pkg=>pkg.name)).toEqual(inventory.map(pkg=>pkg.name));
  for(const pkg of inventory)for(const name of Object.keys(pkg.dependencies??{})) {
    const dependency=inventory.findIndex(item=>item.name===name);
    if(dependency>=0)expect(dependency).toBeLessThan(inventory.indexOf(pkg));
  }
});
test('dry runs cannot publish and use the same explicit public registry as the plan',()=>{
  expect(dryRunPublishArgs('archive with spaces.tgz','canary')).toEqual(['npm','publish','archive with spaces.tgz','--dry-run','--access','public','--tag','canary','--registry',registry]);
});
test('capability changes propagate through real host adapters, never unrelated ui or Component engine',()=>{
  const names=releaseRequirements(['@loop-kit/capabilities']).map(pkg=>pkg.name);
  expect([...names].sort()).toEqual(['@loop-kit/capabilities','@loop-kit/host','@loop-kit/host-browser','@loop-kit/host-native','@loop-kit/renderer-dom','@loop-kit/scripting']);
  expect(names.indexOf('@loop-kit/host')).toBeLessThan(names.indexOf('@loop-kit/host-browser'));
  expect(names.indexOf('@loop-kit/host')).toBeLessThan(names.indexOf('@loop-kit/host-native'));
});
test('ui changes propagate through every consuming renderer/runtime, never unrelated workspace',()=>{
  const names=releaseRequirements(['@loop-kit/ui']).map(pkg=>pkg.name);
  expect([...names].sort()).toEqual(['@loop-kit/component-polyengine','@loop-kit/host-browser','@loop-kit/host-native','@loop-kit/renderer-dom','@loop-kit/scripting','@loop-kit/ui']);
  for(const dependent of names.filter(name=>name!=='@loop-kit/ui'))expect(names.indexOf('@loop-kit/ui')).toBeLessThan(names.indexOf(dependent));
});
test('a previously released dependent needs a new version before publication',()=>{
  const plan=releaseRequirements(['@loop-kit/capabilities'],{'@loop-kit/host':'0.1.0'});
  const host=plan.find(pkg=>pkg.name==='@loop-kit/host')!;
  expect(host.versionUpdateRequired).toBe(true);
  expect(host.minimumSuggestedVersion).toBe('0.1.1');
});
