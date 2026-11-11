// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/types.js
function coreFuncTypeEquals(a, b) {
  return a.params.length === b.params.length && a.results.length === b.results.length && a.params.every((p, i) => p === b.params[i]) && a.results.every((r, i) => r === b.results[i]);
}

class ResourceTypeInfo {
  impl;
  dtor;
  dtorHost;
  constructor(impl, dtor = null, dtorHost = null) {
    this.impl = impl;
    this.dtor = dtor;
    this.dtorHost = dtorHost;
  }
}
var despecializedCache = new WeakMap;
function despecialize(t) {
  const hit = despecializedCache.get(t);
  if (hit !== undefined)
    return hit;
  const d = despecializeUncached(t);
  despecializedCache.set(t, d);
  return d;
}
function despecializeUncached(t) {
  switch (t.kind) {
    case "tuple":
      return Object.freeze({
        kind: "record",
        fields: Object.freeze(t.elements.map((e, i) => Object.freeze({ label: String(i), type: e })))
      });
    case "enum":
      return Object.freeze({
        kind: "variant",
        cases: Object.freeze(t.labels.map((l) => Object.freeze({ label: l, type: null })))
      });
    case "option":
      return Object.freeze({
        kind: "variant",
        cases: Object.freeze([
          Object.freeze({ label: "none", type: null }),
          Object.freeze({ label: "some", type: t.type })
        ])
      });
    case "result":
      return Object.freeze({
        kind: "variant",
        cases: Object.freeze([
          Object.freeze({ label: "ok", type: t.ok }),
          Object.freeze({ label: "error", type: t.error })
        ])
      });
    case "map":
      return Object.freeze({
        kind: "list",
        element: despecialize({
          kind: "tuple",
          elements: [t.key, t.value]
        })
      });
    default:
      return t;
  }
}
function discriminantSize(caseCount) {
  const n = caseCount;
  if (!(0 < n && n < 2 ** 32))
    throw new Error("assertion failed: case count");
  if (n <= 256)
    return 1;
  if (n <= 65536)
    return 2;
  return 4;
}
var U8 = Object.freeze({ kind: "u8" });
var U16 = Object.freeze({ kind: "u16" });
var U32 = Object.freeze({ kind: "u32" });
function discriminantType(cases) {
  switch (discriminantSize(cases.length)) {
    case 1:
      return U8;
    case 2:
      return U16;
    case 4:
      return U32;
  }
}
var caseIndexCache = new WeakMap;
function caseIndexOf(cases) {
  const hit = caseIndexCache.get(cases);
  if (hit !== undefined)
    return hit;
  const m = new Map;
  for (let i = 0;i < cases.length; i++) {
    const label = cases[i].label;
    m.set(label, m.has(label) ? -1 : i);
  }
  caseIndexCache.set(cases, m);
  return m;
}
function contains(t, p) {
  if (t === null)
    return false;
  const d = despecialize(t);
  switch (d.kind) {
    case "list":
      return p(d) || contains(d.element, p);
    case "stream":
    case "future":
      return p(d) || contains(d.element, p);
    case "record":
      return p(d) || d.fields.some((f) => contains(f.type, p));
    case "variant":
      return p(d) || d.cases.some((c) => contains(c.type, p));
    default:
      return p(d);
  }
}
function valTypesEqual(a, b) {
  return a.length === b.length && a.every((t, i) => valTypeEqual(t, b[i]));
}
function valTypeEqual(a, b) {
  if (a === b)
    return true;
  if (a.kind !== b.kind)
    return false;
  switch (a.kind) {
    case "list": {
      const bb = b;
      return a.length === bb.length && valTypeEqual(a.element, bb.element);
    }
    case "record": {
      const bb = b;
      return a.fields.length === bb.fields.length && a.fields.every((f, i) => f.label === bb.fields[i].label && valTypeEqual(f.type, bb.fields[i].type));
    }
    case "tuple": {
      const bb = b;
      return a.elements.length === bb.elements.length && a.elements.every((e, i) => valTypeEqual(e, bb.elements[i]));
    }
    case "variant": {
      const bb = b;
      return a.cases.length === bb.cases.length && a.cases.every((c, i) => {
        const other = bb.cases[i];
        if (c.label !== other.label)
          return false;
        if (c.type === null || other.type === null)
          return c.type === other.type;
        return valTypeEqual(c.type, other.type);
      });
    }
    case "enum":
    case "flags": {
      const bb = b;
      return a.labels.length === bb.labels.length && a.labels.every((l, i) => l === bb.labels[i]);
    }
    case "option": {
      const bb = b;
      return valTypeEqual(a.type, bb.type);
    }
    case "result": {
      const bb = b;
      if (a.ok === null !== (bb.ok === null))
        return false;
      if (a.error === null !== (bb.error === null))
        return false;
      return (a.ok === null || valTypeEqual(a.ok, bb.ok)) && (a.error === null || valTypeEqual(a.error, bb.error));
    }
    case "map": {
      const bb = b;
      return valTypeEqual(a.key, bb.key) && valTypeEqual(a.value, bb.value);
    }
    case "own":
    case "borrow": {
      const bb = b;
      return a.rt === bb.rt;
    }
    case "stream":
    case "future": {
      const bb = b;
      if (a.element === null !== (bb.element === null))
        return false;
      return a.element === null || valTypeEqual(a.element, bb.element);
    }
    case "error-context":
      return true;
    default:
      return true;
  }
}
function fmtValType(t) {
  if (t === null)
    return "_";
  switch (t.kind) {
    case "list":
      return t.length === undefined ? `list<${fmtValType(t.element)}>` : `list<${fmtValType(t.element)}, ${t.length}>`;
    case "record":
      return `record{${t.fields.map((f) => `${f.label}: ${fmtValType(f.type)}`).join(", ")}}`;
    case "tuple":
      return `tuple<${t.elements.map(fmtValType).join(", ")}>`;
    case "variant":
      return `variant{${t.cases.map((c) => c.type === null ? c.label : `${c.label}(${fmtValType(c.type)})`).join(", ")}}`;
    case "enum":
      return `enum{${t.labels.join(", ")}}`;
    case "flags":
      return `flags{${t.labels.join(", ")}}`;
    case "option":
      return `option<${fmtValType(t.type)}>`;
    case "result":
      return `result<${fmtValType(t.ok)}, ${fmtValType(t.error)}>`;
    case "map":
      return `map<${fmtValType(t.key)}, ${fmtValType(t.value)}>`;
    case "own":
    case "borrow":
      return `${t.kind}<resource>`;
    case "stream":
    case "future":
      return `${t.kind}<${fmtValType(t.element)}>`;
    default:
      return t.kind;
  }
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/plan/loader.js
class PlanError extends Error {
  constructor(message) {
    super(message);
    this.name = "PlanError";
  }
}

class TranslateError extends Error {
  phase;
  detail;
  constructor(d) {
    super(`translator error [${d.phase}]: ${d.message}`);
    this.name = "TranslateError";
    this.phase = d.phase;
    this.detail = d.detail ?? d.message;
  }
  get isValidationVerdict() {
    return this.phase === "validation";
  }
}
var SUPPORTED_FORMAT_VERSION = 5;
function loadPlan(wire) {
  if (wire.formatVersion !== SUPPORTED_FORMAT_VERSION) {
    throw new PlanError(`unsupported plan formatVersion ${wire.formatVersion} ` + `(this runtime implements v${SUPPORTED_FORMAT_VERSION})`);
  }
  for (const required of [
    "modules",
    "initializers",
    "trampolines",
    "canonicalOptions",
    "types",
    "resourceTables",
    "streamTables",
    "futureTables",
    "errorContextTables",
    "imports",
    "exports"
  ]) {
    if (!Array.isArray(wire[required])) {
      throw new PlanError(`plan.${required} missing or not an array`);
    }
  }
  wire.initializers.forEach((init, i) => validateInitializer(init, `initializers[${i}]`));
  wire.trampolines.forEach((t, i) => validateTrampoline(t, `trampolines[${i}]`));
  wire.canonicalOptions.forEach((o, i) => validateCanonicalOptions(o, `canonicalOptions[${i}]`));
  wire.errorContextTables.forEach((t, i) => {
    const where = `errorContextTables[${i}]`;
    expect(isRecord(t), where, `must be an object, got ${describeValue(t)}`);
    expectNumber(t, "instance", where);
  });
  wire.modules.forEach((m, i) => validateModule(m, `modules[${i}]`));
  wire.imports.forEach((imp, i) => validateImport(imp, `imports[${i}]`));
  wire.exports.forEach((exp, i) => validateExport(exp, `exports[${i}]`));
  const importedResources = wire.importedResources ?? [];
  for (const [i, ir] of importedResources.entries()) {
    if (typeof ir?.import !== "number" || ir.import < 0 || ir.import >= wire.imports.length) {
      throw new PlanError(`importedResources[${i}].import = ${ir?.import} is not a valid ` + `index into plan.imports (length ${wire.imports.length})`);
    }
  }
  const tokenByResource = new Map;
  const resourceTokens = wire.resourceTables.map((table) => {
    if (table.kind !== "concrete")
      return new ResourceTypeInfo(null, null);
    let token = tokenByResource.get(table.resource);
    if (token === undefined) {
      token = new ResourceTypeInfo(null, null);
      tokenByResource.set(table.resource, token);
    }
    return token;
  });
  const types = wire.types.map((t, i) => loadTypeDecl(t, resourceTokens, `types[${i}]`));
  const resultTupleTypes = new Map;
  for (const [i, t] of wire.trampolines.entries()) {
    if (t.kind !== "task-return")
      continue;
    const decl = t;
    if (decl.resultType === null)
      continue;
    if (decl.resultType < 0 || decl.resultType >= wire.types.length) {
      throw new PlanError(`trampolines[${i}].resultType = ${decl.resultType} is not a valid ` + `index into plan.types (length ${wire.types.length})`);
    }
    const seen = resultTupleTypes.get(decl.results);
    if (seen !== undefined && seen !== decl.resultType) {
      throw new PlanError(`trampolines[${i}]: task-return tuple ${decl.results} maps to both ` + `type ${seen} and type ${decl.resultType}`);
    }
    resultTupleTypes.set(decl.results, decl.resultType);
  }
  const elems = (ts, what) => (ts ?? []).map((t, i) => t.element === null ? null : loadValType(t.element, resourceTokens, `${what}[${i}].element`));
  return {
    wire,
    types,
    resourceTokens,
    numImportedResources: importedResources.length,
    streamElems: elems(wire.streamTables, "streamTables"),
    futureElems: elems(wire.futureTables, "futureTables"),
    streamTableInstances: wire.streamTables.map((t) => t.instance),
    futureTableInstances: wire.futureTables.map((t) => t.instance),
    errorContextTableInstances: wire.errorContextTables.map((t) => t.instance),
    resultTupleTypes
  };
}
function resourceIndexOfDefined(plan, definedIndex) {
  return plan.numImportedResources + definedIndex;
}
function loadEnvelope(json) {
  let envelope;
  try {
    envelope = JSON.parse(json);
  } catch (e) {
    throw new PlanError(`envelope is not valid JSON: ${e}`);
  }
  if (envelope.error !== undefined) {
    throw new TranslateError(envelope.errorDetail ?? { phase: "internal", message: envelope.error });
  }
  if (!envelope.plan)
    throw new PlanError("envelope missing `plan`");
  loadPlan(envelope.plan);
  const adapters = new Map;
  for (const a of envelope.adapters ?? []) {
    adapters.set(a.file, base64Decode(a.wasm));
  }
  return { wire: envelope.plan, adapters };
}
function base64Decode(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0;i < bin.length; i++)
    out[i] = bin.charCodeAt(i);
  return out;
}
function isRecord(x) {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function expect(cond, where, what) {
  if (!cond)
    throw new PlanError(`${where}: ${what}`);
}
function expectNumber(o, field, where) {
  expect(typeof o[field] === "number", where, `.${field} must be a number, got ${describeValue(o[field])}`);
}
function expectNumberOrNull(o, field, where) {
  expect(o[field] === null || typeof o[field] === "number", where, `.${field} must be a number or null, got ${describeValue(o[field])}`);
}
function expectString(o, field, where) {
  expect(typeof o[field] === "string", where, `.${field} must be a string, got ${describeValue(o[field])}`);
}
function expectNonNegativeInt(o, field, where) {
  const v = o[field];
  expect(typeof v === "number" && Number.isSafeInteger(v) && v >= 0, where, `.${field} must be a non-negative safe integer, got ${describeValue(v)}`);
}
function expectBoolean(o, field, where) {
  expect(typeof o[field] === "boolean", where, `.${field} must be a boolean, got ${describeValue(o[field])}`);
}
function expectArray(o, field, where) {
  expect(Array.isArray(o[field]), where, `.${field} must be an array, got ${describeValue(o[field])}`);
}
function describeValue(v) {
  if (v === undefined)
    return "undefined (missing)";
  if (v === null)
    return "null";
  if (Array.isArray(v))
    return `array (length ${v.length})`;
  if (typeof v === "object")
    return "object";
  return JSON.stringify(v);
}
var CORE_TYPE_LANES = new Set(["i32", "i64", "f32", "f64"]);
function validateCoreDef(def, where) {
  expect(isRecord(def), where, `must be an object, got ${describeValue(def)}`);
  const d = def;
  expectString(d, "kind", where);
  switch (d.kind) {
    case "export":
      expectNumber(d, "instance", where);
      expect(isRecord(d.item), where, `.item must be an object`);
      validateExportItem(d.item, `${where}.item`);
      return;
    case "instance-flags":
      expectNumber(d, "instance", where);
      return;
    case "trampoline":
      expectNumber(d, "index", where);
      return;
    case "unsafe-intrinsic":
      expectString(d, "intrinsic", where);
      return;
    default:
      throw new PlanError(`${where}: unknown CoreDef kind ${describeValue(d.kind)}`);
  }
}
function validateExportItem(item, where) {
  expect(isRecord(item), where, `must be an object`);
  const it = item;
  expectString(it, "name", where);
  expect(typeof it.space === "string" && ["func", "table", "memory", "global", "tag", "unknown"].includes(it.space), where, `.space must be one of func/table/memory/global/tag/unknown, got ` + describeValue(it.space));
}
function validateCoreExport(exp, where) {
  expect(isRecord(exp), where, `must be an object`);
  const e = exp;
  expectNumber(e, "instance", where);
  expect(isRecord(e.item), where, `.item must be an object`);
  validateExportItem(e.item, `${where}.item`);
}
function validateInitializer(init, where) {
  expect(isRecord(init), where, `must be an object, got ${describeValue(init)}`);
  const i = init;
  expectString(i, "op", where);
  switch (i.op) {
    case "instantiate-module":
      expectNumber(i, "module", where);
      expectNumberOrNull(i, "instance", where);
      expectArray(i, "args", where);
      i.args.forEach((a, idx) => validateCoreDef(a, `${where}.args[${idx}]`));
      return;
    case "lower-import":
      expectNumber(i, "index", where);
      expectNumber(i, "import", where);
      return;
    case "extract-memory":
      expectNumber(i, "index", where);
      validateCoreExport(i.export, `${where}.export`);
      return;
    case "extract-realloc":
    case "extract-callback":
    case "extract-post-return":
      expectNumber(i, "index", where);
      validateCoreDef(i.def, `${where}.def`);
      return;
    case "extract-table":
      expectNumber(i, "index", where);
      validateCoreExport(i.export, `${where}.export`);
      return;
    case "resource":
      expectNumber(i, "index", where);
      expect(typeof i.rep === "string" && CORE_TYPE_LANES.has(i.rep), where, `.rep must be one of i32/i64/f32/f64, got ${describeValue(i.rep)}`);
      expect(i.dtor === null || isRecord(i.dtor), where, `.dtor must be a CoreDef object or null`);
      if (i.dtor !== null)
        validateCoreDef(i.dtor, `${where}.dtor`);
      expectNumber(i, "instance", where);
      return;
    default:
      throw new PlanError(`${where}: unknown initializer op ${describeValue(i.op)}`);
  }
}
function validateTrampoline(t, where) {
  expect(isRecord(t), where, `must be an object, got ${describeValue(t)}`);
  const tr = t;
  expectString(tr, "kind", where);
  expectNumber(tr, "index", where);
  switch (tr.kind) {
    case "lower-import":
      expectNumber(tr, "lowered", where);
      expectNumber(tr, "options", where);
      expectNumber(tr, "type", where);
      return;
    case "trap":
      expectNonNegativeInt(tr, "code", where);
      return;
    case "enter-sync-call":
    case "exit-sync-call":
      return;
    case "task-return":
      expectNumber(tr, "instance", where);
      expectNumber(tr, "results", where);
      expectNumberOrNull(tr, "resultType", where);
      expectNumber(tr, "options", where);
      return;
    case "resource-drop":
    case "resource-new":
    case "resource-rep":
      expectNumber(tr, "instance", where);
      expectNumber(tr, "resource", where);
      return;
    default:
      return;
  }
}
function validateCanonicalOptions(o, where) {
  expect(isRecord(o), where, `must be an object, got ${describeValue(o)}`);
  const co = o;
  expectNumber(co, "instance", where);
  expect(typeof co.stringEncoding === "string" && ["utf8", "utf16", "latin1+utf16"].includes(co.stringEncoding), where, `.stringEncoding must be one of utf8/utf16/latin1+utf16, got ` + describeValue(co.stringEncoding));
  expectNumberOrNull(co, "memory", where);
  expectNumberOrNull(co, "realloc", where);
  expectNumberOrNull(co, "postReturn", where);
  expectNumberOrNull(co, "callback", where);
  expectBoolean(co, "async", where);
  expectBoolean(co, "cancellable", where);
  expect(isRecord(co.coreType), where, `.coreType must be an object`);
  const ct = co.coreType;
  expectArray(ct, "params", `${where}.coreType`);
  expectArray(ct, "results", `${where}.coreType`);
  for (const [field, lanes] of [["params", ct.params], ["results", ct.results]]) {
    lanes.forEach((lane, idx) => {
      expect(typeof lane === "string" && CORE_TYPE_LANES.has(lane), `${where}.coreType.${field}[${idx}]`, `must be one of i32/i64/f32/f64, got ${describeValue(lane)}`);
    });
  }
}
function validateModule(m, where) {
  expect(isRecord(m), where, `must be an object, got ${describeValue(m)}`);
  const mm = m;
  expectString(mm, "kind", where);
  switch (mm.kind) {
    case "embedded":
      expectNonNegativeInt(mm, "offset", where);
      expectNonNegativeInt(mm, "len", where);
      return;
    case "adapter":
      expectString(mm, "file", where);
      expectNonNegativeInt(mm, "len", where);
      expectArray(mm, "intrinsics", where);
      mm.intrinsics.forEach((entry, i) => validateIntrinsicEntry(entry, `${where}.intrinsics[${i}]`));
      return;
    default:
      throw new PlanError(`${where}: unknown module kind ${describeValue(mm.kind)}`);
  }
}
function validateIntrinsicEntry(entry, where) {
  expect(isRecord(entry), where, `must be an object, got ${describeValue(entry)}`);
  const e = entry;
  expectString(e, "module", where);
  expectString(e, "name", where);
  expectString(e, "category", where);
  expect(isRecord(e.def), where, `.def must be an object`);
  validateCoreDef(e.def, `${where}.def`);
}
function validateImport(imp, where) {
  expect(isRecord(imp), where, `must be an object, got ${describeValue(imp)}`);
  const i = imp;
  expectString(i, "name", where);
  expectArray(i, "path", where);
  i.path.forEach((p, idx) => {
    expect(typeof p === "string", `${where}.path[${idx}]`, `must be a string, got ${describeValue(p)}`);
  });
  expectString(i, "kind", where);
  if (i.type !== undefined)
    expectNumber(i, "type", where);
}
function validateExport(exp, where) {
  expect(isRecord(exp), where, `must be an object, got ${describeValue(exp)}`);
  const e = exp;
  expectString(e, "kind", where);
  switch (e.kind) {
    case "lifted-func":
      expectString(e, "name", where);
      expect(isRecord(e.coreDef), where, `.coreDef must be an object`);
      validateCoreDef(e.coreDef, `${where}.coreDef`);
      expectNumber(e, "options", where);
      expectNumber(e, "type", where);
      return;
    case "instance":
      expectString(e, "name", where);
      expectArray(e, "exports", where);
      e.exports.forEach((nested, i) => validateExport(nested, `${where}.exports[${i}]`));
      return;
    case "type":
      expectString(e, "name", where);
      expect(isRecord(e.type), where, `.type must be an object`);
      validateTypeExport(e.type, `${where}.type`);
      return;
    case "module":
      expectString(e, "name", where);
      expectNumber(e, "module", where);
      return;
    default:
      throw new PlanError(`${where}: unknown export kind ${describeValue(e.kind)}`);
  }
}
function validateTypeExport(t, where) {
  expect(isRecord(t), where, `must be an object, got ${describeValue(t)}`);
  const tt = t;
  expectString(tt, "kind", where);
  switch (tt.kind) {
    case "resource":
      expectNumber(tt, "resource", where);
      return;
    case "value":
      expectNumber(tt, "type", where);
      return;
    default:
      throw new PlanError(`${where}: unknown type-export kind ${describeValue(tt.kind)}`);
  }
}
function loadTypeDecl(t, resourceTokens, where) {
  if (t.kind === "func") {
    const decl = t;
    return {
      kind: "func",
      funcType: {
        params: decl.params.map((p) => loadValType(p.type, resourceTokens, `${where}.params.${p.label}`)),
        results: decl.results.map((r, i) => loadValType(r, resourceTokens, `${where}.results[${i}]`)),
        async: decl.async
      },
      paramNames: decl.params.map((p) => p.label)
    };
  }
  return {
    kind: "value",
    type: loadValType(t, resourceTokens, where)
  };
}
function loadValType(t, resourceTokens, where) {
  switch (t.kind) {
    case "bool":
    case "s8":
    case "u8":
    case "s16":
    case "u16":
    case "s32":
    case "u32":
    case "s64":
    case "u64":
    case "f32":
    case "f64":
    case "char":
    case "string":
    case "error-context":
      return { kind: t.kind };
    case "list":
      return {
        kind: "list",
        element: loadValType(t.element, resourceTokens, `${where}.element`),
        ...t.length !== undefined ? { length: t.length } : {}
      };
    case "record":
      return {
        kind: "record",
        fields: t.fields.map((f) => ({
          label: f.label,
          type: loadValType(f.type, resourceTokens, `${where}.${f.label}`)
        }))
      };
    case "tuple":
      return {
        kind: "tuple",
        elements: t.elements.map((e, i) => loadValType(e, resourceTokens, `${where}[${i}]`))
      };
    case "variant":
      return {
        kind: "variant",
        cases: t.cases.map((c) => ({
          label: c.label,
          type: c.type === null ? null : loadValType(c.type, resourceTokens, `${where}.${c.label}`)
        }))
      };
    case "enum":
      return { kind: "enum", labels: [...t.labels] };
    case "option":
      return {
        kind: "option",
        type: loadValType(t.type, resourceTokens, `${where}.some`)
      };
    case "result":
      return {
        kind: "result",
        ok: t.ok === null ? null : loadValType(t.ok, resourceTokens, `${where}.ok`),
        error: t.err === null ? null : loadValType(t.err, resourceTokens, `${where}.err`)
      };
    case "map":
      return {
        kind: "map",
        key: loadValType(t.key, resourceTokens, `${where}.key`),
        value: loadValType(t.value, resourceTokens, `${where}.value`)
      };
    case "flags":
      return { kind: "flags", labels: [...t.labels] };
    case "own":
    case "borrow": {
      const rt = resourceTokens[t.resource];
      if (rt === undefined) {
        throw new PlanError(`${where}: ${t.kind} references resource table ${t.resource}, ` + `but the plan has ${resourceTokens.length} resource tables`);
      }
      return { kind: t.kind, rt };
    }
    case "stream":
    case "future":
      return {
        kind: t.kind,
        element: t.element === null ? null : loadValType(t.element, resourceTokens, `${where}.element`)
      };
    default: {
      const exhaustive = t;
      throw new PlanError(`${where}: unknown ValType kind ${exhaustive.kind}`);
    }
  }
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/shim/translator.js
class Translator {
  #exports;
  buildHash;
  constructor(exports, buildHash) {
    this.#exports = exports;
    this.buildHash = buildHash;
    for (const name of ["memory", "ts_alloc", "ts_dealloc", "ts_translate"]) {
      if (!(name in this.#exports)) {
        throw new PlanError(`shim module missing export '${name}'`);
      }
    }
  }
  static async create(source) {
    let module;
    let buildHash = null;
    if (source instanceof WebAssembly.Module) {
      module = source;
    } else {
      module = await WebAssembly.compile(source.slice().buffer);
      const digest = await crypto.subtle.digest("SHA-256", source.slice().buffer);
      buildHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    const instance = await WebAssembly.instantiate(module, {});
    return new Translator(instance.exports, buildHash);
  }
  static fromExports(exports, opts = {}) {
    return new Translator(exports, opts.buildHash ?? null);
  }
  translate(componentBytes) {
    const json = this.translateRaw(componentBytes);
    const { wire, adapters } = loadEnvelope(json);
    return { plan: wire, adapters, envelopeJson: json };
  }
  translateRaw(componentBytes) {
    const ex = this.#exports;
    const inPtr = ex.ts_alloc(componentBytes.length);
    new Uint8Array(ex.memory.buffer, inPtr, componentBytes.length).set(componentBytes);
    const outLenPtr = ex.ts_alloc(4);
    const outPtr = ex.ts_translate(inPtr, componentBytes.length, outLenPtr);
    const outLen = new DataView(ex.memory.buffer).getUint32(outLenPtr, true);
    const json = new TextDecoder().decode(new Uint8Array(ex.memory.buffer, outPtr, outLen));
    ex.ts_dealloc(outPtr, outLen);
    ex.ts_dealloc(outLenPtr, 4);
    ex.ts_dealloc(inPtr, componentBytes.length);
    return json;
  }
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/protocol@0.3.1@@@1/esm/brands.js
var COMPONENT_EXCEPTION = Symbol.for("polyengine.componentException/1");
var TRAP = Symbol.for("polyengine.trap/1");
var DROPPED = Symbol.for("polyengine.dropped/1");
var PEER_TRAPPED = Symbol.for("polyengine.peerTrapped/1");
var INVALID_HANDLE = Symbol.for("polyengine.invalidHandle/1");
var STREAM_PRODUCER = Symbol.for("polyengine.streamProducer/1");
var SUSPENDING = Symbol.for("polyengine.suspending/1");
var DEFER_CANCEL = Symbol.for("polyengine.deferCancel/1");
var ABORTABLE = Symbol.for("polyengine.abortable/1");
var STREAM = Symbol.for("polyengine.stream/1");
var FUTURE = Symbol.for("polyengine.future/1");
var STREAM_WRITER = Symbol.for("polyengine.streamWriter/1");
var ERROR_CONTEXT = Symbol.for("polyengine.errorContext/1");
var RESOURCE_STATE = Symbol.for("polyengine.resourceState/1");
var POLLABLE = Symbol.for("polyengine.pollable/1");
var WASI_EXIT = Symbol.for("polyengine.wasiExit/1");
var RUNTIME_COPIES = Symbol.for("polyengine.runtimeCopies/1");
var PROTOCOL_GENERATION = 1;
var REALM_LOCAL = "polyengine.realmLocal/1";
function polyengineRealmLocalValue() {}
function defineRealmLocal(target) {
  if (Object.prototype.hasOwnProperty.call(target, REALM_LOCAL))
    return;
  Object.defineProperty(target, REALM_LOCAL, {
    value: polyengineRealmLocalValue,
    enumerable: true,
    writable: false,
    configurable: false
  });
}
function hasBrand(value, brand) {
  if (value === null)
    return false;
  const t = typeof value;
  if (t !== "object" && t !== "function")
    return false;
  return value[brand] === true;
}
function defineBrand(target, brand) {
  if (Object.prototype.hasOwnProperty.call(target, brand))
    return;
  Object.defineProperty(target, brand, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false
  });
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/protocol@0.3.1@@@1/esm/errors.js
class ComponentException extends Error {
  payload;
  constructor(payload, message) {
    super(message ?? `component error: ${describePayload(payload)}`);
    this.name = "ComponentException";
    this.payload = payload;
  }
}
defineBrand(ComponentException.prototype, COMPONENT_EXCEPTION);

class Trap extends Error {
  constructor(message = "canonical ABI trap") {
    super(message);
    this.name = "Trap";
  }
}
defineBrand(Trap.prototype, TRAP);

class DroppedError extends Error {
  constructor(message = "the write end was dropped without a value") {
    super(message);
    this.name = "DroppedError";
  }
}
defineBrand(DroppedError.prototype, DROPPED);

class InvalidHandleError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidHandleError";
  }
}
defineBrand(InvalidHandleError.prototype, INVALID_HANDLE);

class PeerTrappedError extends Error {
  cause;
  progress;
  constructor(where, cause, progress) {
    super(`${where}: the peer component instance trapped, so this ` + `stream/future operation can never complete — ` + `${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "PeerTrappedError";
    this.cause = cause;
    if (progress !== undefined)
      this.progress = progress;
  }
}
defineBrand(PeerTrappedError.prototype, PEER_TRAPPED);

class StreamProducerError extends Error {
  cause;
  constructor(where, cause) {
    super(`${where}: the stream producer failed — ` + `${describeCause(cause)}. The guest's stream is NOT closed cleanly: ` + `the in-flight call fails instead, because a short stream presented ` + `as end-of-stream would be wrong data reported as success.`);
    this.name = "StreamProducerError";
    this.cause = cause;
  }
}
defineBrand(StreamProducerError.prototype, STREAM_PRODUCER);
function isComponentException(v) {
  return hasBrand(v, COMPONENT_EXCEPTION);
}
function isTrap(v) {
  return hasBrand(v, TRAP);
}
function isStreamProducerError(v) {
  return hasBrand(v, STREAM_PRODUCER);
}
function describePayload(p) {
  if (p === null || p === undefined)
    return String(p);
  if (typeof p === "object" && "kind" in p) {
    return String(p.kind);
  }
  if (typeof p === "object")
    return JSON.stringify(p);
  return String(p);
}
function describeCause(e) {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/protocol@0.3.1@@@1/esm/mark_decorator.js
function makeMark(name, adjective, brand) {
  return function mark(fn, context, legacyDescriptor) {
    if (typeof context === "string" || typeof context === "symbol" || legacyDescriptor !== undefined) {
      throw new TypeError(`${name}: legacy (experimentalDecorators) method decoration is not ` + `supported — the decorator would receive the prototype, not the ` + `method. Compile with stage-3 decorators (the default), or use the ` + `call form: \`f: ${name}(fn)\`.`);
    }
    if (context !== undefined) {
      const kind = context.kind;
      if (kind !== "method") {
        throw new TypeError(`${name}: cannot decorate a ${String(kind)} — only methods ` + `(instance or static) can be marked ${adjective}. Constructors are ` + `synchronous by contract; for record-literal imports use the call ` + `form: \`f: ${name}(fn)\`.`);
      }
    }
    if (typeof fn !== "function") {
      throw new TypeError(`${name}: expected a function, got ${typeof fn}`);
    }
    defineBrand(fn, brand);
    return fn;
  };
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/protocol@0.3.1@@@1/esm/abortable.js
var abortable = makeMark("abortable", "abortable", ABORTABLE);
function isAbortable(value) {
  return typeof value === "function" && hasBrand(value, ABORTABLE);
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/protocol@0.3.1@@@1/esm/defer_cancel.js
var deferCancel = makeMark("deferCancel", "cancel-deferring", DEFER_CANCEL);
function isDeferCancel(value) {
  return typeof value === "function" && hasBrand(value, DEFER_CANCEL);
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/protocol@0.3.1@@@1/esm/suspending.js
var suspending = makeMark("suspending", "suspendable", SUSPENDING);
function isSuspending(value) {
  return typeof value === "function" && hasBrand(value, SUSPENDING);
}
function anySuspendingImport(imports) {
  if (imports === undefined)
    return false;
  for (const value of Object.values(imports)) {
    if (isSuspending(value))
      return true;
    if (value !== null && typeof value === "object") {
      for (const member of Object.values(value)) {
        if (isSuspending(member))
          return true;
      }
    }
  }
  return false;
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/protocol@0.3.1@@@1/esm/registry.js
function slot() {
  const g = globalThis;
  const existing = g[RUNTIME_COPIES];
  if (Array.isArray(existing))
    return existing;
  const fresh = [];
  Object.defineProperty(globalThis, RUNTIME_COPIES, {
    value: fresh,
    enumerable: false,
    writable: true,
    configurable: true
  });
  return fresh;
}
function registerRuntimeCopy(entry) {
  const copies = slot();
  for (const c of copies)
    if (c.url === entry.url)
      return copies;
  copies.push(Object.freeze({
    url: entry.url,
    runtimeVersion: entry.runtimeVersion,
    protocolGeneration: entry.protocolGeneration
  }));
  return copies;
}
function copyCensus() {
  const copies = slot();
  if (copies.length <= 1)
    return "";
  return `${copies.length} polyengine copies loaded: ${copies.map((c) => c.url).join(", ")}`;
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/embedder/copy.js
var COPY_URL = import.meta.url;
var RUNTIME_VERSION = "0.6.7";
function describeCrossCopy(what, remedy) {
  const census = copyCensus();
  return `${what} was minted by a DIFFERENT polyengine runtime copy and cannot ` + `be used through this one (this copy: ${COPY_URL}${census === "" ? "" : `; ${census}`}). Handles are stateful — their machinery lives in the copy that minted ` + `them (contracts/embedder-api.md §"Module identity")` + `${remedy === undefined ? "" : `. ${remedy}`}`;
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/trap.js
function trap(message) {
  throw new Trap(message);
}
function trapIf(cond, message) {
  if (cond)
    trap(message);
}

class AssertionError extends Error {
  constructor(message = "internal assertion failed") {
    super(message);
    this.name = "AssertionError";
  }
}
function assert_(cond, message) {
  if (!cond)
    throw new AssertionError(message);
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/memory.js
function ptrSize(ptrType) {
  return ptrType === "i32" ? 4 : 8;
}
function asIndex(v) {
  if (typeof v === "bigint") {
    assert_(v >= 0n && v <= BigInt(Number.MAX_SAFE_INTEGER), "index overflow");
    return Number(v);
  }
  assert_(Number.isSafeInteger(v) && v >= 0, "index not a safe integer");
  return v;
}
function loadIntU(mem, ptr, nbytes) {
  assert_(ptr + nbytes <= mem.length, "load out of bounds");
  switch (nbytes) {
    case 1:
      return mem.view.getUint8(ptr);
    case 2:
      return mem.view.getUint16(ptr, true);
    case 4:
      return mem.view.getUint32(ptr, true);
    case 8:
      return mem.view.getBigUint64(ptr, true);
  }
}
function loadIntS(mem, ptr, nbytes) {
  assert_(ptr + nbytes <= mem.length, "load out of bounds");
  switch (nbytes) {
    case 1:
      return mem.view.getInt8(ptr);
    case 2:
      return mem.view.getInt16(ptr, true);
    case 4:
      return mem.view.getInt32(ptr, true);
    case 8:
      return mem.view.getBigInt64(ptr, true);
  }
}
function loadPtr(mem, ptr) {
  return mem.ptrSize() === 4 ? loadIntU(mem, ptr, 4) : loadIntU(mem, ptr, 8);
}
function bigintFitsIn64(v, signed) {
  return signed ? v >= -(2n ** 63n) && v < 2n ** 63n : v >= 0n && v < 2n ** 64n;
}
function numberFitsInWidth(v, nbytes, signed) {
  const bits = nbytes * 8;
  if (signed) {
    const min = -(2 ** (bits - 1));
    const max = 2 ** (bits - 1) - 1;
    return v >= min && v <= max;
  }
  return v >= 0 && v <= 2 ** bits - 1;
}
function storeInt(mem, v, ptr, nbytes, signed = false) {
  assert_(ptr + nbytes <= mem.length, "store out of bounds");
  if (nbytes === 8) {
    assert_(typeof v === "bigint", "64-bit store requires bigint");
    assert_(bigintFitsIn64(v, signed), "int store: value out of range");
    if (signed)
      mem.view.setBigInt64(ptr, v, true);
    else
      mem.view.setBigUint64(ptr, v, true);
    return;
  }
  assert_(typeof v === "number" && Number.isInteger(v), "int store");
  assert_(numberFitsInWidth(v, nbytes, signed), "int store: value out of range");
  switch (nbytes) {
    case 1:
      if (signed)
        mem.view.setInt8(ptr, v);
      else
        mem.view.setUint8(ptr, v);
      break;
    case 2:
      if (signed)
        mem.view.setInt16(ptr, v, true);
      else
        mem.view.setUint16(ptr, v, true);
      break;
    case 4:
      if (signed)
        mem.view.setInt32(ptr, v, true);
      else
        mem.view.setUint32(ptr, v, true);
      break;
  }
}
function storePtr(mem, v, ptr) {
  if (mem.ptrSize() === 4)
    storeInt(mem, v, ptr, 4);
  else
    storeInt(mem, BigInt(v), ptr, 8);
}
function bytesOf(mem, ptr, len) {
  assert_(ptr >= 0 && len >= 0 && ptr + len <= mem.length, "range OOB");
  return mem.bytes.subarray(ptr, ptr + len);
}
function writeBytes(mem, ptr, src) {
  assert_(ptr >= 0 && ptr + src.length <= mem.length, "write OOB");
  mem.bytes.set(src, ptr);
}
function trapIfRangeExceedsMemory(mem, ptr, byteLength, what = "out of bounds of linear memory") {
  trapIf(BigInt(ptr) + BigInt(byteLength) > BigInt(mem.length), what);
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/layout.js
function alignTo(ptr, alignment) {
  return Math.ceil(ptr / alignment) * alignment;
}
var layoutsI32 = new WeakMap;
var layoutsI64 = new WeakMap;
function layoutOf(t, ptrType) {
  const cache = ptrType === "i32" ? layoutsI32 : layoutsI64;
  const hit = cache.get(t);
  if (hit !== undefined)
    return hit;
  const l = computeLayout(t, ptrType);
  cache.set(t, l);
  return l;
}
function mkLayout(d, align, size, fieldOffsets = null, discSize = 0, payloadOffset = 0) {
  assert_(align > 0 && (align & align - 1) === 0, "layout alignment must be a power of two");
  return Object.freeze({
    d,
    align,
    size,
    fieldOffsets: fieldOffsets === null ? null : Object.freeze(fieldOffsets),
    discSize,
    payloadOffset
  });
}
function computeLayout(t, ptrType) {
  const d = despecialize(t);
  switch (d.kind) {
    case "bool":
    case "s8":
    case "u8":
      return mkLayout(d, 1, 1);
    case "s16":
    case "u16":
      return mkLayout(d, 2, 2);
    case "s32":
    case "u32":
    case "f32":
    case "char":
      return mkLayout(d, 4, 4);
    case "s64":
    case "u64":
    case "f64":
      return mkLayout(d, 8, 8);
    case "string":
      return mkLayout(d, ptrSize(ptrType), 2 * ptrSize(ptrType));
    case "error-context":
      return mkLayout(d, 4, 4);
    case "list": {
      const len = d.length ?? null;
      return mkLayout(d, alignmentList(d.element, len, ptrType), elemSizeList(d.element, len, ptrType));
    }
    case "record":
      return recordLayout(d, d.fields, ptrType);
    case "variant":
      return variantLayout(d, d.cases, ptrType);
    case "flags":
      return mkLayout(d, alignmentFlags(d.labels), elemSizeFlags(d.labels));
    case "own":
    case "borrow":
    case "stream":
    case "future":
      return mkLayout(d, 4, 4);
  }
}
function recordLayout(d, fields, ptrType) {
  const offsets = [];
  let p = 0;
  for (const f of fields) {
    p = alignTo(p, alignment(f.type, ptrType));
    offsets.push(p);
    p += elemSize(f.type, ptrType);
  }
  return mkLayout(d, alignmentRecord(fields, ptrType), elemSizeRecord(fields, ptrType), offsets);
}
function variantLayout(d, cases, ptrType) {
  const discSize = discriminantSize(cases.length);
  return mkLayout(d, alignmentVariant(cases, ptrType), elemSizeVariant(cases, ptrType), null, discSize, alignTo(discSize, maxCaseAlignment(cases, ptrType)));
}
function alignment(t, ptrType) {
  return layoutOf(t, ptrType).align;
}
function alignmentList(elemType, maybeLength, ptrType) {
  if (maybeLength !== null)
    return alignment(elemType, ptrType);
  return ptrSize(ptrType);
}
function alignmentRecord(fields, ptrType) {
  let a = 1;
  for (const f of fields)
    a = Math.max(a, alignment(f.type, ptrType));
  return a;
}
function alignmentVariant(cases, ptrType) {
  return Math.max(discriminantSize(cases.length), maxCaseAlignment(cases, ptrType));
}
function maxCaseAlignment(cases, ptrType) {
  let a = 1;
  for (const c of cases) {
    if (c.type !== null)
      a = Math.max(a, alignment(c.type, ptrType));
  }
  return a;
}
function alignmentFlags(labels) {
  const n = labels.length;
  assert_(0 < n && n <= 32, "flags label count");
  if (n <= 8)
    return 1;
  if (n <= 16)
    return 2;
  return 4;
}
function elemSize(t, ptrType) {
  return layoutOf(t, ptrType).size;
}
function elemSizeList(elemType, maybeLength, ptrType) {
  if (maybeLength !== null)
    return maybeLength * elemSize(elemType, ptrType);
  return 2 * ptrSize(ptrType);
}
function elemSizeRecord(fields, ptrType) {
  let s = 0;
  for (const f of fields) {
    s = alignTo(s, alignment(f.type, ptrType));
    s += elemSize(f.type, ptrType);
  }
  assert_(s > 0, "empty record");
  return alignTo(s, alignmentRecord(fields, ptrType));
}
function elemSizeVariant(cases, ptrType) {
  let s = discriminantSize(cases.length);
  s = alignTo(s, maxCaseAlignment(cases, ptrType));
  let cs = 0;
  for (const c of cases) {
    if (c.type !== null)
      cs = Math.max(cs, elemSize(c.type, ptrType));
  }
  s += cs;
  return alignTo(s, alignmentVariant(cases, ptrType));
}
function elemSizeFlags(labels) {
  const n = labels.length;
  assert_(0 < n && n <= 32, "flags label count");
  if (n <= 8)
    return 1;
  if (n <= 16)
    return 2;
  return 4;
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/float.js
var CANONICAL_FLOAT32_NAN = 2143289344;
var CANONICAL_FLOAT64_NAN = 0x7ff8000000000000n;
var scratch = new DataView(new ArrayBuffer(8));
function coreF32ReinterpretI32(i) {
  scratch.setUint32(0, i, true);
  return scratch.getFloat32(0, true);
}
function coreF64ReinterpretI64(i) {
  scratch.setBigUint64(0, i, true);
  return scratch.getFloat64(0, true);
}
function coreI32ReinterpretF32(f) {
  scratch.setFloat32(0, f, true);
  return scratch.getUint32(0, true);
}
function coreI64ReinterpretF64(f) {
  scratch.setFloat64(0, f, true);
  return scratch.getBigUint64(0, true);
}
function canonicalizeNan32(f) {
  if (Number.isNaN(f))
    return coreF32ReinterpretI32(CANONICAL_FLOAT32_NAN);
  return f;
}
function canonicalizeNan64(f) {
  if (Number.isNaN(f))
    return coreF64ReinterpretI64(CANONICAL_FLOAT64_NAN);
  return f;
}
function decodeI32AsFloat(i) {
  return canonicalizeNan32(coreF32ReinterpretI32(i));
}
function decodeI64AsFloat(i) {
  return canonicalizeNan64(coreF64ReinterpretI64(i));
}
function maybeScrambleNan32(f) {
  if (Number.isNaN(f))
    return coreF32ReinterpretI32(CANONICAL_FLOAT32_NAN);
  return f;
}
function maybeScrambleNan64(f) {
  if (Number.isNaN(f))
    return coreF64ReinterpretI64(CANONICAL_FLOAT64_NAN);
  return f;
}
function encodeFloatAsI32(f) {
  if (Number.isNaN(f))
    return CANONICAL_FLOAT32_NAN;
  return coreI32ReinterpretF32(f);
}
function encodeFloatAsI64(f) {
  if (Number.isNaN(f))
    return CANONICAL_FLOAT64_NAN;
  return coreI64ReinterpretF64(f);
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/context.js
function requireMemory(opts) {
  assert_(opts.memory !== null, "canonical option `memory` required");
  return opts.memory;
}
var COMPONENT_INSTANCE = Symbol("polyengine.ComponentInstance");

class LiftLowerContext {
  opts;
  inst;
  borrowScope;
  constructor(opts, inst = null, borrowScope = null) {
    this.opts = opts;
    this.inst = inst;
    this.borrowScope = borrowScope;
  }
  reallocate(old, oldByteLength, alignment2, newByteLength) {
    const realloc = this.opts.realloc;
    trapIf(realloc === null, "realloc required but not provided");
    if (this.inst === null) {
      return realloc(old, oldByteLength, alignment2, newByteLength);
    }
    assert_(this.inst.mayLeave, "realloc with may_leave already false");
    this.inst.mayLeave = false;
    const ptr = realloc(old, oldByteLength, alignment2, newByteLength);
    this.inst.mayLeave = true;
    return ptr;
  }
  allocate(alignment2, byteLength) {
    return this.reallocate(0, 0, alignment2, byteLength);
  }
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/task/scheduler.js
var CANCELLED_FALSE = false;
var CANCELLED_TRUE = true;

class NeedsJspi extends Error {
  constructor(what) {
    super(`needs JSPI: ${what}`);
    this.name = "NeedsJspi";
  }
}
function needsJspi(what) {
  throw new NeedsJspi(what);
}

class SyncEntryBusy extends Error {
  constructor(what) {
    super(`sync entry refused: ${what} (the component instance has activity in ` + `flight; retry once it settles, or use the Promise-shaped call)`);
    this.name = "SyncEntryBusy";
  }
}

class PendingCapability extends Error {
  constructor(what) {
    super(`pending-capability: ${what}`);
    this.name = "PendingCapability";
  }
}
var onInstancePoisoned = null;
function setOnInstancePoisoned(f) {
  onInstancePoisoned = f;
}
var instancePoisonedListeners = new Set;
function addInstancePoisonedListener(f) {
  instancePoisonedListeners.add(f);
}
function notifyInstancePoisoned(inst, cause) {
  if (!poisonedInstances.has(inst))
    poisonedInstances.set(inst, cause);
  onInstancePoisoned?.(inst, cause);
  for (const f of instancePoisonedListeners)
    f(inst, cause);
}
var poisonedInstances = new WeakMap;
function isInstancePoisoned(inst) {
  return poisonedInstances.has(inst);
}
function withPoisonCause(inst, base) {
  if (!poisonedInstances.has(inst))
    return base;
  const cause = describeCause2(poisonedInstances.get(inst));
  return `${base} — instance poisoned by: ${cause}`;
}
function entryRefusal(callee, caller, base) {
  if (caller !== callee && isInstancePoisoned(callee)) {
    return withPoisonCause(callee, base);
  }
  return null;
}
function describeCause2(cause) {
  try {
    return String(cause);
  } catch {
    return "(unprintable poison cause)";
  }
}
function readSeed() {
  let raw;
  try {
    raw = Deno.env.get("POLYENGINE_SCHED_SEED");
  } catch {
    return null;
  }
  if (raw === undefined || raw === "")
    return null;
  const n = Number(raw);
  if (!Number.isFinite(n))
    return null;
  return Math.trunc(n) >>> 0;
}
var seed = readSeed();
var rngState = 0;
function nextRandom() {
  let x = rngState || 2654435769;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  rngState = x;
  return x;
}
function chooseCandidate(candidates) {
  assert_(candidates.length > 0, "chooseCandidate on an empty candidate set");
  if (seed === null)
    return candidates[0];
  return candidates[nextRandom() % candidates.length];
}
var threadStack = [];
function pushCurrentThread(t) {
  threadStack.push(t);
}
function popCurrentThread(t) {
  const top = threadStack.pop();
  assert_(top === t, "current-thread stack imbalance");
}
function withActivation(t, fn) {
  threadStack.push(t);
  entryStack.push(t);
  try {
    return fn();
  } finally {
    entryStack.pop();
    const top = threadStack.pop();
    assert_(top === t, "withActivation: current-thread stack imbalance");
  }
}
var entryStack = [];
function activationOf() {
  return entryStack[entryStack.length - 1] ?? activationClaims[activationClaims.length - 1] ?? undefined;
}
var activationClaims = [];
function claimActivationAmbient(t) {
  if (t === null || t === undefined)
    return;
  if (AMBIENT_TRACE)
    traceAmbient("claim", t);
  const i = activationClaims.indexOf(t);
  if (i === activationClaims.length - 1 && i !== -1)
    return;
  if (i !== -1)
    activationClaims.splice(i, 1);
  activationClaims.push(t);
}
function traceAmbient(what, t) {
  console.error(`[amb] ${what} ${dbgId(t)} | stack=[${threadStack.map(dbgId).join(",")}] ` + `claims=[${activationClaims.map(dbgId).join(",")}]` + `
${(new Error().stack ?? "").split(`
`).slice(2, 6).join(`
`)}`);
}
var dbgIds = new WeakMap;
var nextDbgId = 1;
function dbgId(t) {
  if (t === null || t === undefined || typeof t !== "object")
    return String(t);
  let id = dbgIds.get(t);
  if (id === undefined) {
    id = nextDbgId++;
    dbgIds.set(t, id);
  }
  return `T${id}`;
}
function releaseActivationAmbient(t) {
  if (t === null || t === undefined)
    return;
  if (AMBIENT_TRACE)
    traceAmbient("release", t);
  let i = activationClaims.indexOf(t);
  if (i === -1) {
    const implicit = t?.task?.implicitThread;
    if (implicit === undefined || implicit === null)
      return;
    i = activationClaims.indexOf(implicit);
    if (i === -1)
      return;
  }
  activationClaims.splice(i, 1);
}
var AMBIENT_TRACE = (() => {
  try {
    return Deno.env.get("CE_AMBIENT_TRACE") === "1";
  } catch {
    return false;
  }
})();
function ambientDebug() {
  return {
    stack: [...threadStack],
    claims: [...activationClaims]
  };
}
function resolveAmbient() {
  return threadStack[threadStack.length - 1] ?? activationClaims[activationClaims.length - 1] ?? undefined;
}
function currentThread() {
  if (AMBIENT_TRACE && threadStack.length === 0) {
    console.error(`[ambient] bracket empty; claims=${activationClaims.length} ` + `head=${activationClaims[0]?.constructor?.name ?? "none"}`);
  }
  const t = resolveAmbient();
  if (t === undefined) {
    throw new PendingCapability("instantiation-time task context — a task-scoped canonical built-in " + "ran outside any task (a core start function calling task.return / " + "task.cancel / thread.yield / subtask.*; see " + "test/async/dont-block-start.wast)");
  }
  return t;
}
function maybeCurrentThread() {
  return resolveAmbient();
}
function currentThreadForInstance(inst) {
  const t = resolveAmbientForInstance(inst);
  if (t !== undefined)
    return t;
  return currentThread();
}
function resolveAmbientForInstance(inst) {
  if (inst === null || inst === undefined)
    return resolveAmbient();
  const top = threadStack[threadStack.length - 1];
  if (top !== undefined && instOf(top) === inst)
    return top;
  for (let i = activationClaims.length - 1;i >= 0; i--) {
    const c = activationClaims[i];
    if (instOf(c) === inst)
      return c;
  }
  return;
}
function instOf(t) {
  return t?.task?.inst;
}
function currentTask() {
  return currentThread().task;
}
function maybeCurrentTask() {
  return maybeCurrentThread()?.task ?? null;
}
class Store {
  waiting = [];
  pendingHostCalls = new Set;
  hostFailure = undefined;
  pendingResumptions = new Set;
  addPendingResumption(t) {
    if (t === null || t === undefined)
      return;
    if (AMBIENT_TRACE)
      traceAmbient("pending+", t);
    this.pendingResumptions.add(t);
  }
  hasPendingResumptions() {
    return this.pendingResumptions.size > 0;
  }
  removePendingResumption(t) {
    if (AMBIENT_TRACE)
      traceAmbient("pending-", t);
    this.pendingResumptions.delete(t);
  }
  consumePendingIfRunning() {
    const a = activationOf();
    if (a !== null && a !== undefined)
      this.pendingResumptions.delete(a);
  }
  releasePendingOf(t) {
    releaseActivationAmbient(t);
    this.pendingResumptions.delete(t);
    const implicit = t?.task?.implicitThread;
    if (implicit !== undefined && implicit !== null) {
      this.pendingResumptions.delete(implicit);
    }
  }
  startWaiting(t) {
    assert_(!this.waiting.includes(t), "thread already in the waiting list");
    this.waiting.push(t);
  }
  stopWaiting(t) {
    const i = this.waiting.indexOf(t);
    assert_(i !== -1, "thread not in the waiting list");
    this.waiting.splice(i, 1);
  }
  readyCandidates() {
    return this.waiting.filter((t) => t.ready() && !isInstancePoisoned(t.task?.inst));
  }
  awaiting = new Set;
  settled = [];
  noteAwaiting(t, promise) {
    this.awaiting.add(t);
    promise.then((value) => {
      this.settled.push({ t, value, failure: undefined });
      this.releasePendingOf(t);
    }, (e) => {
      this.settled.push({ t, value: undefined, failure: { error: e } });
      this.releasePendingOf(t);
    });
  }
  serviceSettled() {
    let did = false;
    scan:
      for (;; ) {
        for (let i = 0;i < this.settled.length; i++) {
          const s = this.settled[i];
          if (!this.awaiting.has(s.t)) {
            this.settled.splice(i, 1);
            continue scan;
          }
          this.settled.splice(i, 1);
          s.t.resumeWith(s.value, s.failure);
          did = true;
          continue scan;
        }
        return did;
      }
  }
  hasServiceableSettled() {
    return this.settled.length > 0;
  }
  hasRunnableWork(inst, excludeTask) {
    const instOf2 = (x) => x?.task?.inst;
    const mine = (x) => instOf2(x) === inst && x?.task !== excludeTask;
    for (const s of this.settled) {
      if (mine(s.t))
        return true;
    }
    for (const w of this.waiting) {
      if (mine(w) && w.ready())
        return true;
    }
    if (this.awaiting.size === 0)
      return false;
    const parked = new Set;
    for (const w of this.waiting) {
      const owner = w.owner;
      if (owner !== undefined && owner !== null)
        parked.add(owner);
    }
    for (const t of this.awaiting) {
      if (mine(t) && !parked.has(t))
        return true;
    }
    return false;
  }
  tick() {
    if (this.pendingResumptions.size > 0)
      return false;
    if (this.hasServiceableSettled())
      return false;
    const candidates = this.readyCandidates();
    if (candidates.length === 0)
      return false;
    const thread = chooseCandidate(candidates);
    const inst = thread.task.inst;
    try {
      thread.resume();
    } catch (e) {
      if (!(e instanceof NeedsJspi) && !(e instanceof PendingCapability)) {
        notifyInstancePoisoned(inst, e);
      }
      throw e;
    }
    return true;
  }
}
var hostActivityArms = new WeakSet;
function markHostActivityArm(p) {
  hostActivityArms.add(p);
}
function hasRealHostCall(store) {
  for (const p of store.pendingHostCalls) {
    if (!hostActivityArms.has(p))
      return true;
  }
  return false;
}
function realHostCalls(store) {
  const out = [];
  for (const p of store.pendingHostCalls) {
    if (!hostActivityArms.has(p))
      out.push(p);
  }
  return out;
}
function storeQuiescent(store) {
  return store.settled.length === 0 && store.awaiting.size === 0 && !hasRealHostCall(store);
}
function driveSyncLift(task) {
  while (task.state !== "resolved") {
    const candidates = [...task.inst.threads].filter((t) => t.ready());
    trapIf(candidates.length === 0, "deadlock: synchronous task cannot resolve and no thread is ready");
    chooseCandidate(candidates).resume();
  }
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/handles.js
class Table {
  static MAX_LENGTH = 2 ** 28 - 1;
  array = [null];
  free = [];
  get(i) {
    trapIf(i < 0 || i >= this.array.length, "table index out of range");
    trapIf(this.array[i] === null, "table entry empty");
    return this.array[i];
  }
  add(e) {
    let i;
    if (this.free.length > 0) {
      i = this.free.pop();
      assert_(this.array[i] === null);
      this.array[i] = e;
    } else {
      i = this.array.length;
      trapIf(i > Table.MAX_LENGTH, "table full");
      this.array.push(e);
    }
    return i;
  }
  remove(i) {
    const e = this.get(i);
    this.array[i] = null;
    this.free.push(i);
    return e;
  }
  *[Symbol.iterator]() {
    for (const e of this.array) {
      if (e !== null)
        yield e;
    }
  }
}

class ResourceHandle {
  rt;
  rep;
  own;
  borrowScope;
  numLends = 0;
  constructor(rt, rep, own, borrowScope = null) {
    this.rt = rt;
    this.rep = rep;
    this.own = own;
    this.borrowScope = borrowScope;
  }
}
function requireInst(cx) {
  assert_(cx.inst !== null, "context requires a component instance");
  return cx.inst;
}
function liftOwn(cx, i, t) {
  const h = requireInst(cx).handles.remove(i);
  trapIf(!(h instanceof ResourceHandle), "not a resource handle");
  const rh = h;
  trapIf(rh.rt !== t.rt, "resource type mismatch");
  trapIf(rh.numLends !== 0, "handle still lent out");
  trapIf(!rh.own, "expected own handle");
  return rh.rep;
}
function liftBorrow(cx, i, t) {
  const scope = cx.borrowScope;
  assert_(scope !== null && typeof scope.addLender === "function", "lifting a borrow requires a subtask borrow scope");
  const h = requireInst(cx).handles.get(i);
  trapIf(!(h instanceof ResourceHandle), "not a resource handle");
  const rh = h;
  trapIf(rh.rt !== t.rt, "resource type mismatch");
  scope.addLender(rh);
  return rh.rep;
}
function lowerOwn(cx, rep, t) {
  const h = new ResourceHandle(t.rt, rep, true);
  return requireInst(cx).handles.add(h);
}
function lowerBorrow(cx, rep, t) {
  const scope = cx.borrowScope;
  assert_(scope !== null && typeof scope.numBorrows === "number", "lowering a borrow requires a task borrow scope");
  if (cx.inst !== null && cx.inst === t.rt.impl) {
    return rep;
  }
  const h = new ResourceHandle(t.rt, rep, false, scope);
  scope.numBorrows += 1;
  return requireInst(cx).handles.add(h);
}
function canonResourceNew(inst, rt, rep) {
  trapIf(!inst.mayLeave, "may_leave violation");
  const h = new ResourceHandle(rt, rep, true);
  return inst.handles.add(h);
}
function isComponentInstance(x) {
  if (x === null || typeof x !== "object")
    return null;
  return x[COMPONENT_INSTANCE] === true ? x : null;
}
function isThenable(v) {
  return typeof v === "object" && v !== null && typeof v.then === "function";
}
function callDtorGated(rt, rep, caller) {
  const impl = isComponentInstance(rt.impl);
  const dtorFn = rt.dtor;
  if (impl === null) {
    const r = dtorFn?.(rep);
    trapIf(isThenable(r), "resource destructor did not complete synchronously");
    return;
  }
  const callerInst = isComponentInstance(caller) === null ? null : caller;
  {
    const refusal = entryRefusal(impl, callerInst, "cannot enter component instance");
    if (refusal !== null)
      trap(refusal);
  }
  const poison = (e) => {
    if (e instanceof NeedsJspi || e instanceof PendingCapability)
      return;
    notifyInstancePoisoned(impl, e);
  };
  let out;
  try {
    out = dtorFn?.(rep);
  } catch (e) {
    poison(e);
    throw e;
  }
  if (isThenable(out)) {
    const e = new Trap("resource destructor did not complete synchronously");
    poison(e);
    throw e;
  }
}
function canonResourceDrop(inst, rt, i) {
  trapIf(!inst.mayLeave, "may_leave violation");
  const h = inst.handles.remove(i);
  trapIf(!(h instanceof ResourceHandle), "not a resource handle");
  const rh = h;
  trapIf(rh.rt !== rt, "resource type mismatch");
  trapIf(rh.numLends !== 0, "handle still lent out");
  if (rh.own) {
    assert_(rh.borrowScope === null);
    callDtorGated(rt, rh.rep, inst);
  } else {
    assert_(rh.borrowScope !== null);
    rh.borrowScope.numBorrows -= 1;
  }
}
function canonResourceRep(inst, rt, i) {
  const h = inst.handles.get(i);
  trapIf(!(h instanceof ResourceHandle), "not a resource handle");
  const rh = h;
  trapIf(rh.rt !== rt, "resource type mismatch");
  return rh.rep;
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/strings.js
var REALLOC_I32_MAX = 2 ** 32 - 1;
var REALLOC_MISALIGNED = "realloc return: result not aligned";
var REALLOC_OOB = "realloc return: beyond end of memory";
var MAX_STRING_BYTE_LENGTH = (1 << 28) - 1;
function utf16TagBig(ptrType) {
  return 1n << BigInt((ptrType === "i32" ? 4 : 8) * 8 - 1);
}
var utf8Decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
var utf16Decoder = new TextDecoder("utf-16le", {
  fatal: true,
  ignoreBOM: true
});
var utf8Encoder = new TextEncoder;
function latin1Decode(bytes) {
  const chunkSize = 8192;
  let s = "";
  for (let i = 0;i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    s += String.fromCharCode(...chunk);
  }
  return s;
}
function toWellFormed(s) {
  return s.toWellFormed();
}
function encodeUtf16Le(s) {
  const wf = toWellFormed(s);
  const out = new Uint8Array(2 * wf.length);
  const view = new DataView(out.buffer);
  for (let i = 0;i < wf.length; i++) {
    view.setUint16(2 * i, wf.charCodeAt(i), true);
  }
  return out;
}
function loadString(cx, ptr) {
  const mem = requireMemory(cx.opts);
  const begin = loadPtr(mem, ptr);
  const taggedCodeUnits = loadPtr(mem, ptr + mem.ptrSize());
  return loadStringFromRange(cx, begin, taggedCodeUnits);
}
function loadStringFromRange(cx, ptr, taggedCodeUnits) {
  const mem = requireMemory(cx.opts);
  const tag = utf16TagBig(mem.ptrType());
  const units = BigInt(taggedCodeUnits);
  let alignment2;
  let byteLengthBig;
  let encoding;
  switch (cx.opts.stringEncoding) {
    case "utf8":
      alignment2 = 1;
      byteLengthBig = units;
      encoding = "utf-8";
      break;
    case "utf16":
      alignment2 = 2;
      byteLengthBig = 2n * units;
      encoding = "utf-16-le";
      break;
    case "latin1+utf16":
      alignment2 = 2;
      if ((units & tag) !== 0n) {
        byteLengthBig = 2n * (units ^ tag);
        encoding = "utf-16-le";
      } else {
        byteLengthBig = units;
        encoding = "latin-1";
      }
      break;
  }
  trapIf(byteLengthBig > BigInt(MAX_STRING_BYTE_LENGTH), "string too long");
  const byteLength = Number(byteLengthBig);
  const ptrBig = BigInt(ptr);
  trapIf(ptrBig % BigInt(alignment2) !== 0n, "misaligned string pointer");
  trapIfRangeExceedsMemory(mem, ptrBig, byteLengthBig, "string pointer/length out of bounds of memory");
  const p = Number(ptrBig);
  const bytes = bytesOf(mem, p, byteLength);
  try {
    switch (encoding) {
      case "utf-8":
        return utf8Decoder.decode(bytes);
      case "utf-16-le":
        return utf16Decoder.decode(bytes);
      case "latin-1":
        return latin1Decode(bytes);
    }
  } catch {
    trap(encoding === "utf-8" ? utf8ErrorMessage(bytes) : "invalid string encoding");
  }
}
function utf8ErrorMessage(bytes) {
  const INVALID = "invalid utf-8";
  const INCOMPLETE = "incomplete utf-8 byte sequence";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 128) {
      i += 1;
      continue;
    }
    let width;
    let loMin = 128;
    let loMax = 191;
    if (b >= 194 && b <= 223) {
      width = 2;
    } else if (b === 224) {
      width = 3;
      loMin = 160;
    } else if (b >= 225 && b <= 236) {
      width = 3;
    } else if (b === 237) {
      width = 3;
      loMax = 159;
    } else if (b >= 238 && b <= 239) {
      width = 3;
    } else if (b === 240) {
      width = 4;
      loMin = 144;
    } else if (b >= 241 && b <= 243) {
      width = 4;
    } else if (b === 244) {
      width = 4;
      loMax = 143;
    } else {
      return INVALID;
    }
    for (let k = 1;k < width; k++) {
      if (i + k >= bytes.length)
        return INCOMPLETE;
      const c = bytes[i + k];
      const min = k === 1 ? loMin : 128;
      const max = k === 1 ? loMax : 191;
      if (c < min || c > max)
        return INVALID;
    }
    i += width;
  }
  return INVALID;
}
function storeString(cx, v, ptr) {
  const mem = requireMemory(cx.opts);
  const [begin, taggedCodeUnits] = storeStringIntoRange(cx, v);
  storeInt(mem, mem.ptrSize() === 4 ? begin : BigInt(begin), ptr, mem.ptrSize());
  storeInt(mem, mem.ptrSize() === 4 ? Number(taggedCodeUnits) : taggedCodeUnits, ptr + mem.ptrSize(), mem.ptrSize());
}
function storeStringIntoRange(cx, src) {
  const srcCodeUnits = src.length;
  switch (cx.opts.stringEncoding) {
    case "utf8":
      return storeUtf16ToUtf8(cx, src, srcCodeUnits);
    case "utf16":
      return storeStringCopyUtf16(cx, src, srcCodeUnits);
    case "latin1+utf16":
      return storeStringToLatin1OrUtf16(cx, src, srcCodeUnits);
  }
}
function storeStringCopyUtf16(cx, src, srcCodeUnits) {
  const mem = requireMemory(cx.opts);
  const dstByteLength = 2 * srcCodeUnits;
  assert_(dstByteLength <= REALLOC_I32_MAX);
  const ptr = cx.allocate(2, dstByteLength);
  trapIf(ptr !== alignTo(ptr, 2), REALLOC_MISALIGNED);
  trapIfRangeExceedsMemory(mem, ptr, dstByteLength, REALLOC_OOB);
  const encoded = encodeUtf16Le(src);
  assert_(dstByteLength === encoded.length);
  writeBytes(mem, ptr, encoded);
  return [ptr, BigInt(srcCodeUnits)];
}
function storeUtf16ToUtf8(cx, src, srcCodeUnits) {
  const worstCaseSize = srcCodeUnits * 3;
  return storeStringToUtf8(cx, src, srcCodeUnits, worstCaseSize);
}
function storeStringToUtf8(cx, src, srcCodeUnits, worstCaseSize) {
  const mem = requireMemory(cx.opts);
  assert_(srcCodeUnits <= REALLOC_I32_MAX);
  let ptr = cx.allocate(1, srcCodeUnits);
  trapIfRangeExceedsMemory(mem, ptr, srcCodeUnits, REALLOC_OOB);
  for (let i = 0;i < src.length; i++) {
    const cu = src.charCodeAt(i);
    if (cu < 128) {
      mem.bytes[ptr + i] = cu;
    } else {
      assert_(worstCaseSize <= REALLOC_I32_MAX);
      ptr = cx.reallocate(ptr, srcCodeUnits, 1, worstCaseSize);
      trapIfRangeExceedsMemory(mem, ptr, worstCaseSize, REALLOC_OOB);
      const encoded = utf8Encoder.encode(src);
      writeBytes(mem, ptr + i, encoded.subarray(i));
      if (worstCaseSize > encoded.length) {
        ptr = cx.reallocate(ptr, worstCaseSize, 1, encoded.length);
        trapIfRangeExceedsMemory(mem, ptr, encoded.length, REALLOC_OOB);
      }
      return [ptr, BigInt(encoded.length)];
    }
  }
  return [ptr, BigInt(srcCodeUnits)];
}
function storeStringToLatin1OrUtf16(cx, src, srcCodeUnits) {
  const mem = requireMemory(cx.opts);
  const wf = toWellFormed(src);
  assert_(srcCodeUnits <= REALLOC_I32_MAX);
  let ptr = cx.allocate(2, srcCodeUnits);
  trapIf(ptr !== alignTo(ptr, 2), REALLOC_MISALIGNED);
  trapIfRangeExceedsMemory(mem, ptr, srcCodeUnits, REALLOC_OOB);
  let dstByteLength = 0;
  for (let i = 0;i < wf.length; i++) {
    const cu = wf.charCodeAt(i);
    if (cu < 1 << 8) {
      mem.bytes[ptr + dstByteLength] = cu;
      dstByteLength += 1;
    } else {
      const worstCaseSize = 2 * srcCodeUnits;
      assert_(worstCaseSize <= REALLOC_I32_MAX);
      ptr = cx.reallocate(ptr, srcCodeUnits, 2, worstCaseSize);
      trapIf(ptr !== alignTo(ptr, 2), REALLOC_MISALIGNED);
      trapIfRangeExceedsMemory(mem, ptr, worstCaseSize, REALLOC_OOB);
      for (let j = dstByteLength - 1;j >= 0; j--) {
        mem.bytes[ptr + 2 * j] = mem.bytes[ptr + j];
        mem.bytes[ptr + 2 * j + 1] = 0;
      }
      const encoded = encodeUtf16Le(wf);
      writeBytes(mem, ptr + 2 * dstByteLength, encoded.subarray(2 * dstByteLength));
      if (worstCaseSize > encoded.length) {
        ptr = cx.reallocate(ptr, worstCaseSize, 2, encoded.length);
        trapIf(ptr !== alignTo(ptr, 2), REALLOC_MISALIGNED);
        trapIfRangeExceedsMemory(mem, ptr, encoded.length, REALLOC_OOB);
      }
      const taggedCodeUnits = BigInt(encoded.length / 2) | utf16TagBig(mem.ptrType());
      return [ptr, taggedCodeUnits];
    }
  }
  if (dstByteLength < srcCodeUnits) {
    ptr = cx.reallocate(ptr, srcCodeUnits, 2, dstByteLength);
    trapIf(ptr !== alignTo(ptr, 2), REALLOC_MISALIGNED);
    trapIfRangeExceedsMemory(mem, ptr, dstByteLength, REALLOC_OOB);
  }
  return [ptr, BigInt(dstByteLength)];
}
function convertI32ToChar(i) {
  assert_(i >= 0);
  trapIf(i >= 1114112, "char out of range");
  trapIf(55296 <= i && i <= 57343, "char is a surrogate");
  return String.fromCodePoint(i);
}
function charToI32(c) {
  const i = c.codePointAt(0);
  assert_(i !== undefined, "empty char");
  assert_(c.length === (i > 65535 ? 2 : 1), "char must be one code point");
  assert_(0 <= i && i <= 55295 || 57344 <= i && i <= 1114111, "char must be a Unicode scalar value");
  return i;
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/bulk_lists.js
var PLATFORM_LITTLE_ENDIAN = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
var INT_CTORS = {
  s8: Int8Array,
  u16: Uint16Array,
  s16: Int16Array,
  u32: Uint32Array,
  s32: Int32Array
};
var BIG_CTORS = {
  u64: BigUint64Array,
  s64: BigInt64Array
};
var FLOAT_CTORS = {
  f32: Float32Array,
  f64: Float64Array
};
function viewOf(ctor, mem, ptr, length) {
  if (!PLATFORM_LITTLE_ENDIAN)
    return null;
  const byteOffset = mem.bytes.byteOffset + ptr;
  if (byteOffset % ctor.BYTES_PER_ELEMENT !== 0)
    return null;
  return new ctor(mem.bytes.buffer, byteOffset, length);
}
function tryLoadNumericList(mem, ptr, length, kind) {
  if (kind === "bool") {
    const out = new Array(length);
    const bytes = bytesOf(mem, ptr, length);
    for (let i = 0;i < length; i++)
      out[i] = bytes[i] !== 0;
    return out;
  }
  const intCtor = INT_CTORS[kind];
  if (intCtor !== undefined) {
    const view = viewOf(intCtor, mem, ptr, length);
    if (view === null)
      return null;
    const out = new Array(length);
    for (let i = 0;i < length; i++)
      out[i] = view[i];
    return out;
  }
  const bigCtor = BIG_CTORS[kind];
  if (bigCtor !== undefined) {
    const view = viewOf(bigCtor, mem, ptr, length);
    if (view === null)
      return null;
    const out = new Array(length);
    for (let i = 0;i < length; i++)
      out[i] = view[i];
    return out;
  }
  const floatCtor = FLOAT_CTORS[kind];
  if (floatCtor !== undefined) {
    const view = viewOf(floatCtor, mem, ptr, length);
    if (view === null)
      return null;
    const out = new Array(length);
    for (let i = 0;i < length; i++) {
      const v = view[i];
      out[i] = v === v ? v : NaN;
    }
    return out;
  }
  return null;
}
function tryStoreNumericList(mem, v, ptr, kind) {
  const n = v.length;
  if (kind === "bool") {
    const bytes = bytesOf(mem, ptr, n);
    for (let i = 0;i < n; i++)
      bytes[i] = v[i] ? 1 : 0;
    return true;
  }
  const intCtor = INT_CTORS[kind];
  if (intCtor !== undefined) {
    const view = viewOf(intCtor, mem, ptr, n);
    if (view === null)
      return false;
    for (let i = 0;i < n; i++) {
      const x = v[i];
      assert_(typeof x === "number" && Number.isInteger(x), "int store");
      view[i] = x;
    }
    return true;
  }
  const bigCtor = BIG_CTORS[kind];
  if (bigCtor !== undefined) {
    const view = viewOf(bigCtor, mem, ptr, n);
    if (view === null)
      return false;
    for (let i = 0;i < n; i++) {
      const x = v[i];
      assert_(typeof x === "bigint", "64-bit store requires bigint");
      view[i] = x;
    }
    return true;
  }
  const floatCtor = FLOAT_CTORS[kind];
  if (floatCtor !== undefined) {
    const view = viewOf(floatCtor, mem, ptr, n);
    if (view === null)
      return false;
    const size = floatCtor.BYTES_PER_ELEMENT;
    for (let i = 0;i < n; i++) {
      const x = v[i];
      if (typeof x === "number" && Number.isNaN(x)) {
        if (size === 4) {
          mem.view.setUint32(ptr + i * 4, CANONICAL_FLOAT32_NAN, true);
        } else {
          mem.view.setBigUint64(ptr + i * 8, CANONICAL_FLOAT64_NAN, true);
        }
      } else {
        view[i] = x;
      }
    }
    return true;
  }
  return false;
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/store.js
function store(cx, v, t, ptr) {
  const mem = requireMemory(cx.opts);
  const L = layoutOf(t, mem.ptrType());
  assert_(ptr % L.align === 0, "store misaligned");
  assert_(ptr + L.size <= mem.length, "store OOB");
  const d = L.d;
  switch (d.kind) {
    case "bool":
      storeInt(mem, Number(Boolean(v)), ptr, 1);
      return;
    case "u8":
      storeInt(mem, v, ptr, 1);
      return;
    case "u16":
      storeInt(mem, v, ptr, 2);
      return;
    case "u32":
      storeInt(mem, v, ptr, 4);
      return;
    case "u64":
      storeInt(mem, v, ptr, 8);
      return;
    case "s8":
      storeInt(mem, v, ptr, 1, true);
      return;
    case "s16":
      storeInt(mem, v, ptr, 2, true);
      return;
    case "s32":
      storeInt(mem, v, ptr, 4, true);
      return;
    case "s64":
      storeInt(mem, v, ptr, 8, true);
      return;
    case "f32":
      storeInt(mem, encodeFloatAsI32(v), ptr, 4);
      return;
    case "f64":
      storeInt(mem, encodeFloatAsI64(v), ptr, 8);
      return;
    case "char":
      storeInt(mem, charToI32(v), ptr, 4);
      return;
    case "string":
      storeString(cx, v, ptr);
      return;
    case "error-context":
      storeInt(mem, lowerErrorContext(cx, v), ptr, 4);
      return;
    case "list":
      storeList(cx, v, ptr, d.element, d.length ?? null);
      return;
    case "record":
      storeRecord(cx, v, ptr, d.fields, L.fieldOffsets);
      return;
    case "variant":
      storeVariant(cx, v, ptr, d.cases, L.discSize, L.payloadOffset);
      return;
    case "flags":
      storeFlags(cx, v, ptr, d.labels);
      return;
    case "own":
      storeInt(mem, lowerOwn(cx, v, d), ptr, 4);
      return;
    case "borrow":
      storeInt(mem, lowerBorrow(cx, v, d), ptr, 4);
      return;
    case "stream":
      storeInt(mem, lowerStream(cx, v, d), ptr, 4);
      return;
    case "future":
      storeInt(mem, lowerFuture(cx, v, d), ptr, 4);
      return;
  }
}
function storeList(cx, v, ptr, elemType, maybeLength) {
  if (maybeLength !== null) {
    assert_(maybeLength === v.length, "fixed-length list length mismatch");
    storeListIntoValidRange(cx, v, ptr, elemType);
    return;
  }
  const mem = requireMemory(cx.opts);
  const [begin, length] = storeListIntoRange(cx, v, elemType);
  storePtr(mem, begin, ptr);
  storePtr(mem, length, ptr + mem.ptrSize());
}
function storeListIntoRange(cx, v, elemType) {
  const mem = requireMemory(cx.opts);
  const { size, align } = layoutOf(elemType, mem.ptrType());
  const byteLength = v.length * size;
  assert_(byteLength <= REALLOC_I32_MAX);
  const ptr = cx.allocate(align, byteLength);
  trapIf(ptr !== alignTo(ptr, align), REALLOC_MISALIGNED);
  trapIf(ptr + byteLength > mem.length, REALLOC_OOB);
  storeListIntoValidRange(cx, v, ptr, elemType);
  return [ptr, v.length];
}
function storeListIntoValidRange(cx, v, ptr, elemType) {
  const mem = requireMemory(cx.opts);
  const L = layoutOf(elemType, mem.ptrType());
  const kind = L.d.kind;
  if (kind === "u8") {
    const dst = bytesOf(mem, ptr, v.length);
    if (v instanceof Uint8Array) {
      dst.set(v);
      return;
    }
    for (let i = 0;i < v.length; i++) {
      const x = v[i];
      assert_(typeof x === "number" && Number.isInteger(x), "int store");
      dst[i] = x;
    }
    return;
  }
  if (tryStoreNumericList(mem, v, ptr, kind))
    return;
  const size = L.size;
  for (let i = 0;i < v.length; i++) {
    store(cx, v[i], elemType, ptr + i * size);
  }
}
function storeRecord(cx, v, ptr, fields, offsets) {
  for (let i = 0;i < fields.length; i++) {
    const f = fields[i];
    store(cx, v[f.label], f.type, ptr + offsets[i]);
  }
}
function matchCase(v, cases) {
  const label = v.kind;
  const i = caseIndexOf(cases).get(label);
  assert_(i !== undefined && i >= 0, `variant case '${label}' not found`);
  return [i, v.value];
}
function storeVariant(cx, v, ptr, cases, discSize, payloadOffset) {
  const mem = requireMemory(cx.opts);
  const [caseIndex, caseValue] = matchCase(v, cases);
  storeInt(mem, caseIndex, ptr, discSize);
  const c = cases[caseIndex];
  if (c.type !== null) {
    store(cx, caseValue, c.type, ptr + payloadOffset);
  }
}
function storeFlags(cx, v, ptr, labels) {
  const mem = requireMemory(cx.opts);
  const i = packFlagsIntoInt(v, labels);
  storeInt(mem, i, ptr, elemSizeFlags(labels));
}
function packFlagsIntoInt(v, labels) {
  let i = 0;
  let shift = 0;
  for (const l of labels) {
    i = (i | (v[l] ? 1 : 0) << shift) >>> 0;
    shift += 1;
  }
  return i;
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/task/waitable.js
var EventCode;
(function(EventCode2) {
  EventCode2[EventCode2["NONE"] = 0] = "NONE";
  EventCode2[EventCode2["SUBTASK"] = 1] = "SUBTASK";
  EventCode2[EventCode2["STREAM_READ"] = 2] = "STREAM_READ";
  EventCode2[EventCode2["STREAM_WRITE"] = 3] = "STREAM_WRITE";
  EventCode2[EventCode2["FUTURE_READ"] = 4] = "FUTURE_READ";
  EventCode2[EventCode2["FUTURE_WRITE"] = 5] = "FUTURE_WRITE";
  EventCode2[EventCode2["TASK_CANCELLED"] = 6] = "TASK_CANCELLED";
})(EventCode || (EventCode = {}));

class Waitable {
  pendingEvent = null;
  wset = null;
  hasSyncWaiter = false;
  setPendingEvent(pendingEvent) {
    this.pendingEvent = pendingEvent;
  }
  hasPendingEvent() {
    return this.pendingEvent !== null;
  }
  inWaitableSet() {
    return this.wset !== null;
  }
  *waitForPendingEvent(thread) {
    assert_(!this.inWaitableSet() && !this.hasSyncWaiter, "waitForPendingEvent on a joined or already-awaited waitable");
    this.hasSyncWaiter = true;
    yield* thread.waitUntil(() => this.hasPendingEvent(), false);
    this.hasSyncWaiter = false;
  }
  getPendingEvent() {
    const pendingEvent = this.pendingEvent;
    assert_(pendingEvent !== null, "getPendingEvent with no pending event");
    this.pendingEvent = null;
    return pendingEvent();
  }
  join(wset) {
    assert_(!this.hasSyncWaiter, "join on a waitable with a sync waiter");
    if (this.wset) {
      const i = this.wset.elems.indexOf(this);
      assert_(i !== -1, "waitable not in its own waitable set");
      this.wset.elems.splice(i, 1);
    }
    this.wset = wset;
    if (wset)
      wset.elems.push(this);
  }
  drop() {
    assert_(!this.hasPendingEvent(), "dropping a waitable with a pending event");
    assert_(!this.hasSyncWaiter, "dropping a waitable with a sync waiter");
    this.join(null);
  }
}
var EV_TRACE = (() => {
  try {
    return Deno.env.get("CE_EVENT_TRACE") === "1";
  } catch {
    return false;
  }
})();

class WaitableSet {
  elems = [];
  numWaiting = 0;
  hasPendingEvent() {
    return this.elems.some((w) => w.hasPendingEvent());
  }
  getPendingEvent() {
    const ready = this.elems.filter((w2) => w2.hasPendingEvent());
    assert_(ready.length > 0, "getPendingEvent on a set with no pending event");
    const w = chooseCandidate(ready);
    assert_(w.wset === this, "waitable/waitable-set back-reference mismatch");
    const ev = w.getPendingEvent();
    if (EV_TRACE) {
      console.error(`[event] deliver code=${ev[0]} idx=${ev[1]} payload=${ev[2]} ` + `readyCount=${ready.length} setSize=${this.elems.length} ` + `chosenPos=${this.elems.indexOf(w)}`);
    }
    return ev;
  }
  *waitForEventAnd(thread, readyFunc, cancellable) {
    this.numWaiting += 1;
    try {
      const cancelled = yield* thread.waitUntil(() => readyFunc() && this.hasPendingEvent(), cancellable);
      return cancelled ? [EventCode.TASK_CANCELLED, 0, 0] : this.getPendingEvent();
    } finally {
      this.numWaiting -= 1;
    }
  }
  *waitForEvent(thread, cancellable) {
    return yield* this.waitForEventAnd(thread, () => true, cancellable);
  }
  poll(task, cancellable) {
    if (task.deliverPendingCancel(cancellable)) {
      return [EventCode.TASK_CANCELLED, 0, 0];
    }
    if (!this.hasPendingEvent())
      return [EventCode.NONE, 0, 0];
    return this.getPendingEvent();
  }
  drop() {
    trapIf(this.elems.length > 0, "cannot drop waitable set with waitables");
    trapIf(this.numWaiting > 0, "cannot drop waitable set with waiters");
  }
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/task/streams.js
function sameElemType(a, b) {
  if (a === null || b === null)
    return a === b;
  return valTypeEqual(a, b);
}
var BUFFER_MAX_LENGTH = 2 ** 28 - 1;
var CopyResult;
(function(CopyResult2) {
  CopyResult2[CopyResult2["COMPLETED"] = 0] = "COMPLETED";
  CopyResult2[CopyResult2["DROPPED"] = 1] = "DROPPED";
  CopyResult2[CopyResult2["CANCELLED"] = 2] = "CANCELLED";
})(CopyResult || (CopyResult = {}));
var CopyState;
(function(CopyState2) {
  CopyState2[CopyState2["IDLE"] = 1] = "IDLE";
  CopyState2[CopyState2["COPYING"] = 2] = "COPYING";
  CopyState2[CopyState2["CANCELLING_COPY"] = 3] = "CANCELLING_COPY";
  CopyState2[CopyState2["DONE"] = 4] = "DONE";
})(CopyState || (CopyState = {}));

class GuestBuffer {
  t;
  cx;
  ptr;
  length;
  progress = 0;
  constructor(t, cx, ptr, length) {
    this.t = t;
    this.cx = cx;
    this.ptr = ptr;
    this.length = length;
    trapIf(length > BUFFER_MAX_LENGTH, "buffer length exceeds MAX_LENGTH");
    if (t !== null && length > 0) {
      const mem = cx.opts.memory;
      assert_(mem !== null, "buffer requires a memory");
      const ptrType = mem.ptrType();
      trapIf(ptr !== alignTo(ptr, alignment(t, ptrType)), "unaligned buffer pointer");
      trapIf(ptr + length * elemSize(t, ptrType) > mem.length, "buffer out of bounds");
    }
  }
  remain() {
    return this.length - this.progress;
  }
  isZeroLength() {
    return this.length === 0;
  }
  read(n) {
    assert_(n <= this.remain(), "buffer read beyond remaining");
    let vs;
    if (this.t !== null) {
      vs = loadListFromValidRange(this.cx, this.ptr, n, this.t);
      this.ptr += n * elemSize(this.t, this.cx.opts.memory.ptrType());
    } else {
      vs = new Array(n).fill(null);
    }
    this.progress += n;
    return vs;
  }
  write(vs) {
    assert_(vs.length <= this.remain(), "buffer write beyond remaining");
    if (this.t !== null) {
      storeListIntoValidRange(this.cx, vs, this.ptr, this.t);
      this.ptr += vs.length * elemSize(this.t, this.cx.opts.memory.ptrType());
    } else {
      assert_(!(vs instanceof Uint8Array) && vs.every((v) => v === null), "zero-width buffer written with a non-empty element");
    }
    this.progress += vs.length;
  }
  byteView(n) {
    assert_(this.t !== null && despecialize(this.t).kind === "u8", "direct byte window on a non-u8 buffer");
    assert_(n <= this.remain(), "direct byte window beyond remaining");
    const mem = this.cx.opts.memory;
    assert_(mem !== null, "direct byte window requires a memory");
    return bytesOf(mem, this.ptr, n);
  }
  advanceBytes(k) {
    assert_(k >= 0 && k <= this.remain(), "direct advance beyond remaining");
    this.ptr += k;
    this.progress += k;
  }
}
function isDirectBuffer(b) {
  return b.direct === true;
}
function rendezvousCopy(src, dst, n) {
  const srcDirect = isDirectBuffer(src);
  const dstDirect = isDirectBuffer(dst);
  if (!srcDirect && !dstDirect) {
    dst.write(src.read(n));
    return "chunk";
  }
  if (srcDirect && dstDirect)
    return "both-direct";
  return srcDirect ? src.runDirect(dst, n) : dst.runDirect(src, n);
}
function bothDirectError() {
  return new TypeError("at least one side of a host-to-host rendezvous must use the chunk " + "forms: two direct-access sessions cannot rendezvous with each other " + "because neither side owns the memory the other would write into " + `(embedder-api.md §"Streams and futures" ("Direct-access byte edges"), polyengine#128)`);
}
function noneOrNumberType(t) {
  if (t === null)
    return true;
  switch (despecialize(t).kind) {
    case "u8":
    case "u16":
    case "u32":
    case "u64":
    case "s8":
    case "s16":
    case "s32":
    case "s64":
    case "f32":
    case "f64":
      return true;
    default:
      return false;
  }
}

class SharedStreamImpl {
  t;
  onLowered = null;
  onLifted = null;
  boundStore = null;
  dropped = false;
  pendingInst = null;
  pendingBuffer = null;
  pendingOnCopy = null;
  pendingOnCopyDone = null;
  #onDropped = [];
  whenDropped(fn) {
    if (this.#onDropped === null) {
      fn();
      return;
    }
    this.#onDropped.push(fn);
  }
  notifyDropped() {
    const fns = this.#onDropped;
    if (fns === null)
      return;
    this.#onDropped = null;
    for (const fn of fns) {
      try {
        fn();
      } catch {}
    }
  }
  constructor(t) {
    this.t = t;
  }
  resetPending() {
    this.setPending(null, null, null, null);
  }
  setPending(inst, buffer, onCopy, onCopyDone) {
    this.pendingInst = inst;
    this.pendingBuffer = buffer;
    this.pendingOnCopy = onCopy;
    this.pendingOnCopyDone = onCopyDone;
  }
  resetAndNotifyPending(result) {
    const done = this.pendingOnCopyDone;
    assert_(done !== null, "reset_and_notify_pending with nothing pending");
    this.resetPending();
    done(result);
  }
  cancel() {
    this.resetAndNotifyPending(CopyResult.CANCELLED);
  }
  drop() {
    if (!this.dropped) {
      this.dropped = true;
      if (this.pendingBuffer)
        this.resetAndNotifyPending(CopyResult.DROPPED);
      this.notifyDropped();
    }
  }
  read(inst, dstBuffer, onCopy, onCopyDone) {
    if (this.dropped) {
      onCopyDone(CopyResult.DROPPED);
    } else if (!this.pendingBuffer) {
      this.setPending(inst, dstBuffer, onCopy, onCopyDone);
    } else {
      this.#assertSameElemType(dstBuffer);
      this.#trapOnSameInstance(inst);
      if (this.pendingBuffer.remain() > 0) {
        if (dstBuffer.remain() > 0) {
          const n = Math.min(dstBuffer.remain(), this.pendingBuffer.remain());
          const pendingIsDirect = isDirectBuffer(this.pendingBuffer);
          const out = rendezvousCopy(this.pendingBuffer, dstBuffer, n);
          if (out === "both-direct") {
            dstBuffer.failDirect(bothDirectError());
            return;
          }
          if (out === "retracted" || out === "failed") {
            this.#routeDirectNoCopy(out, pendingIsDirect, inst, dstBuffer, onCopy, onCopyDone);
            return;
          }
          this.pendingOnCopy(() => this.resetPending());
        }
        onCopyDone(CopyResult.COMPLETED);
      } else {
        this.resetAndNotifyPending(CopyResult.COMPLETED);
        this.setPending(inst, dstBuffer, onCopy, onCopyDone);
      }
    }
  }
  write(inst, srcBuffer, onCopy, onCopyDone) {
    if (this.dropped) {
      onCopyDone(CopyResult.DROPPED);
    } else if (!this.pendingBuffer) {
      this.setPending(inst, srcBuffer, onCopy, onCopyDone);
    } else {
      this.#assertSameElemType(srcBuffer);
      this.#trapOnSameInstance(inst);
      if (this.pendingBuffer.remain() > 0) {
        if (srcBuffer.remain() > 0) {
          const n = Math.min(srcBuffer.remain(), this.pendingBuffer.remain());
          const pendingIsDirect = isDirectBuffer(this.pendingBuffer);
          const out = rendezvousCopy(srcBuffer, this.pendingBuffer, n);
          if (out === "both-direct") {
            srcBuffer.failDirect(bothDirectError());
            return;
          }
          if (out === "retracted" || out === "failed") {
            this.#routeDirectNoCopy(out, pendingIsDirect, inst, srcBuffer, onCopy, onCopyDone);
            return;
          }
          this.pendingOnCopy(() => this.resetPending());
        }
        onCopyDone(CopyResult.COMPLETED);
      } else if (srcBuffer.isZeroLength() && this.pendingBuffer.isZeroLength()) {
        onCopyDone(CopyResult.COMPLETED);
      } else {
        this.resetAndNotifyPending(CopyResult.COMPLETED);
        this.setPending(inst, srcBuffer, onCopy, onCopyDone);
      }
    }
  }
  #routeDirectNoCopy(out, pendingIsDirect, inst, arriving, onCopy, onCopyDone) {
    if (pendingIsDirect) {
      if (out === "retracted")
        this.resetAndNotifyPending(CopyResult.COMPLETED);
      else
        this.resetPending();
      this.setPending(inst, arriving, onCopy, onCopyDone);
      return;
    }
    if (out === "retracted")
      onCopyDone(CopyResult.COMPLETED);
  }
  #assertSameElemType(b) {
    assert_(sameElemType(this.t, b.t) && sameElemType(b.t, this.pendingBuffer.t), "stream element type mismatch between ends");
  }
  #trapOnSameInstance(inst) {
    trapIf(inst === this.pendingInst && !noneOrNumberType(this.t), "cannot read from and write to intra-component stream");
  }
}

class SharedFutureImpl {
  t;
  onLowered = null;
  onLifted = null;
  boundStore = null;
  dropped = false;
  abandonReason = null;
  pendingInst = null;
  pendingBuffer = null;
  pendingOnCopyDone = null;
  #onDropped = [];
  whenDropped(fn) {
    if (this.#onDropped === null) {
      fn();
      return;
    }
    this.#onDropped.push(fn);
  }
  notifyDropped() {
    const fns = this.#onDropped;
    if (fns === null)
      return;
    this.#onDropped = null;
    for (const fn of fns) {
      try {
        fn();
      } catch {}
    }
  }
  constructor(t) {
    this.t = t;
  }
  resetPending() {
    this.setPending(null, null, null);
  }
  setPending(inst, buffer, onCopyDone) {
    this.pendingInst = inst;
    this.pendingBuffer = buffer;
    this.pendingOnCopyDone = onCopyDone;
  }
  resetAndNotifyPending(result) {
    const done = this.pendingOnCopyDone;
    assert_(done !== null, "reset_and_notify_pending with nothing pending");
    this.resetPending();
    done(result);
  }
  cancel() {
    this.resetAndNotifyPending(CopyResult.CANCELLED);
  }
  drop() {
    if (!this.dropped) {
      this.dropped = true;
      if (this.pendingBuffer)
        this.resetAndNotifyPending(CopyResult.DROPPED);
      this.notifyDropped();
    }
  }
  read(inst, dstBuffer, onCopyDone) {
    if (this.dropped && this.abandonReason !== null) {
      throw futureAbandonTrap(this.abandonReason);
    }
    assert_(!this.dropped && dstBuffer.remain() === 1, "future read shape");
    if (!this.pendingBuffer) {
      this.setPending(inst, dstBuffer, onCopyDone);
    } else {
      trapIf(inst === this.pendingInst && !noneOrNumberType(this.t), "cannot read from and write to intra-component future");
      dstBuffer.write(this.pendingBuffer.read(1));
      this.resetAndNotifyPending(CopyResult.COMPLETED);
      onCopyDone(CopyResult.COMPLETED);
    }
  }
  write(inst, srcBuffer, onCopyDone) {
    assert_(srcBuffer.remain() === 1, "future write shape");
    if (this.dropped) {
      onCopyDone(CopyResult.DROPPED);
    } else if (!this.pendingBuffer) {
      this.setPending(inst, srcBuffer, onCopyDone);
    } else {
      trapIf(inst === this.pendingInst && !noneOrNumberType(this.t), "cannot read from and write to intra-component future");
      this.pendingBuffer.write(srcBuffer.read(1));
      this.resetAndNotifyPending(CopyResult.COMPLETED);
      onCopyDone(CopyResult.COMPLETED);
    }
  }
}

class CopyEnd extends Waitable {
  shared;
  state = CopyState.IDLE;
  constructor(shared) {
    super();
    this.shared = shared;
  }
  copying() {
    return this.state === CopyState.COPYING || this.state === CopyState.CANCELLING_COPY;
  }
  drop() {
    trapIf(this.copying(), this.side === "readable" ? `cannot remove busy ${this.kind}` : `cannot drop busy ${this.kind}`);
    this.shared.drop();
    super.drop();
  }
}

class ReadableStreamEnd extends CopyEnd {
  kind = "stream";
  side = "readable";
  copy(inst, dst, onCopy, onCopyDone) {
    this.shared.read(inst, dst, onCopy, onCopyDone);
  }
}

class WritableStreamEnd extends CopyEnd {
  kind = "stream";
  side = "writable";
  copy(inst, src, onCopy, onCopyDone) {
    this.shared.write(inst, src, onCopy, onCopyDone);
  }
}

class ReadableFutureEnd extends CopyEnd {
  kind = "future";
  side = "readable";
  copy(inst, dst, onCopyDone) {
    this.shared.read(inst, dst, onCopyDone);
  }
}

class WritableFutureEnd extends CopyEnd {
  kind = "future";
  side = "writable";
  copy(inst, src, onCopyDone) {
    this.shared.write(inst, src, onCopyDone);
  }
  drop() {
    trapIf(this.state !== CopyState.DONE, "cannot drop future write end without first writing a value");
    super.drop();
  }
}
var poisonFailures = new WeakMap;
function poisonFailureOf(shared) {
  return typeof shared === "object" && shared !== null ? poisonFailures.get(shared) : undefined;
}
var retiredInstances = new WeakSet;
function futureAbandonTrap(reason) {
  const t = new Trap(`future.read can never complete: ${reason.message}`);
  t.cause = reason;
  return t;
}
function abandonReasonOf(shared) {
  return shared instanceof SharedFutureImpl ? shared.abandonReason : null;
}
function abandonSharedFuture(shared, reason) {
  if (shared.dropped)
    return;
  shared.abandonReason ??= reason;
  dropSharedForTeardown(shared);
}
function dropSharedForTeardown(shared) {
  if (shared.dropped)
    return;
  shared.dropped = true;
  if (shared.pendingBuffer) {
    const pi = shared.pendingInst;
    const parkedInDeadGuest = typeof pi === "object" && pi !== null && (isInstancePoisoned(pi) || retiredInstances.has(pi));
    if (parkedInDeadGuest)
      shared.resetPending();
    else
      shared.resetAndNotifyPending(CopyResult.DROPPED);
  }
  shared.notifyDropped();
}
function retireInstanceAsyncEnds(inst, cause) {
  if (retiredInstances.has(inst))
    return;
  retiredInstances.add(inst);
  const where = inst.index !== undefined ? `component instance ${inst.index}` : "a component instance";
  const ends = [];
  for (const e of inst.handles)
    if (e instanceof CopyEnd)
      ends.push(e);
  for (const e of ends) {
    const shared = e.shared;
    if (poisonFailures.get(shared) === undefined) {
      poisonFailures.set(shared, new Error(`${where} trapped while it held an end of this stream/future; ` + `the peer can never rendezvous again`, { cause }));
    }
    if (e instanceof WritableFutureEnd && shared instanceof SharedFutureImpl && e.state !== CopyState.DONE && !shared.dropped) {
      shared.abandonReason ??= poisonFailures.get(shared);
    }
  }
  let first;
  let failed = false;
  for (const e of ends) {
    try {
      dropSharedForTeardown(e.shared);
    } catch (err) {
      if (!failed) {
        failed = true;
        first = err;
      }
    }
  }
  if (failed)
    throw first;
}
setOnInstancePoisoned(retireInstanceAsyncEnds);

class ErrorContext {
  debugMessage;
  constructor(debugMessage) {
    this.debugMessage = debugMessage;
  }
}
defineBrand(ErrorContext.prototype, ERROR_CONTEXT);

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/async_values.js
function errorContextTrapMessage(where, e) {
  if (!hasBrand(e, ERROR_CONTEXT)) {
    return `${where}: handle is not an error-context`;
  }
  const census = copyCensus();
  return `${where}: this error-context was minted by a DIFFERENT polyengine ` + `runtime copy and cannot be used through this one` + `${census === "" ? "" : ` (${census})`} ` + `(contracts/embedder-api.md §"Module identity")`;
}
function containsBorrow(t) {
  return contains(t, (x) => x.kind === "borrow");
}
function liftAsyncValue(cx, i, t, EndT, elem, what) {
  assert_(!containsBorrow(t), `${what} may not contain a borrow`);
  const inst = cx.inst;
  assert_(inst !== null, `${what} lift requires a component instance`);
  const e = inst.handles.remove(i);
  trapIf(!(e instanceof EndT), `${what} lift: handle is not a ${what} end`);
  const end = e;
  trapIf(!sameElemType(end.shared.t, elem), `${what} lift: element type mismatch`);
  trapIf(end.state === CopyState.DONE, what === "future" ? "cannot lift future after previous read succeeded" : "cannot lift stream after being notified that the writable end dropped");
  trapIf(end.state !== CopyState.IDLE, `cannot remove busy ${what}`);
  trapIf(end.inWaitableSet(), `cannot lift ${what} while it's in a waitable set`);
  const holder = end.shared;
  const store2 = inst.store;
  if (holder.boundStore != null && store2 != null) {
    const census = copyCensus();
    assert_(holder.boundStore === store2, `${what} crossed into a second store; multi-store is unsupported` + (census === "" ? "" : ` (${census} — a value from one copy cannot be lowered through ` + `another)`));
  }
  holder.boundStore ??= store2;
  end.shared.onLifted?.(inst);
  return end.shared;
}
function liftStream(cx, i, t) {
  return liftAsyncValue(cx, i, t, ReadableStreamEnd, t.element, "stream");
}
function liftFuture(cx, i, t) {
  return liftAsyncValue(cx, i, t, ReadableFutureEnd, t.element, "future");
}
function lowerStream(cx, v, t) {
  assert_(v instanceof SharedStreamImpl, "lower_stream expects a shared stream value");
  assert_(!containsBorrow(t), "stream may not contain a borrow");
  const declared = t.element ?? null;
  if (!sameElemType(v.t, declared)) {
    assert_(false, `stream element type mismatch: host end carries ` + `${fmtValType(v.t)}, callee expects ${fmtValType(declared)}`);
  }
  const inst = cx.inst;
  assert_(inst !== null, "stream lower requires a component instance");
  v.boundStore ??= inst.store;
  v.onLowered?.(inst);
  return inst.handles.add(new ReadableStreamEnd(v));
}
function lowerFuture(cx, v, t) {
  assert_(v instanceof SharedFutureImpl, "lower_future expects a shared future value");
  assert_(!containsBorrow(t), "future may not contain a borrow");
  const declared = t.element ?? null;
  if (!sameElemType(v.t, declared)) {
    assert_(false, `future element type mismatch: host end carries ` + `${fmtValType(v.t)}, callee expects ${fmtValType(declared)}`);
  }
  const inst = cx.inst;
  assert_(inst !== null, "future lower requires a component instance");
  v.boundStore ??= inst.store;
  v.onLowered?.(inst);
  return inst.handles.add(new ReadableFutureEnd(v));
}
function liftErrorContext(cx, i) {
  const inst = cx.inst;
  assert_(inst !== null, "error-context lift requires a component instance");
  const e = inst.handles.get(i);
  trapIf(!(e instanceof ErrorContext), errorContextTrapMessage("error-context lift", e));
  return e;
}
function lowerErrorContext(cx, v) {
  const inst = cx.inst;
  assert_(inst !== null, "error-context lower requires a component instance");
  return inst.handles.add(v);
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/load.js
var MAX_LIST_BYTE_LENGTH = (1 << 28) - 1;
function load(cx, ptr, t) {
  const mem = requireMemory(cx.opts);
  const L = layoutOf(t, mem.ptrType());
  assert_(ptr % L.align === 0, "load misaligned");
  assert_(ptr + L.size <= mem.length, "load OOB");
  const d = L.d;
  switch (d.kind) {
    case "bool":
      return convertIntToBool(loadIntU(mem, ptr, 1));
    case "u8":
      return loadIntU(mem, ptr, 1);
    case "u16":
      return loadIntU(mem, ptr, 2);
    case "u32":
      return loadIntU(mem, ptr, 4);
    case "u64":
      return loadIntU(mem, ptr, 8);
    case "s8":
      return loadIntS(mem, ptr, 1);
    case "s16":
      return loadIntS(mem, ptr, 2);
    case "s32":
      return loadIntS(mem, ptr, 4);
    case "s64":
      return loadIntS(mem, ptr, 8);
    case "f32":
      return decodeI32AsFloat(loadIntU(mem, ptr, 4));
    case "f64":
      return decodeI64AsFloat(loadIntU(mem, ptr, 8));
    case "char":
      return convertI32ToChar(loadIntU(mem, ptr, 4));
    case "string":
      return loadString(cx, ptr);
    case "error-context":
      return liftErrorContext(cx, loadIntU(cx.opts.memory, ptr, 4));
    case "list":
      return loadList(cx, ptr, d.element, d.length ?? null);
    case "record":
      return loadRecord(cx, ptr, d.fields, L.fieldOffsets);
    case "variant":
      return loadVariant(cx, ptr, d.cases, L.discSize, L.payloadOffset);
    case "flags":
      return loadFlags(cx, ptr, d.labels);
    case "own":
      return liftOwn(cx, loadIntU(mem, ptr, 4), d);
    case "borrow":
      return liftBorrow(cx, loadIntU(mem, ptr, 4), d);
    case "stream":
      return liftStream(cx, loadIntU(cx.opts.memory, ptr, 4), d);
    case "future":
      return liftFuture(cx, loadIntU(cx.opts.memory, ptr, 4), d);
  }
}
function convertIntToBool(i) {
  assert_(i >= 0);
  return Boolean(i);
}
function loadList(cx, ptr, elemType, maybeLength) {
  if (maybeLength !== null) {
    return loadListFromValidRange(cx, ptr, maybeLength, elemType);
  }
  const mem = requireMemory(cx.opts);
  const begin = loadPtr(mem, ptr);
  const length = loadPtr(mem, ptr + mem.ptrSize());
  return loadListFromRange(cx, begin, length, elemType);
}
function loadListFromRange(cx, ptr, length, elemType) {
  const mem = requireMemory(cx.opts);
  const { size, align } = layoutOf(elemType, mem.ptrType());
  const byteLengthBig = BigInt(length) * BigInt(size);
  trapIf(byteLengthBig > BigInt(MAX_LIST_BYTE_LENGTH), "list too long");
  const ptrBig = BigInt(ptr);
  trapIf(ptrBig % BigInt(align) !== 0n, "misaligned list pointer");
  trapIf(ptrBig + byteLengthBig > BigInt(mem.length), "list out of bounds");
  return loadListFromValidRange(cx, Number(ptrBig), Number(length), elemType);
}
function loadListFromValidRange(cx, ptr, length, elemType) {
  const mem = requireMemory(cx.opts);
  const L = layoutOf(elemType, mem.ptrType());
  const kind = L.d.kind;
  if (kind === "u8") {
    return bytesOf(mem, ptr, length).slice();
  }
  const bulk = tryLoadNumericList(mem, ptr, length, kind);
  if (bulk !== null)
    return bulk;
  const size = L.size;
  const a = [];
  for (let i = 0;i < length; i++) {
    a.push(load(cx, ptr + i * size, elemType));
  }
  return a;
}
function loadRecord(cx, ptr, fields, offsets) {
  const record = {};
  for (let i = 0;i < fields.length; i++) {
    const field = fields[i];
    record[field.label] = load(cx, ptr + offsets[i], field.type);
  }
  return record;
}
function loadVariant(cx, ptr, cases, discSize, payloadOffset) {
  const mem = requireMemory(cx.opts);
  const caseIndex = loadIntU(mem, ptr, discSize);
  trapIf(caseIndex >= cases.length, "invalid variant discriminant");
  const c = cases[caseIndex];
  if (c.type === null)
    return { kind: c.label, value: null };
  return { kind: c.label, value: load(cx, ptr + payloadOffset, c.type) };
}
function loadFlags(cx, ptr, labels) {
  const mem = requireMemory(cx.opts);
  const i = loadIntU(mem, ptr, elemSizeFlags(labels));
  return unpackFlagsFromInt(i, labels);
}
function unpackFlagsFromInt(i, labels) {
  const record = {};
  let v = i >>> 0;
  for (const l of labels) {
    record[l] = Boolean(v & 1);
    v = v >>> 1;
  }
  return record;
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/flatten.js
var MAX_FLAT_PARAMS = 16;
var MAX_FLAT_ASYNC_PARAMS = 4;
var MAX_FLAT_RESULTS = 1;
function flattenFunctype(opts, ft, context) {
  let flatParams = flattenTypes(ft.params, opts);
  let flatResults = flattenTypes(ft.results, opts);
  if (!opts.async_) {
    if (flatParams.length > MAX_FLAT_PARAMS) {
      flatParams = [requireMemory(opts).ptrType()];
    }
    if (flatResults.length > MAX_FLAT_RESULTS) {
      switch (context) {
        case "lift":
          flatResults = [requireMemory(opts).ptrType()];
          break;
        case "lower":
          flatParams = [...flatParams, requireMemory(opts).ptrType()];
          flatResults = [];
          break;
      }
    }
    return { params: flatParams, results: flatResults };
  } else {
    switch (context) {
      case "lift":
        if (flatParams.length > MAX_FLAT_PARAMS) {
          flatParams = [requireMemory(opts).ptrType()];
        }
        if (opts.callback) {
          flatResults = ["i32"];
        } else {
          flatResults = [];
        }
        break;
      case "lower":
        if (flatParams.length > MAX_FLAT_ASYNC_PARAMS) {
          flatParams = [requireMemory(opts).ptrType()];
        }
        if (flatResults.length > 0) {
          flatParams = [...flatParams, requireMemory(opts).ptrType()];
        }
        flatResults = ["i32"];
        break;
    }
    return { params: flatParams, results: flatResults };
  }
}
function flattenTypes(ts, opts) {
  return ts.flatMap((t) => flattenType(t, opts));
}
var flatCountCacheByPtrType = {
  i32: new WeakMap,
  i64: new WeakMap
};
function flatCount(ts, opts) {
  const mem = opts.memory;
  if (mem === null)
    return flattenTypes(ts, opts).length;
  const cache = flatCountCacheByPtrType[mem.ptrType()];
  const hit = cache.get(ts);
  if (hit !== undefined)
    return hit;
  const count = flattenTypes(ts, opts).length;
  cache.set(ts, count);
  return count;
}
function flattenType(t, opts) {
  const d = despecialize(t);
  switch (d.kind) {
    case "bool":
    case "u8":
    case "u16":
    case "u32":
    case "s8":
    case "s16":
    case "s32":
    case "char":
      return ["i32"];
    case "s64":
    case "u64":
      return ["i64"];
    case "f32":
      return ["f32"];
    case "f64":
      return ["f64"];
    case "string": {
      const pt = requireMemory(opts).ptrType();
      return [pt, pt];
    }
    case "error-context":
      return ["i32"];
    case "list":
      return flattenList(d.element, d.length ?? null, opts);
    case "record":
      return flattenRecord(d.fields, opts);
    case "variant":
      return flattenVariant(d.cases, opts);
    case "flags":
      return ["i32"];
    case "own":
    case "borrow":
    case "stream":
    case "future":
      return ["i32"];
  }
}
function flattenList(elemType, maybeLength, opts) {
  if (maybeLength !== null) {
    const flat = [];
    const one = flattenType(elemType, opts);
    for (let i = 0;i < maybeLength; i++)
      flat.push(...one);
    return flat;
  }
  const pt = requireMemory(opts).ptrType();
  return [pt, pt];
}
function flattenRecord(fields, opts) {
  const flat = [];
  for (const f of fields)
    flat.push(...flattenType(f.type, opts));
  return flat;
}
function flattenVariant(cases, opts) {
  const flat = [];
  for (const c of cases) {
    if (c.type !== null) {
      flattenType(c.type, opts).forEach((ft, i) => {
        if (i < flat.length) {
          flat[i] = join(flat[i], ft);
        } else {
          flat.push(ft);
        }
      });
    }
  }
  return [...flattenType(discriminantType(cases), opts), ...flat];
}
function join(a, b) {
  if (a === b)
    return a;
  if (a === "i32" && b === "f32" || a === "f32" && b === "i32") {
    return "i32";
  }
  return "i64";
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/lift.js
class CoreValueIter {
  values;
  i = 0;
  constructor(values) {
    this.values = values;
  }
  next(t) {
    const v = this.values[this.i];
    this.i += 1;
    switch (t) {
      case "i32":
        assert_(typeof v === "number" && Number.isInteger(v) && 0 <= v && v < 2 ** 32, "expected canonical i32 lane value");
        break;
      case "i64":
        assert_(typeof v === "bigint" && 0n <= v && v < 1n << 64n, "expected canonical i64 lane value");
        break;
      case "f32":
      case "f64":
        assert_(typeof v === "number", "expected float lane value");
        break;
    }
    return v;
  }
  done() {
    return this.i === this.values.length;
  }
}
function liftFlat(cx, vi, t) {
  const d = despecialize(t);
  switch (d.kind) {
    case "bool":
      return convertIntToBool(vi.next("i32"));
    case "u8":
      return liftFlatUnsigned32(vi, 8);
    case "u16":
      return liftFlatUnsigned32(vi, 16);
    case "u32":
      return liftFlatUnsigned32(vi, 32);
    case "u64":
      return liftFlatUnsigned64(vi);
    case "s8":
      return liftFlatSigned32(vi, 8);
    case "s16":
      return liftFlatSigned32(vi, 16);
    case "s32":
      return liftFlatSigned32(vi, 32);
    case "s64":
      return liftFlatSigned64(vi);
    case "f32":
      return canonicalizeNan32(vi.next("f32"));
    case "f64":
      return canonicalizeNan64(vi.next("f64"));
    case "char":
      return convertI32ToChar(vi.next("i32"));
    case "string":
      return liftFlatString(cx, vi);
    case "error-context":
      return liftErrorContext(cx, vi.next("i32"));
    case "list":
      return liftFlatList(cx, vi, d.element, d.length ?? null);
    case "record":
      return liftFlatRecord(cx, vi, d.fields);
    case "variant":
      return liftFlatVariant(cx, vi, d.cases);
    case "flags":
      return liftFlatFlags(vi, d.labels);
    case "own":
      return liftOwn(cx, vi.next("i32"), d);
    case "borrow":
      return liftBorrow(cx, vi.next("i32"), d);
    case "stream":
      return liftStream(cx, vi.next("i32"), d);
    case "future":
      return liftFuture(cx, vi.next("i32"), d);
  }
}
function liftFlatUnsigned32(vi, tWidth) {
  const i = vi.next("i32");
  assert_(0 <= i && i < 2 ** 32);
  return i % 2 ** tWidth;
}
function liftFlatUnsigned64(vi) {
  const i = vi.next("i64");
  assert_(0n <= i && i < 1n << 64n);
  return i;
}
function liftFlatSigned32(vi, tWidth) {
  const i0 = vi.next("i32");
  assert_(0 <= i0 && i0 < 2 ** 32);
  const i = i0 % 2 ** tWidth;
  if (i >= 2 ** (tWidth - 1)) {
    return i - 2 ** tWidth;
  }
  return i;
}
function liftFlatSigned64(vi) {
  const i = vi.next("i64");
  assert_(0n <= i && i < 1n << 64n);
  if (i >= 1n << 63n) {
    return i - (1n << 64n);
  }
  return i;
}
function liftFlatString(cx, vi) {
  const ptrType = requireMemory(cx.opts).ptrType();
  const ptr = vi.next(ptrType);
  const packedLength = vi.next(ptrType);
  return loadStringFromRange(cx, ptr, packedLength);
}
function liftFlatList(cx, vi, elemType, maybeLength) {
  if (maybeLength !== null) {
    const a = [];
    for (let i = 0;i < maybeLength; i++) {
      a.push(liftFlat(cx, vi, elemType));
    }
    if (despecialize(elemType).kind === "u8") {
      return Uint8Array.from(a);
    }
    return a;
  }
  const ptrType = requireMemory(cx.opts).ptrType();
  const ptr = vi.next(ptrType);
  const length = vi.next(ptrType);
  return loadListFromRange(cx, ptr, length, elemType);
}
function liftFlatRecord(cx, vi, fields) {
  const record = {};
  for (const f of fields) {
    record[f.label] = liftFlat(cx, vi, f.type);
  }
  return record;
}
function liftFlatVariant(cx, vi, cases) {
  const flatTypes = flattenVariant(cases, cx.opts);
  assert_(flatTypes.shift() === "i32");
  const caseIndex = vi.next("i32");
  trapIf(caseIndex >= cases.length, "invalid variant discriminant");
  const coerceIter = {
    next(want) {
      const have = flatTypes.shift();
      const x = vi.next(have);
      if (have === "i32" && want === "f32") {
        return decodeI32AsFloat(x);
      } else if (have === "i64" && want === "i32") {
        return wrapI64ToI32(x);
      } else if (have === "i64" && want === "f32") {
        return decodeI32AsFloat(wrapI64ToI32(x));
      } else if (have === "i64" && want === "f64") {
        return decodeI64AsFloat(x);
      } else {
        assert_(have === want, `lane mismatch ${have} -> ${want}`);
        return x;
      }
    }
  };
  const c = cases[caseIndex];
  let v;
  if (c.type === null) {
    v = null;
  } else {
    v = liftFlat(cx, coerceIter, c.type);
  }
  for (const have of flatTypes) {
    vi.next(have);
  }
  return { kind: c.label, value: v };
}
function wrapI64ToI32(i) {
  assert_(0n <= i && i < 1n << 64n);
  return Number(i & 0xffffffffn);
}
function liftFlatFlags(vi, labels) {
  assert_(0 < labels.length && labels.length <= 32);
  const i = vi.next("i32");
  return unpackFlagsFromInt(i, labels);
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/lower.js
function lowerFlat(cx, v, t) {
  const d = despecialize(t);
  switch (d.kind) {
    case "bool":
      return [Number(v)];
    case "u8":
    case "u16":
    case "u32":
      return [v];
    case "u64":
      return [v];
    case "s8":
    case "s16":
    case "s32":
      return lowerFlatSigned32(v);
    case "s64":
      return lowerFlatSigned64(v);
    case "f32":
      return [maybeScrambleNan32(v)];
    case "f64":
      return [maybeScrambleNan64(v)];
    case "char":
      return [charToI32(v)];
    case "string":
      return lowerFlatString(cx, v);
    case "error-context":
      return [lowerErrorContext(cx, v)];
    case "list":
      return lowerFlatList(cx, v, d.element, d.length ?? null);
    case "record":
      return lowerFlatRecord(cx, v, d.fields);
    case "variant":
      return lowerFlatVariant(cx, v, d.cases);
    case "flags":
      return lowerFlatFlags(v, d.labels);
    case "own":
      return [lowerOwn(cx, v, d)];
    case "borrow":
      return [lowerBorrow(cx, v, d)];
    case "stream":
      return [lowerStream(cx, v, d)];
    case "future":
      return [lowerFuture(cx, v, d)];
  }
}
function lowerFlatSigned32(i) {
  if (i < 0) {
    return [i + 2 ** 32];
  }
  return [i];
}
function lowerFlatSigned64(i) {
  if (i < 0n) {
    return [i + (1n << 64n)];
  }
  return [i];
}
function lowerFlatString(cx, v) {
  const [ptr, packedLength] = storeStringIntoRange(cx, v);
  if (requireMemory(cx.opts).ptrType() === "i32") {
    return [ptr, Number(packedLength)];
  }
  return [BigInt(ptr), packedLength];
}
function lowerFlatList(cx, v, elemType, maybeLength) {
  if (maybeLength !== null) {
    assert_(maybeLength === v.length, "fixed-length list length mismatch");
    const flat = [];
    for (let i = 0;i < v.length; i++) {
      flat.push(...lowerFlat(cx, v[i], elemType));
    }
    return flat;
  }
  const [ptr, length] = storeListIntoRange(cx, v, elemType);
  if (requireMemory(cx.opts).ptrType() === "i32") {
    return [ptr, length];
  }
  return [BigInt(ptr), BigInt(length)];
}
function lowerFlatRecord(cx, v, fields) {
  const flat = [];
  for (const f of fields) {
    flat.push(...lowerFlat(cx, v[f.label], f.type));
  }
  return flat;
}
function lowerFlatVariant(cx, v, cases) {
  const [caseIndex, caseValue] = matchCase(v, cases);
  const flatTypes = flattenVariant(cases, cx.opts);
  assert_(flatTypes.shift() === "i32");
  const c = cases[caseIndex];
  let payload;
  if (c.type === null) {
    payload = [];
  } else {
    payload = lowerFlat(cx, caseValue, c.type);
    const haveTypes = flattenType(c.type, cx.opts);
    for (let i = 0;i < payload.length; i++) {
      const fv = payload[i];
      const have = haveTypes[i];
      const want = flatTypes.shift();
      if (have === "f32" && want === "i32") {
        payload[i] = encodeFloatAsI32(fv);
      } else if (have === "i32" && want === "i64") {
        payload[i] = BigInt(fv);
      } else if (have === "f32" && want === "i64") {
        payload[i] = BigInt(encodeFloatAsI32(fv));
      } else if (have === "f64" && want === "i64") {
        payload[i] = encodeFloatAsI64(fv);
      } else {
        assert_(have === want, `lane mismatch ${have} -> ${want}`);
      }
    }
  }
  for (const want of flatTypes) {
    payload.push(want === "i64" ? 0n : 0);
  }
  return [caseIndex, ...payload];
}
function lowerFlatFlags(v, labels) {
  assert_(0 < labels.length && labels.length <= 32);
  return [packFlagsIntoInt(v, labels)];
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/cabi/values.js
var spillTuples = new WeakMap;
function spillTupleType(ts) {
  const hit = spillTuples.get(ts);
  if (hit !== undefined)
    return hit;
  const t = { kind: "tuple", elements: ts };
  spillTuples.set(ts, t);
  return t;
}
function liftFlatValues(cx, maxFlat, vi, ts) {
  if (flatCount(ts, cx.opts) > maxFlat) {
    const mem = requireMemory(cx.opts);
    const ptrRaw = vi.next(mem.ptrType());
    const tupleType = spillTupleType(ts);
    const align = alignment(tupleType, mem.ptrType());
    const size = elemSize(tupleType, mem.ptrType());
    trapIf(BigInt(ptrRaw) % BigInt(align) !== 0n, "misaligned spill pointer");
    trapIf(BigInt(ptrRaw) + BigInt(size) > BigInt(mem.length), "spill tuple out of bounds");
    const ptr = asIndex(ptrRaw);
    const tuple = load(cx, ptr, tupleType);
    return Object.values(tuple);
  } else {
    return ts.map((t) => liftFlat(cx, vi, t));
  }
}
function lowerFlatValues(cx, maxFlat, vs, ts, outParam = null) {
  if (flatCount(ts, cx.opts) > maxFlat) {
    const mem = requireMemory(cx.opts);
    const tupleType = spillTupleType(ts);
    const tupleValue = {};
    vs.forEach((v, i) => {
      tupleValue[String(i)] = v;
    });
    let ptr;
    let flatVals;
    const align = alignment(tupleType, mem.ptrType());
    const size = elemSize(tupleType, mem.ptrType());
    if (outParam === null) {
      ptr = cx.allocate(align, size);
      flatVals = mem.ptrType() === "i32" ? [ptr] : [BigInt(ptr)];
    } else {
      ptr = asIndex(outParam.next(mem.ptrType()));
      flatVals = [];
    }
    trapIf(ptr !== alignTo(ptr, align), "misaligned spill pointer");
    trapIf(ptr + size > mem.length, "spill tuple out of bounds");
    store(cx, tupleValue, tupleType, ptr);
    return flatVals;
  } else {
    const flatVals = [];
    for (let i = 0;i < vs.length; i++) {
      flatVals.push(...lowerFlat(cx, vs[i], ts[i]));
    }
    return flatVals;
  }
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/task/thread.js
class Thread {
  task;
  storage = [0, 0];
  syncCallStack = [];
  index = null;
  cancellable = false;
  #state = "suspended";
  #body;
  #readyFunc = null;
  #store;
  constructor(task, body) {
    this.task = task;
    this.#body = body;
    this.#store = task.inst.store;
  }
  running() {
    return this.#state === "running";
  }
  suspended() {
    return this.#state === "suspended";
  }
  waiting() {
    return this.#state === "waiting";
  }
  done() {
    return this.#state === "done";
  }
  ready() {
    return this.waiting() && this.#readyFunc !== null && this.#readyFunc();
  }
  #startWaiting(readyFunc) {
    assert_(!this.waiting() && this.#readyFunc === null);
    this.#readyFunc = readyFunc;
    this.#state = "waiting";
    this.#store.startWaiting(this);
  }
  #stopWaiting(cancelled) {
    assert_(this.waiting() && this.#readyFunc !== null);
    assert_(cancelled || this.ready(), "stopWaiting on a thread that is neither ready nor cancelled");
    this.#readyFunc = null;
    this.#state = "suspended";
    this.#store.stopWaiting(this);
  }
  resumeLater() {
    assert_(this.suspended(), "resume_later on a non-suspended thread");
    this.#startWaiting(() => true);
  }
  awaiting = null;
  resumeWith(value, failure) {
    assert_(this.awaiting !== null, "resumeWith on a thread that is not awaiting");
    this.awaiting = null;
    this.#store.awaiting.delete(this);
    this.#state = "suspended";
    const inst = this.task.inst;
    if (isInstancePoisoned(inst))
      return;
    try {
      this.#resumeInternal(value, failure);
    } catch (e) {
      if (!(e instanceof NeedsJspi) && !(e instanceof PendingCapability)) {
        notifyInstancePoisoned(inst, e);
      }
      throw e;
    }
  }
  resume(cancelled = CANCELLED_FALSE) {
    assert_(!this.running() && !this.done(), "resume() on a running or finished thread");
    assert_(this.cancellable || !cancelled, "cancelled resume of a non-cancellable block point");
    if (this.waiting())
      this.#stopWaiting(cancelled);
    this.#resumeInternal(cancelled);
  }
  #resumeInternal(sendValue, failure) {
    this.#state = "running";
    this.cancellable = false;
    pushCurrentThread(this);
    let step;
    try {
      step = failure === undefined ? this.#body.next(sendValue) : this.#body.throw(failure.error);
    } catch (e) {
      this.#state = "done";
      throw e;
    } finally {
      popCurrentThread(this);
    }
    if (step.done) {
      this.#state = "done";
      return;
    }
    const req = step.value;
    this.cancellable = req.cancellable;
    if (req.awaitValue !== undefined) {
      this.#state = "suspended";
      this.awaiting = req.awaitValue;
      this.#store.noteAwaiting(this, req.awaitValue);
      return;
    }
    if (req.readyFunc === null) {
      this.#state = "suspended";
    } else {
      this.#state = "suspended";
      this.#startWaiting(req.readyFunc);
    }
  }
  *waitUntil(readyFunc, cancellable = false) {
    assert_(this.running(), "waitUntil on a non-running thread");
    if (this.task.deliverPendingCancel(cancellable))
      return CANCELLED_TRUE;
    const readyOrCancelled = () => readyFunc() || cancellable && this.task.hasPendingCancel() && (this !== this.task.implicitThread || this.task.implicitThreadCancellable());
    const cancelled = yield { readyFunc: readyOrCancelled, cancellable };
    if (this.task.deliverPendingCancel(cancellable))
      return CANCELLED_TRUE;
    return cancelled;
  }
  *suspend(cancellable) {
    assert_(this.running(), "suspend on a non-running thread");
    if (this.task.deliverPendingCancel(cancellable))
      return CANCELLED_TRUE;
    const cancelled = yield { readyFunc: null, cancellable };
    return cancelled;
  }
  *yield_(cancellable) {
    return yield* this.waitUntil(() => true, cancellable);
  }
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/task/subtask.js
var SubtaskState;
(function(SubtaskState2) {
  SubtaskState2[SubtaskState2["STARTING"] = 0] = "STARTING";
  SubtaskState2[SubtaskState2["STARTED"] = 1] = "STARTED";
  SubtaskState2[SubtaskState2["RETURNED"] = 2] = "RETURNED";
  SubtaskState2[SubtaskState2["CANCELLED_BEFORE_STARTED"] = 3] = "CANCELLED_BEFORE_STARTED";
  SubtaskState2[SubtaskState2["CANCELLED_BEFORE_RETURNED"] = 4] = "CANCELLED_BEFORE_RETURNED";
})(SubtaskState || (SubtaskState = {}));

class Subtask extends Waitable {
  state = SubtaskState.STARTING;
  onCancel = null;
  cancellationRequested = false;
  flatResults = [];
  calleeTask = null;
  lenders = [];
  resolved() {
    switch (this.state) {
      case SubtaskState.STARTING:
      case SubtaskState.STARTED:
        return false;
      default:
        return true;
    }
  }
  addLender(h) {
    assert_(!this.resolveDelivered() && !this.resolved(), "addLender on a resolved subtask");
    h.numLends += 1;
    this.lenders.push(h);
  }
  resolve(state, flatResults) {
    assert_(state === SubtaskState.RETURNED || flatResults.length === 0, "non-RETURNED subtask resolution carries results");
    assert_(!this.resolved(), "resolve on an already-resolved subtask");
    this.state = state;
    this.flatResults = flatResults;
  }
  deliverResolve() {
    assert_(!this.resolveDelivered() && this.resolved(), "deliverResolve on an unresolved or already-delivered subtask");
    for (const h of this.lenders)
      h.numLends -= 1;
    this.lenders = null;
  }
  resolveDelivered() {
    assert_(this.lenders !== null || this.resolved(), "lenders released on an unresolved subtask");
    return this.lenders === null;
  }
  unwindLenders() {
    if (!this.resolved()) {
      this.resolve(this.state === SubtaskState.STARTING ? SubtaskState.CANCELLED_BEFORE_STARTED : SubtaskState.CANCELLED_BEFORE_RETURNED, []);
    }
    if (!this.resolveDelivered())
      this.deliverResolve();
  }
  drop() {
    trapIf(!this.resolveDelivered(), "cannot drop a subtask which has not yet resolved");
    super.drop();
  }
  setSubtaskPendingEvent(subtaski) {
    this.setPendingEvent(() => {
      if (this.resolved() && !this.resolveDelivered())
        this.deliverResolve();
      return [EventCode.SUBTASK, subtaski, this.state];
    });
  }
}
function packSubtaskResult(state, subtaski) {
  assert_(subtaski > 0 && subtaski <= 2 ** 28 - 1, "subtask index out of packing range");
  assert_(state >= 0 && state < 2 ** 4, "subtask state out of packing range");
  return (state | subtaski << 4) >>> 0;
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/task/mod.js
class ComponentInstanceState {
  index;
  flags;
  handles = new Table;
  threads = new Table;
  [COMPONENT_INSTANCE] = true;
  backpressure = 0;
  numWaitingToEnter = 0;
  exclusiveThread = null;
  store;
  constructor(index, store3) {
    this.index = index;
    this.store = store3 ?? new Store;
    this.flags = new WebAssembly.Global({ value: "i32", mutable: true }, 1);
  }
  get mayLeave() {
    return this.flags.value !== 0;
  }
  set mayLeave(v) {
    this.flags.value = v ? 1 : 0;
  }
}
function liftOptionsEqual(a, b) {
  return a.stringEncoding === b.stringEncoding && a.memory === b.memory;
}
var ADMIT_TRACE = (() => {
  try {
    return Deno.env.get("CE_SP_TRACE") === "1";
  } catch {
    return false;
  }
})();

class Task {
  ft;
  opts;
  inst;
  onStart;
  onResolve;
  state = "initial";
  numBorrows = 0;
  onFinished = null;
  implicitThread = null;
  threads = [];
  factPassthrough = false;
  factResultTypesKnown = false;
  constructor(ft, opts, inst, onStart, onResolve) {
    this.ft = ft;
    this.opts = opts;
    this.inst = inst;
    this.onStart = onStart;
    this.onResolve = onResolve;
  }
  needsExclusive() {
    assert_(this.ft.async === true, "needs_exclusive on a sync-typed task");
    return !this.opts.async_ || this.opts.callback;
  }
  *enterImplicitThread(thread2) {
    assert_(this.state === "initial", "enter_implicit_thread after start");
    this.implicitThread = thread2;
    if (this.ft.async === true) {
      const hasBackpressure = () => this.inst.backpressure > 0 || this.needsExclusive() && this.inst.exclusiveThread !== null;
      if (hasBackpressure() || this.inst.numWaitingToEnter > 0) {
        this.inst.numWaitingToEnter += 1;
        let cancelled;
        try {
          cancelled = yield* thread2.waitUntil(() => !hasBackpressure(), true);
        } finally {
          this.inst.numWaitingToEnter -= 1;
        }
        if (cancelled) {
          this.cancel();
          return false;
        }
      }
      if (this.needsExclusive()) {
        assert_(this.inst.exclusiveThread === null, "entering with the exclusive thread already taken");
        this.inst.exclusiveThread = thread2;
      }
    }
    if (ADMIT_TRACE) {
      console.error(`[admit] task=${dbgId(this)} thread=${dbgId(thread2)}`);
    }
    this.registerThread(thread2);
    return true;
  }
  registerThread(thread2) {
    assert_(!this.threads.includes(thread2) && thread2.task === this, "register_thread of a foreign or duplicate thread");
    this.threads.push(thread2);
    assert_(thread2.index === null, "register_thread of an indexed thread");
    thread2.index = this.inst.threads.add(thread2);
  }
  exitImplicitThread(thread2) {
    assert_(thread2 === this.implicitThread, "exit of a non-implicit thread");
    this.unregisterThread(thread2);
    if (this.ft.async === true && this.needsExclusive()) {
      assert_(this.inst.exclusiveThread === thread2, "exit_implicit_thread without holding the exclusive thread");
      this.inst.exclusiveThread = null;
    }
  }
  unregisterThread(thread2) {
    const i = this.threads.indexOf(thread2);
    assert_(i !== -1 && thread2.task === this, "unregister of a foreign thread");
    this.threads.splice(i, 1);
    if (this.threads.length === 0) {
      trapIf(this.state !== "resolved", "task finished all threads without resolving");
      assert_(this.numBorrows === 0, "task exited with live borrows");
    }
    assert_(thread2.index !== null, "unregister of an unindexed thread");
    this.inst.threads.remove(thread2.index);
    thread2.index = null;
    if (this.threads.length === 0 && this.onFinished !== null) {
      const f = this.onFinished;
      this.onFinished = null;
      f();
    }
  }
  requestCancellation(caller) {
    if (this.state === "initial") {
      this.state = "cancel-delivered";
      this.implicitThread.resume(CANCELLED_TRUE);
      return;
    }
    assert_(this.state === "started", `request_cancellation in state ${this.state}`);
    let candidates = this.threads.filter((t) => t.cancellable);
    const excludeImplicit = !this.implicitThreadCancellable();
    if (excludeImplicit) {
      candidates = candidates.filter((t) => t !== this.implicitThread);
    }
    if (!excludeImplicit) {
      const store3 = this.inst.store;
      for (const w of store3.waiting) {
        if (w.task === this && w.cancellable === true && !candidates.includes(w)) {
          candidates.push(w);
        }
      }
    }
    if (candidates.length > 0 && !isInstancePoisoned(this.inst)) {
      this.state = "cancel-delivered";
      try {
        chooseCandidate(candidates).resume(CANCELLED_TRUE);
      } catch (e) {
        if (!(e instanceof NeedsJspi) && !(e instanceof PendingCapability)) {
          notifyInstancePoisoned(this.inst, e);
        }
        throw e;
      }
    } else {
      this.state = "pending-cancel";
    }
  }
  implicitThreadCancellable() {
    return !(this.ft.async === true && this.needsExclusive() && this.inst.exclusiveThread !== null && this.inst.exclusiveThread !== this.implicitThread);
  }
  hasPendingCancel() {
    return this.state === "pending-cancel";
  }
  deliverPendingCancel(cancellable) {
    if (cancellable && this.hasPendingCancel()) {
      this.state = "cancel-delivered";
      return true;
    }
    return false;
  }
  start() {
    assert_(this.state === "initial", "start on a started task");
    this.state = "started";
    return this.onStart();
  }
  return_(result) {
    trapIf(this.state === "resolved", "task.return on a resolved task");
    trapIf(this.numBorrows > 0, "borrow handles still remain at the end of the call");
    this.onResolve(result);
    this.state = "resolved";
  }
  cancel() {
    trapIf(this.state !== "cancel-delivered", "task.cancel without a delivered cancellation request");
    trapIf(this.numBorrows > 0, "borrow handles still remain at the end of the call");
    this.onResolve(null);
    this.state = "resolved";
  }
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/jspi/types.js
function jspiApi() {
  const wa = WebAssembly;
  return typeof wa.promising === "function" && typeof wa.Suspending === "function" ? wa : null;
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/jspi/mechanics.js
function isSupported() {
  return typeof globalThis.WebAssembly === "object" && jspiApi() !== null;
}
function assertSupported() {
  if (!isSupported()) {
    throw new Error("JSPI (WebAssembly.promising / WebAssembly.Suspending) is not " + "available in this engine; see docs/architecture.md §3 for the compatibility " + "floor (no fallback path exists).");
  }
}
function makePromising(wasmExport) {
  assertSupported();
  return jspiApi().promising(wasmExport);
}
function makeSuspending(fn) {
  assertSupported();
  return new (jspiApi()).Suspending(fn);
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/jspi/bridge.js
function chooseMode(requested, needed) {
  if (requested === false)
    return "plain";
  const want = requested === true || needed === true;
  return want && isSupported() ? "jspi" : "plain";
}
function trampolineNeedsSuspension(t, optionsAsync) {
  switch (t.kind) {
    case "sync-start-call":
    case "waitable-set-wait":
    case "thread-yield":
      return true;
    case "subtask-cancel":
    case "stream-cancel-read":
    case "stream-cancel-write":
    case "future-cancel-read":
    case "future-cancel-write":
      return t.async !== true;
    case "stream-read":
    case "stream-write":
    case "future-read":
    case "future-write":
      return typeof t.options === "number" ? !optionsAsync(t.options) : true;
    default:
      return false;
  }
}
function trampolineCanBlock(t, optionsAsync) {
  return t.kind === "async-start-call" || t.kind === "subtask-cancel" || trampolineNeedsSuspension(t, optionsAsync);
}
function planNeedsSuspension(plan) {
  for (const o of plan.canonicalOptions) {
    if (o.async && o.callback === null)
      return true;
  }
  const optionsAsync = (i) => plan.canonicalOptions[i]?.async === true;
  for (const t of plan.trampolines) {
    if (trampolineNeedsSuspension(t, optionsAsync))
      return true;
  }
  return false;
}
function enterWasm(fn, mode) {
  if (mode === "plain")
    return fn;
  assert_(isSupported(), "jspi mode selected on an engine without JSPI");
  return makePromising(fn);
}
function sentinelFor(owner) {
  if (owner === null || owner === undefined)
    return;
  SENTINEL_TICK.then(() => claimActivationAmbient(owner));
}
var SENTINEL_TICK = Promise.resolve();
function attributeContinuation(owner, r) {
  return Promise.resolve(r).then((v) => {
    sentinelFor(owner);
    return v;
  }, (e) => {
    sentinelFor(owner);
    throw e;
  });
}
function suspendingImport(fn, mode) {
  if (mode === "plain")
    return fn;
  assert_(isSupported(), "jspi mode selected on an engine without JSPI");
  const claimingFn = (...args) => {
    const owner = maybeCurrentThread() ?? null;
    const invoke = () => fn(...args);
    let r;
    try {
      r = owner === null ? invoke() : withActivation(owner, invoke);
    } catch (e) {
      claimActivationAmbient(owner);
      throw e;
    }
    if (r === null || typeof r?.then !== "function") {
      claimActivationAmbient(owner);
      sentinelFor(owner);
      return r;
    }
    if (SP_TRACE) {
      console.error(`[sp] hop-suspend owner=${dbgId(owner)} promise=${dbgId(r)}`);
    }
    return attributeContinuation(owner, r);
  };
  return makeSuspending(claimingFn);
}
function assertModeConsistent(mode, entriesWrapped, importsWrapped) {
  if (mode === "plain") {
    assert_(!entriesWrapped && !importsWrapped, `plain mode with wrapped entries=${entriesWrapped} / ` + `imports=${importsWrapped} — wrapping ran under the wrong mode`);
    return;
  }
  assert_(entriesWrapped || !importsWrapped, `suspension mode jspi wrapped imports without wrapping any entry ` + `(entries=${entriesWrapped}, imports=${importsWrapped}) — a ` + `Suspending import reached from a non-promising activation traps ` + `unconditionally (jspi pin (c))`);
}
var SP_TRACE = (() => {
  try {
    return Deno.env.get("CE_SP_TRACE") === "1";
  } catch {
    return false;
  }
})();

class SuspensionPoint {
  task;
  readyFunc;
  cancellable;
  produce;
  onSettled;
  promise;
  #settle;
  #fail;
  #done = false;
  #finished = false;
  #store;
  owner;
  constructor(store3, task, readyFunc, cancellable, produce, owner, onSettled) {
    this.task = task;
    this.readyFunc = readyFunc;
    this.cancellable = cancellable;
    this.produce = produce;
    this.onSettled = onSettled;
    this.#store = store3;
    this.owner = owner ?? maybeCurrentThread() ?? task?.implicitThread ?? null;
    if (SP_TRACE) {
      console.error(`[sp] mint ${dbgId(this)} owner=${dbgId(this.owner)} task=${dbgId(this.task)}
${(new Error().stack ?? "").split(`
`).slice(2, 5).join(`
`)}`);
    }
    this.promise = new Promise((res, rej) => {
      this.#settle = res;
      this.#fail = rej;
    });
    store3.startWaiting(this);
  }
  waiting() {
    return !this.#done;
  }
  ready() {
    if (this.#done)
      return false;
    if (this.readyFunc !== null && this.readyFunc())
      return true;
    return this.cancellable && this.#taskHasPendingCancel() && this.task.implicitThreadCancellable() === true;
  }
  #taskHasPendingCancel() {
    return typeof this.task?.hasPendingCancel === "function" && this.task.hasPendingCancel() === true;
  }
  resume(cancelled = false) {
    assert_(!this.#done, "resume of an already-resumed suspension point");
    assert_(this.cancellable || !cancelled, "cancelled resume of a non-cancellable suspension point");
    if (SP_TRACE) {
      console.error(`[sp] resume ${dbgId(this)} owner=${dbgId(this.owner)}
${(new Error().stack ?? "").split(`
`).slice(2, 5).join(`
`)}`);
    }
    this.#done = true;
    if (typeof this.task?.deliverPendingCancel === "function" && this.task.deliverPendingCancel(this.cancellable) === true) {
      cancelled = true;
    }
    this.cancellable = false;
    this.#store.stopWaiting(this);
    try {
      this.#resumeInner(cancelled);
    } finally {
      this.#finish();
    }
  }
  #resumeInner(cancelled) {
    let value;
    try {
      value = this.produce(cancelled);
    } catch (e) {
      this.#store.consumePendingIfRunning();
      if (maybeCurrentThread() === undefined)
        claimActivationAmbient(this.owner);
      this.#store.addPendingResumption(this.task?.implicitThread ?? null);
      this.#fail(e);
      return;
    }
    this.#store.consumePendingIfRunning();
    if (maybeCurrentThread() === undefined)
      claimActivationAmbient(this.owner);
    this.#store.addPendingResumption(this.task?.implicitThread ?? null);
    this.#settle(value);
  }
  abandon(reason) {
    if (this.#done)
      return;
    this.#done = true;
    this.#store.stopWaiting(this);
    try {
      this.#fail(reason);
    } finally {
      this.#finish();
    }
  }
  #finish() {
    if (this.#finished)
      return;
    this.#finished = true;
    if (this.onSettled === undefined)
      return;
    try {
      this.onSettled();
    } catch (e) {
      console.error(`[sp] onSettled threw for ${dbgId(this)}:`, e);
    }
  }
}
function blockCurrentActivation(input) {
  const owner = maybeCurrentThread() ?? input.task?.implicitThread ?? null;
  input.store.consumePendingIfRunning();
  releaseActivationAmbient(owner);
  const point = new SuspensionPoint(input.store, input.task, input.readyFunc, input.cancellable, input.produce, owner, input.onSettled);
  return point.promise;
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/exec/boundary.js
function newStats() {
  return {
    liftedCalls: 0,
    tasksResolved: 0,
    postReturnsRun: 0,
    loweredCalls: 0,
    enterSyncCalls: 0,
    exitSyncCalls: 0,
    callbackInvocations: 0
  };
}

class LiveMemory {
  addrType = "i32";
  #provider;
  #label;
  #buffer = null;
  #bytes = new Uint8Array(0);
  #view = new DataView(new ArrayBuffer(0));
  constructor(provider, label) {
    this.#provider = provider;
    this.#label = label;
  }
  #memory() {
    const m = this.#provider();
    if (m === undefined) {
      throw new PlanError(`${this.#label} accessed before its extract-memory initializer ran`);
    }
    return m;
  }
  #refresh() {
    const buffer = this.#memory().buffer;
    if (buffer !== this.#buffer) {
      this.#buffer = buffer;
      this.#bytes = new Uint8Array(buffer);
      this.#view = new DataView(buffer);
    }
  }
  get bytes() {
    this.#refresh();
    return this.#bytes;
  }
  get view() {
    this.#refresh();
    return this.#view;
  }
  get length() {
    return this.#memory().buffer.byteLength;
  }
  ptrType() {
    return this.addrType;
  }
  ptrSize() {
    return 4;
  }
}
var _memInstCheck = new LiveMemory(() => {
  return;
}, "check");
function require2(resolver, what) {
  if (resolver === null)
    return null;
  const v = resolver();
  if (v === undefined) {
    throw new PlanError(`${what} accessed before its extract initializer ran`);
  }
  return v;
}
function cabiOptions(opts) {
  return {
    stringEncoding: opts.stringEncoding,
    memory: opts.memory,
    realloc: opts.realloc === null ? null : (o, os, a, n) => {
      const realloc = require2(opts.realloc, "realloc");
      const p = callCore(realloc, [o, os, a, n]);
      trapIf(p.length !== 1 || typeof p[0] !== "number", "realloc result");
      return p[0] >>> 0;
    },
    postReturn: null,
    async_: opts.async,
    callback: opts.callback === null ? null : opts.callback
  };
}
function callCore(fn, args) {
  let raw;
  try {
    raw = fn(...args);
  } catch (e) {
    throw mapCoreException(e);
  }
  if (raw === undefined)
    return [];
  if (Array.isArray(raw))
    return raw;
  return [raw];
}
function mapCoreException(e) {
  if (e instanceof WebAssembly.RuntimeError) {
    try {
      trap(`guest trapped: ${e.message}`);
    } catch (t) {
      return t;
    }
  }
  return e;
}
function normalizeCoreValues(values2, lanes, what) {
  if (values2.length !== lanes.length) {
    throw new AssertionError(`${what}: expected ${lanes.length} core values, got ${values2.length}`);
  }
  return values2.map((v, i) => {
    switch (lanes[i]) {
      case "i32":
        assert_(typeof v === "number", `${what}[${i}]: i32 lane`);
        return v >>> 0;
      case "i64":
        assert_(typeof v === "bigint", `${what}[${i}]: i64 lane`);
        return BigInt.asUintN(64, v);
      case "f32":
      case "f64":
        assert_(typeof v === "number", `${what}[${i}]: float lane`);
        return v;
    }
  });
}
function resultsToHost(results) {
  if (results.length === 0)
    return;
  if (results.length === 1)
    return results[0];
  return results;
}
function isPromiseLike(v) {
  return typeof v === "object" && v !== null && typeof v.then === "function";
}
var DRIVE_TRACE = (() => {
  try {
    return Deno.env.get("POLYENGINE_DRIVE_TRACE") === "1";
  } catch {
    return false;
  }
})();
var traceTurn = 0;
function describeWaiter(t) {
  const w = t;
  const kind = w?.constructor?.name ?? "?";
  let verdict = "?";
  try {
    verdict = w.ready?.() ? "READY" : w.readyFunc === null ? "explicit" : "not-ready";
  } catch (e) {
    verdict = `threw:${e}`;
  }
  return `${kind}[${verdict}]`;
}
function traceDrive(loop, store3, done, branch) {
  if (!DRIVE_TRACE)
    return;
  let doneVerdict = "?";
  try {
    doneVerdict = String(done());
  } catch (e) {
    doneVerdict = `threw:${e}`;
  }
  const waiters = store3.waiting.map(describeWaiter).join(",");
  const awaiters = [...store3.awaiting].map((t) => {
    const a = t;
    return `${a?.constructor?.name ?? "?"}`;
  }).join(",");
  console.error(`[drive #${traceTurn++}] ${loop} branch=${branch} ` + `ready=${store3.readyCandidates().length} ` + `waiting=${store3.waiting.length}{${waiters}} ` + `awaiting=${store3.awaiting.size} ` + `hostCalls=${store3.pendingHostCalls.size} ` + `awaiters={${awaiters}} pending=${store3.pendingResumptions.size} done=${doneVerdict}`);
}
function drive(store3, done, what, idle = "trap") {
  try {
    return driveLoop(store3, done, what, idle);
  } catch (e) {
    ensureSettlementPump(store3);
    throw e;
  }
}
function driveLoop(store3, done, what, idle) {
  for (;; ) {
    traceDrive("drive", store3, done, "top");
    while (store3.awaiting.size === 0 && store3.tick()) {
      traceDrive("drive", store3, done, "ticked");
      if (store3.hostFailure !== undefined)
        throw takeHostFailure(store3);
    }
    if (store3.hostFailure !== undefined)
      throw takeHostFailure(store3);
    if (done()) {
      traceDrive("drive", store3, done, "EXIT-done");
      ensureSettlementPump(store3);
      return "done";
    }
    if (store3.awaiting.size > 0 || store3.hasPendingResumptions()) {
      traceDrive("drive", store3, done, "->async(awaiting/pending)");
      return driveAsync(store3, done, what, idle);
    }
    if (store3.pendingHostCalls.size === 0) {
      if (idle === "exit") {
        traceDrive("drive", store3, done, "EXIT-idle");
        ensureSettlementPump(store3);
        return "idle";
      }
      traceDrive("drive", store3, done, "DEADLOCK-TRAP");
      trapIf(true, `wasm trap: deadlock detected: event loop cannot make further ` + `progress (${what}: no thread is ready and no host call is ` + `outstanding)`);
    }
    traceDrive("drive", store3, done, "->async(hostcalls)");
    return driveAsync(store3, done, what, idle);
  }
}
var taggedAwaits = new WeakMap;
function tagAwait(t) {
  const p = t.awaiting;
  let tag = taggedAwaits.get(p);
  if (tag === undefined) {
    tag = p.then((value) => ({ t, p, value, failure: undefined }), (e) => ({ t, p, value: undefined, failure: { error: e } }));
    taggedAwaits.set(p, tag);
  }
  return tag;
}
async function driveStoreAsync(store3, done, what) {
  await driveAsync(store3, done, what);
}
var driverDepth = new WeakMap;
var driverIdle = new WeakMap;
function storeDriverDepth(store3) {
  return driverDepth.get(store3) ?? 0;
}
function whenStoreDriverIdle(store3) {
  if (storeDriverDepth(store3) === 0)
    return Promise.resolve();
  let w = driverIdle.get(store3);
  if (w === undefined) {
    let r;
    const p = new Promise((res) => r = res);
    w = { p, r };
    driverIdle.set(store3, w);
  }
  return w.p;
}
var driverArrivals = new WeakMap;
function armDriverArrival(store3) {
  let n = driverArrivals.get(store3);
  if (n === undefined) {
    let r;
    const p = new Promise((res) => r = () => res(null));
    n = { p, r };
    driverArrivals.set(store3, n);
  }
  return n.p;
}
function fireDriverArrival(store3) {
  const n = driverArrivals.get(store3);
  if (n === undefined)
    return;
  driverArrivals.delete(store3);
  n.r();
}
var hostCallArrivals = new WeakMap;
function armHostCallArrival(store3) {
  let n = hostCallArrivals.get(store3);
  if (n === undefined) {
    let r;
    const p = new Promise((res) => r = () => res(null));
    n = { p, r };
    hostCallArrivals.set(store3, n);
  }
  return n.p;
}
function fireHostCallArrival(store3) {
  const n = hostCallArrivals.get(store3);
  if (n === undefined)
    return;
  hostCallArrivals.delete(store3);
  n.r();
}
function registerHostCall(store3, promise) {
  store3.pendingHostCalls.add(promise);
  fireHostCallArrival(store3);
}
var settlementPumps = new WeakSet;
var settlementNudges = new WeakMap;
function armSettlementNudge(store3) {
  let n = settlementNudges.get(store3);
  if (n === undefined) {
    let r;
    const p = new Promise((res) => r = res);
    n = { p, r };
    settlementNudges.set(store3, n);
  }
  return n.p;
}
function fireSettlementNudge(store3) {
  const n = settlementNudges.get(store3);
  if (n !== undefined) {
    settlementNudges.delete(store3);
    n.r();
  }
}
function pumpWork(store3) {
  return hasRealHostCall(store3) || store3.settled.length > 0 || entryHopThreads(store3).length > 0;
}
function ensureSettlementPump(store3) {
  if (settlementPumps.has(store3)) {
    fireSettlementNudge(store3);
    return;
  }
  if (store3.hostFailure !== undefined)
    return;
  if (!pumpWork(store3))
    return;
  settlementPumps.add(store3);
  settlementPumpLoop(store3);
}
async function settlementPumpLoop(store3) {
  let failed = false;
  try {
    for (;; ) {
      while (storeDriverDepth(store3) > 0) {
        await whenStoreDriverIdle(store3);
      }
      if (store3.hostFailure !== undefined)
        return;
      const real = realHostCalls(store3);
      const hops = store3.settled.length > 0 ? [] : entryHopThreads(store3).map((t) => t.awaiting).filter((p) => p !== null);
      if (store3.settled.length === 0) {
        if (real.length === 0 && hops.length === 0)
          return;
        const nudge = armSettlementNudge(store3);
        await Promise.race([
          ...real.map((p) => p.then(() => {}, () => {})),
          ...hops.map((p) => p.then(() => {}, () => {})),
          nudge
        ]);
        if (storeDriverDepth(store3) > 0)
          continue;
      }
      await driveStoreAsync(store3, () => store3.pendingHostCalls.size === 0 || storeQuiescent(store3) || storeDriverDepth(store3) > 1, "settlement pump");
    }
  } catch (e) {
    failed = true;
    store3.hostFailure ??= e;
  } finally {
    settlementPumps.delete(store3);
    if (!failed && store3.hostFailure === undefined && storeDriverDepth(store3) === 0 && pumpWork(store3)) {
      ensureSettlementPump(store3);
    }
  }
}
async function driveAsync(store3, done, what, idle = "trap") {
  const depth = storeDriverDepth(store3) + 1;
  driverDepth.set(store3, depth);
  if (depth > 1)
    fireDriverArrival(store3);
  try {
    let claimHops = 0;
    for (;; ) {
      traceDrive("driveAsync", store3, done, "top");
      store3.serviceSettled();
      if (store3.hostFailure !== undefined)
        throw takeHostFailure(store3);
      if (store3.hasPendingResumptions()) {
        traceDrive("driveAsync", store3, done, "yield-pending");
        claimHops++;
        assert_(claimHops < 1e4, "driveAsync: a resumed-activation claim was never released " + "(the activation neither parked, finished, nor trapped)");
        if (claimHops % 100 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        } else {
          await Promise.resolve();
        }
        continue;
      }
      claimHops = 0;
      while (store3.tick()) {
        if (store3.hostFailure !== undefined)
          throw takeHostFailure(store3);
        if (store3.awaiting.size > 0) {
          await Promise.resolve();
          if (store3.hasServiceableSettled())
            break;
        }
      }
      if (store3.hostFailure !== undefined)
        throw takeHostFailure(store3);
      if (done()) {
        traceDrive("driveAsync", store3, done, "EXIT-done");
        return "done";
      }
      if (store3.hasServiceableSettled() || store3.hasPendingResumptions()) {
        continue;
      }
      if (store3.awaiting.size > 0) {
        if (store3.pendingHostCalls.size === 0 && !store3.hasPendingResumptions()) {
          traceDrive("driveAsync", store3, done, "deadlock-probe");
          const queued2 = new Set(store3.settled.map((s) => s.t));
          const parked2 = [...store3.awaiting].filter((t) => !queued2.has(t));
          const progressed = await Promise.race([
            ...parked2.map((t) => tagAwait(t).then(() => true)),
            new Promise((r) => setTimeout(() => r(false), 0))
          ]);
          traceDrive("driveAsync", store3, done, `deadlock-probe:progressed=${progressed}`);
          if (!progressed) {
            const freshQueued = new Set(store3.settled.map((s) => s.t));
            const fresh = [...store3.awaiting].filter((t) => !freshQueued.has(t));
            const changed = fresh.length !== parked2.length || fresh.some((t, i) => t !== parked2[i]);
            if (changed)
              continue;
            if (store3.pendingHostCalls.size > 0 || store3.hasPendingResumptions() || store3.hasServiceableSettled()) {
              continue;
            }
            if (store3.readyCandidates().length === 0) {
              if (idle === "exit") {
                traceDrive("driveAsync", store3, done, "EXIT-idle");
                return "idle";
              }
              trapIf(true, `wasm trap: deadlock detected: event loop cannot make ` + `further progress (${what}: every suspended activation is ` + `waiting on a suspension only this scheduler could resume, ` + `and none is ready)`);
            }
            continue;
          }
        }
        if (store3.awaiting.size === 0 || store3.hasServiceableSettled())
          continue;
        const queued = new Set(store3.settled.map((s) => s.t));
        const parked = [...store3.awaiting].filter((t) => !queued.has(t));
        if (parked.length === 0) {
          if (store3.pendingHostCalls.size > 0) {
            await Promise.race([
              ...store3.pendingHostCalls,
              armDriverArrival(store3),
              armHostCallArrival(store3)
            ]).catch(() => {});
            continue;
          }
          traceDrive("driveAsync", store3, done, "DEADLOCK-TRAP-deferred");
          trapIf(true, `wasm trap: deadlock detected: event loop cannot make further ` + `progress (${what}: every settled activation tail is deferred ` + `on a non-enterable instance and no host call is outstanding)`);
        }
        const chosen = parked[0];
        const chosenTag = tagAwait(chosen);
        const others = parked.slice(1).map(tagAwait);
        for (const h of store3.pendingHostCalls) {
          others.push(h.then(() => null, () => null));
        }
        const sole = storeDriverDepth(store3) === 1;
        const added = sole && !store3.pendingResumptions.has(chosen);
        if (added)
          store3.addPendingResumption(chosen);
        let winner;
        try {
          winner = await Promise.race([
            chosenTag,
            ...others,
            armDriverArrival(store3),
            armHostCallArrival(store3)
          ]);
        } finally {
          if (added)
            store3.removePendingResumption(chosen);
        }
        if (winner !== null && store3.awaiting.has(winner.t) && winner.t.awaiting === winner.p) {
          for (let i = store3.settled.length - 1;i >= 0; i--) {
            if (store3.settled[i].t === winner.t)
              store3.settled.splice(i, 1);
          }
          winner.t.resumeWith(winner.value, winner.failure);
        }
        continue;
      }
      if (store3.pendingHostCalls.size === 0) {
        if (idle === "exit") {
          traceDrive("driveAsync", store3, done, "EXIT-idle");
          return "idle";
        }
        traceDrive("driveAsync", store3, done, "DEADLOCK-TRAP");
        trapIf(true, `wasm trap: deadlock detected: event loop cannot make further ` + `progress (${what}: no thread is ready and no host call is ` + `outstanding)`);
      }
      traceDrive("driveAsync", store3, done, "await-race");
      await Promise.race([
        ...store3.pendingHostCalls,
        armDriverArrival(store3),
        armHostCallArrival(store3)
      ]).catch(() => {});
    }
  } finally {
    const left = storeDriverDepth(store3) - 1;
    driverDepth.set(store3, left);
    if (left === 0) {
      const w = driverIdle.get(store3);
      driverIdle.delete(store3);
      w?.r();
      ensureSettlementPump(store3);
    }
  }
}
function takeHostFailure(store3) {
  const e = store3.hostFailure;
  store3.hostFailure = undefined;
  return e;
}
var SYNC_ENTRY = Symbol("polyengine.syncEntry");
var pendingLifts = new WeakMap;
function registerPendingLift(inst, reject) {
  let s = pendingLifts.get(inst);
  if (s === undefined)
    pendingLifts.set(inst, s = new Set);
  s.add(reject);
}
function unregisterPendingLift(inst, reject) {
  pendingLifts.get(inst)?.delete(reject);
}
addInstancePoisonedListener((inst, cause) => {
  const s = pendingLifts.get(inst);
  if (s === undefined || s.size === 0)
    return;
  const waiters = [...s];
  s.clear();
  for (const r of waiters)
    r(cause);
});
function createLiftedFunction(input) {
  const { name, ft, opts, core, stats, trapState, syncCallStack, allInstances } = input;
  const inst = opts.instance;
  const store3 = inst.store;
  const mode = input.suspensionMode ?? "plain";
  const enteredCore = enterWasm(core, mode);
  const idlePolicy = ft.async === true && input.trapOnIdle !== true ? "exit" : "trap";
  const taskOpts = {
    async_: opts.async,
    callback: opts.callback !== null,
    stringEncoding: opts.stringEncoding,
    memory: opts.memory
  };
  if (opts.callback !== null && !opts.async) {
    throw new PlanError(`export '${name}': canonical options carry a callback but are not ` + `async (callback is meaningless for a sync lift)`);
  }
  const computed = flattenFunctype(cabiOptions(opts), ft, "lift");
  if (!coreFuncTypeEquals(computed, opts.coreType)) {
    throw new PlanError(`export '${name}': computed flat type ${JSON.stringify(computed)} ` + `!= plan coreType ${JSON.stringify(opts.coreType)}`);
  }
  const invokeNow = (hostArgs) => {
    stats.liftedCalls++;
    if (trapState !== undefined)
      trapState.pending = undefined;
    const syncCallDepth = syncCallStack?.length ?? 0;
    {
      const refusal = entryRefusal(inst, null, `cannot enter component instance ${inst.index}`);
      if (refusal !== null)
        trap(refusal);
    }
    let completed = false;
    let resolved = null;
    let resolvedSeen = false;
    const task = new Task(ft, taskOpts, inst, () => hostArgs, (result) => {
      resolved = result;
      resolvedSeen = true;
      stats.tasksResolved++;
    });
    const thread2 = new Thread(task, liftBody({
      name,
      ft,
      opts,
      core: enteredCore,
      stats,
      task,
      thread: () => thread2,
      mode
    }));
    const finishHostEntry = () => {
      completed = true;
      trapIf(!resolvedSeen, `${name}: task finished without resolving (deadlock)`);
      if (resolved === null) {
        throw new AssertionError(`${name}: task resolved as cancelled, but the host never ` + `requested cancellation`);
      }
      return resultsToHost(resolved);
    };
    const unwind = () => {
      if (completed)
        return;
      for (const t of task.threads) {
        while (t.syncCallStack.length > 0) {
          t.syncCallStack.pop().releaseLenders();
        }
      }
      for (const i of allInstances?.() ?? []) {
        if (i !== inst) {
          i.mayLeave = true;
        }
      }
    };
    const poison = (e) => {
      notifyInstancePoisoned(inst, e);
    };
    const isCapabilitySignal = (e) => e instanceof NeedsJspi || e instanceof PendingCapability;
    try {
      thread2.resume();
      if (!ft.async && mode !== "jspi" && !input.allowAsyncCompletion) {
        driveSyncLift(task);
      }
    } catch (e) {
      unwind();
      if (!isCapabilitySignal(e))
        poison(e);
      throw e;
    }
    const backgroundCompletion = () => new Promise((resolve, reject) => {
      if (task.threads.length === 0) {
        try {
          resolve(finishHostEntry());
        } catch (e) {
          reject(e);
        }
        return;
      }
      const onPoison = (cause) => {
        task.onFinished = null;
        reject(cause);
      };
      registerPendingLift(inst, onPoison);
      task.onFinished = () => {
        unregisterPendingLift(inst, onPoison);
        try {
          resolve(finishHostEntry());
        } catch (e) {
          reject(e);
        }
      };
    });
    let outcome;
    try {
      const midWasmCall = () => task.threads.some((t) => store3.awaiting.has(t));
      const hopParked = () => entryHopThreads(store3).length > 0;
      const driveDone = () => resolvedSeen && !midWasmCall() && !hopParked();
      outcome = drive(store3, driveDone, `export '${name}'`, idlePolicy);
    } catch (e) {
      unwind();
      throw e;
    }
    const finish = (verdict) => verdict === "idle" ? backgroundCompletion() : finishHostEntry();
    if (!isPromiseLike(outcome)) {
      try {
        return finish(outcome);
      } catch (e) {
        unwind();
        throw e;
      }
    }
    return outcome.then(finish, (e) => {
      unwind();
      throw e;
    });
  };
  return (...hostArgs) => {
    if (input.refuseOnEntryHops && entryHopThreads(store3, inst).length > 0) {
      throw new SyncEntryBusy(name);
    }
    if (hostArgs.length !== ft.params.length) {
      throw new TypeError(`${name}: expected ${ft.params.length} argument(s), got ${hostArgs.length}`);
    }
    if (mode === "jspi" && entryHopThreads(store3, inst).length > 0) {
      return awaitHopQuiescence(store3, inst).then(() => invokeNow(hostArgs));
    }
    return invokeNow(hostArgs);
  };
}
function entryHopThreads(store3, inst) {
  if (store3.awaiting.size === 0)
    return [];
  const suspended = new Set;
  for (const w of store3.waiting) {
    const owner = w.owner;
    if (owner !== undefined && owner !== null)
      suspended.add(owner);
  }
  const out = [];
  for (const t of store3.awaiting) {
    const tt = t;
    if (inst !== undefined && tt.task.inst !== inst)
      continue;
    if (!suspended.has(t))
      out.push(tt);
  }
  return out;
}
async function awaitHopQuiescence(store3, inst) {
  for (;; ) {
    const hops = entryHopThreads(store3, inst);
    if (hops.length === 0)
      return;
    await Promise.race(hops.map((t) => (t.awaiting ?? Promise.resolve()).then(() => {
      return;
    }, () => {
      return;
    })));
    store3.serviceSettled();
  }
}
var DTOR_FT = {
  params: [{ kind: "u32" }],
  results: [],
  async: false
};
function dtorOptions(instance) {
  return {
    stringEncoding: "utf8",
    memory: null,
    realloc: null,
    postReturn: null,
    callback: null,
    async: false,
    cancellable: false,
    coreType: { params: ["i32"], results: [] },
    instance
  };
}
function createDtorEntry(input) {
  const mode = input.suspensionMode ?? "plain";
  const raw = input.dtor ?? (() => {
    return;
  });
  const core = mode === "jspi" ? raw : (rep) => {
    const r = raw(rep);
    return isPromiseLike(r) ? r : undefined;
  };
  const lifted = createLiftedFunction({
    name: input.name ?? "[resource-dtor]",
    ft: DTOR_FT,
    opts: dtorOptions(input.instance),
    core,
    stats: input.stats ?? newStats(),
    suspensionMode: mode,
    trapState: input.trapState,
    syncCallStack: input.syncCallStack,
    allInstances: input.allInstances,
    allowAsyncCompletion: true
  });
  return (rep) => lifted(rep);
}
function hostDtorCall(rt, rep) {
  const impl = rt.impl;
  if (impl === null) {
    rt.dtor?.(rep);
    return;
  }
  if (rt.dtorHost === null) {
    rt.dtorHost = createDtorEntry({
      dtor: rt.dtor,
      instance: impl
    });
  }
  const out = rt.dtorHost(rep);
  if (isPromiseLike(out)) {
    const store3 = impl.store;
    Promise.resolve(out).catch((e) => {
      if (store3 !== undefined && store3.hostFailure === undefined) {
        store3.hostFailure = e;
      }
    });
  }
}
function* awaitCore(fn, args, thread2) {
  const raw = withActivation(thread2, () => callCore(fn, args));
  if (raw.length === 1 && isPromiseLike(raw[0])) {
    const settled = yield {
      readyFunc: null,
      cancellable: false,
      awaitValue: Promise.resolve(raw[0]).then(undefined, (e) => {
        throw mapCoreException(e);
      })
    };
    if (settled === undefined)
      return [];
    return Array.isArray(settled) ? settled : [settled];
  }
  return raw;
}
var CallbackCode;
(function(CallbackCode2) {
  CallbackCode2[CallbackCode2["EXIT"] = 0] = "EXIT";
  CallbackCode2[CallbackCode2["YIELD"] = 1] = "YIELD";
  CallbackCode2[CallbackCode2["WAIT"] = 2] = "WAIT";
})(CallbackCode || (CallbackCode = {}));
var CALLBACK_CODE_MAX = 2;
function unpackCallbackResult(packed) {
  assert_(packed >= 0 && packed < 2 ** 32, `unpack-callback-result: packed out of range: ${packed}`);
  const code = packed & 15;
  trapIf(code > CALLBACK_CODE_MAX, `invalid callback code ${code}`);
  return [code, packed >>> 4];
}
function* liftBody(input) {
  const { name, ft, opts, core, stats, task } = input;
  const thread2 = input.thread();
  const inst = opts.instance;
  if (!(yield* task.enterImplicitThread(thread2)))
    return;
  const cx = new LiftLowerContext(cabiOptions(opts), inst, task);
  const args = task.start();
  const flatArgs = lowerFlatValues(cx, MAX_FLAT_PARAMS, args, ft.params);
  if (!opts.async) {
    const flatResults = normalizeCoreValues(yield* awaitCore(core, flatArgs, thread2), opts.coreType.results, `${name} results`);
    const results = liftFlatValues(cx, MAX_FLAT_RESULTS, new CoreValueIter(flatResults), ft.results);
    task.return_(results);
    const postReturn = require2(opts.postReturn, `${name} post-return`);
    if (postReturn !== null) {
      assert_(inst.mayLeave, "post-return with may_leave already false");
      inst.mayLeave = false;
      callCore(postReturn, flatResults);
      inst.mayLeave = true;
      stats.postReturnsRun++;
    }
    task.exitImplicitThread(thread2);
    return;
  }
  if (opts.callback === null) {
    if (input.mode !== "jspi") {
      needsJspi(`stackful async lift of export '${name}' (async canonical options ` + `without a callback)`);
    }
    yield* awaitCore(core, flatArgs, thread2);
    task.exitImplicitThread(thread2);
    return;
  }
  const callback = enterWasm(require2(opts.callback, `${name} callback`), input.mode);
  const [packed] = normalizeCoreValues(yield* awaitCore(core, flatArgs, thread2), opts.coreType.results, `${name} results`);
  yield* runCallbackLoop({ name, task, thread: thread2, inst, callback, packed, stats });
  task.exitImplicitThread(thread2);
}
function createLoweredImport(input) {
  const { name, ft, opts, hostFn, stats, mode, suspendable, deferCancel: deferCancel2, abortable: abortable2 } = input;
  const inst = opts.instance;
  const store3 = inst.store;
  const computed = flattenFunctype(cabiOptions(opts), ft, "lower");
  if (!coreFuncTypeEquals(computed, opts.coreType)) {
    throw new PlanError(`import '${name}': computed flat type ${JSON.stringify(computed)} ` + `!= plan coreType ${JSON.stringify(opts.coreType)}`);
  }
  const maxFlatParams = opts.async ? MAX_FLAT_ASYNC_PARAMS : MAX_FLAT_PARAMS;
  const maxFlatResults = opts.async ? 0 : MAX_FLAT_RESULTS;
  return (...rawFlatArgs) => {
    stats.loweredCalls++;
    trapIf(!inst.mayLeave, `cannot leave component instance ${inst.index} (may_leave violation)`);
    const subtask2 = new Subtask;
    const cx = new LiftLowerContext(cabiOptions(opts), inst, subtask2);
    const vi = new CoreValueIter(normalizeCoreValues(rawFlatArgs, opts.coreType.params, `${name} args`));
    let onProgress = () => {};
    const onStart = () => {
      onProgress();
      assert_(subtask2.state === SubtaskState.STARTING, `${name}: on_start on a started subtask`);
      subtask2.state = SubtaskState.STARTED;
      return liftFlatValues(cx, maxFlatParams, vi, ft.params);
    };
    const onResolve = (result) => {
      onProgress();
      if (result === null) {
        assert_(subtask2.cancellationRequested, `${name}: resolved as cancelled without a cancellation request`);
        subtask2.resolve(subtask2.state === SubtaskState.STARTING ? SubtaskState.CANCELLED_BEFORE_STARTED : SubtaskState.CANCELLED_BEFORE_RETURNED, []);
        return;
      }
      assert_(subtask2.state === SubtaskState.STARTED, `${name}: on_resolve on a subtask that never started`);
      const flatResults = lowerFlatValues(cx, maxFlatResults, result, ft.results, vi);
      subtask2.resolve(SubtaskState.RETURNED, flatResults);
    };
    subtask2.onCancel = () => {};
    const controller = abortable2 ? new AbortController : null;
    const args = onStart();
    const raw = controller === null ? hostFn(...args) : hostFn(...args, controller.signal);
    const toResults = (v) => ft.results.length === 0 ? [] : [v];
    if (isPromiseLike(raw)) {
      if (!opts.async) {
        if (mode !== "jspi" || !suspendable) {
          subtask2.unwindLenders();
          needsJspi(suspendable ? `synchronous lower of import '${name}', whose host ` + `implementation returned a Promise (the guest's wasm frame ` + `must block)` : `synchronous lower of import '${name}', whose host ` + `implementation returned a Promise; a sync-typed import may ` + `only park the frame when declared with suspending() ` + `(contracts/embedder-api.md §"Functions and async")`);
        }
        let outcome;
        const promise2 = Promise.resolve(raw).then((v) => {
          store3.pendingHostCalls.delete(promise2);
          outcome = { value: v };
        }, (e) => {
          store3.pendingHostCalls.delete(promise2);
          outcome = { error: e };
        });
        registerHostCall(store3, promise2);
        return blockCurrentActivation({
          store: store3,
          task: currentTask(),
          readyFunc: () => outcome !== undefined,
          cancellable: false,
          produce: () => {
            const done = outcome;
            if ("error" in done) {
              throw done.error;
            }
            onResolve(toResults(done.value));
            subtask2.deliverResolve();
            assert_(vi.done(), `${name}: unconsumed flat arguments`);
            const flatResults = subtask2.flatResults;
            if (flatResults.length === 0)
              return;
            if (flatResults.length === 1)
              return flatResults[0];
            return flatResults;
          },
          onSettled: () => subtask2.unwindLenders()
        });
      }
      const promise = Promise.resolve(raw).then((v) => {
        store3.pendingHostCalls.delete(promise);
        if (subtask2.resolved() || isInstancePoisoned(opts.instance))
          return;
        try {
          onResolve(toResults(v));
        } catch (e) {
          store3.hostFailure = e;
        }
      }, (e) => {
        store3.pendingHostCalls.delete(promise);
        if (subtask2.resolved() || isInstancePoisoned(opts.instance))
          return;
        store3.hostFailure = e;
      });
      registerHostCall(store3, promise);
      if (!deferCancel2) {
        subtask2.onCancel = () => {
          store3.pendingHostCalls.delete(promise);
          onResolve(null);
          if (controller !== null) {
            Promise.resolve().then(() => controller.abort());
          }
        };
      }
    } else {
      onResolve(toResults(raw));
    }
    assert_(ft.async || subtask2.resolved(), `${name}: a non-async-typed import must resolve before returning`);
    if (!opts.async) {
      if (!subtask2.resolved()) {
        needsJspi(`synchronous lower of import '${name}' on an unresolved subtask`);
      }
      subtask2.deliverResolve();
      assert_(vi.done(), `${name}: unconsumed flat arguments`);
      const flatResults = subtask2.flatResults;
      if (flatResults.length === 0)
        return;
      if (flatResults.length === 1)
        return flatResults[0];
      return flatResults;
    }
    if (subtask2.resolved()) {
      subtask2.deliverResolve();
      assert_(subtask2.flatResults.length === 0, `${name}: async lower produced flat results`);
      return SubtaskState.RETURNED;
    }
    const subtaski = inst.handles.add(subtask2);
    onProgress = () => subtask2.setSubtaskPendingEvent(subtaski);
    return packSubtaskResult(subtask2.state, subtaski);
  };
}
function* runCallbackLoop(input) {
  const { name, task, thread: thread2, inst, callback, stats } = input;
  let [code, si] = unpackCallbackResult(input.packed);
  while (code !== CallbackCode.EXIT) {
    assert_(task.needsExclusive() && inst.exclusiveThread === task.implicitThread, "callback loop without holding the exclusive thread");
    inst.exclusiveThread = null;
    let event;
    switch (code) {
      case CallbackCode.YIELD: {
        const cancelled = yield* thread2.waitUntil(() => inst.exclusiveThread === null, true);
        event = cancelled ? [EventCode.TASK_CANCELLED, 0, 0] : [EventCode.NONE, 0, 0];
        break;
      }
      case CallbackCode.WAIT: {
        const wset = inst.handles.get(si);
        trapIf(!(wset instanceof WaitableSet), `callback returned WAIT with index ${si}, which is not a waitable set`);
        event = yield* wset.waitForEventAnd(thread2, () => inst.exclusiveThread === null, true);
        break;
      }
      default:
        trap(`invalid callback code ${code}`);
    }
    assert_(inst.exclusiveThread === null, "exclusive thread taken while this task was waiting");
    inst.exclusiveThread = task.implicitThread;
    stats.callbackInvocations++;
    const [next] = normalizeCoreValues(yield* awaitCore(callback, [event[0], event[1], event[2]], thread2), ["i32"], `${name} callback result`);
    [code, si] = unpackCallbackResult(next);
  }
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/intrinsics/errors.js
class UnsupportedFeatureError extends Error {
  capability;
  constructor(capability, what) {
    super(`${what} — needs the "${capability}" capability, not yet implemented ` + `in the current executor (contracts/intrinsics.md §B)`);
    this.capability = capability;
    this.name = "UnsupportedFeatureError";
  }
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/intrinsics/stream_builtins.js
var COPY_TRACE = (() => {
  try {
    return Deno.env.get("CE_COPY_TRACE") === "1";
  } catch {
    return false;
  }
})();
function traceCopy(msg) {
  if (COPY_TRACE)
    console.error(`[copy] ${msg}`);
}
function createStreamNew(decl, ctx, inst) {
  return () => {
    trapIf(!inst.mayLeave, "stream.new: cannot leave component instance");
    const shared = new SharedStreamImpl(ctx.streamElem(decl.streamTable));
    const ri = inst.handles.add(new ReadableStreamEnd(shared));
    const wi = inst.handles.add(new WritableStreamEnd(shared));
    return packEnds(ri, wi);
  };
}
function createFutureNew(decl, ctx, inst) {
  return () => {
    trapIf(!inst.mayLeave, "future.new: cannot leave component instance");
    const shared = new SharedFutureImpl(ctx.futureElem(decl.futureTable));
    const ri = inst.handles.add(new ReadableFutureEnd(shared));
    const wi = inst.handles.add(new WritableFutureEnd(shared));
    return packEnds(ri, wi);
  };
}
function packEnds(ri, wi) {
  return BigInt(ri >>> 0) | BigInt(wi >>> 0) << 32n;
}
function streamCopy(input) {
  const { EndT, reading, eventCode, elem, opts, inst, i, ptr, n } = input;
  const mode = input.mode ?? "plain";
  trapIf(!inst.mayLeave, "stream copy: cannot leave component instance");
  const e = inst.handles.get(i);
  trapIf(!(e instanceof EndT), "stream copy: wrong end type for this handle");
  const end = e;
  trapIf(!sameElemType(end.shared.t, elem), "stream copy: element type mismatch");
  trapIf(end.state === CopyState.DONE, reading ? "cannot read from stream after being notified that the writable end dropped" : "cannot write to stream after being notified that the readable end dropped");
  trapIf(end.state !== CopyState.IDLE, "cannot have concurrent operations active on a future/stream");
  trapIf(end.inWaitableSet() && !opts.async, "synchronous stream copy on an end that is in a waitable set");
  const cx = new LiftLowerContext(cabiOptions(opts), inst, null);
  const buffer = new GuestBuffer(elem, cx, ptr, n);
  assert_(elem === null || elem.kind !== "char", "stream copy: char element");
  const streamEvent = (result, reclaim) => {
    reclaim();
    assert_(end.copying(), "stream event on a non-copying end");
    end.state = result === CopyResult.DROPPED ? CopyState.DONE : CopyState.IDLE;
    assert_(buffer.progress <= BUFFER_MAX_LENGTH, "stream progress out of packing range");
    assert_(result >= 0 && result < 2 ** 4, "stream event: packed result out of 4-bit range");
    return [eventCode, i, (result | buffer.progress << 4) >>> 0];
  };
  end.state = CopyState.COPYING;
  const onCopy = (reclaim) => end.setPendingEvent(() => streamEvent(CopyResult.COMPLETED, reclaim));
  const onCopyDone = (result) => end.setPendingEvent(() => streamEvent(result, () => {}));
  if (reading) {
    end.copy(inst, buffer, onCopy, onCopyDone);
  } else {
    end.copy(inst, buffer, onCopy, onCopyDone);
  }
  return finishCopy(end, eventCode, i, opts.async, "stream", inst, mode);
}
function futureCopy(input) {
  const { EndT, reading, eventCode, elem, opts, inst, i, ptr } = input;
  const mode = input.mode ?? "plain";
  trapIf(!inst.mayLeave, "future copy: cannot leave component instance");
  const e = inst.handles.get(i);
  trapIf(!(e instanceof EndT), "future copy: wrong end type for this handle");
  const end = e;
  trapIf(!sameElemType(end.shared.t, elem), "future copy: element type mismatch");
  trapIf(end.state === CopyState.DONE, reading ? "cannot read from future after previous read succeeded" : "cannot write to future after previous write succeeded or readable end dropped");
  trapIf(end.state !== CopyState.IDLE, "cannot have concurrent operations active on a future/stream");
  trapIf(end.inWaitableSet() && !opts.async, "synchronous future copy on an end that is in a waitable set");
  const cx = new LiftLowerContext(cabiOptions(opts), inst, null);
  const buffer = new GuestBuffer(elem, cx, ptr, 1);
  const futureEvent = (result) => {
    assert_(buffer.remain() === 0 === (result === CopyResult.COMPLETED), "future event/progress disagreement");
    assert_(end.copying(), "future event on a non-copying end");
    end.state = result === CopyResult.DROPPED || result === CopyResult.COMPLETED ? CopyState.DONE : CopyState.IDLE;
    return [eventCode, i, result];
  };
  end.state = CopyState.COPYING;
  const onCopyDone = (result) => {
    const abandoned = reading && result === CopyResult.DROPPED ? abandonReasonOf(end.shared) : null;
    if (abandoned !== null) {
      end.setPendingEvent(() => {
        throw futureAbandonTrap(abandoned);
      });
      return;
    }
    assert_(result !== CopyResult.DROPPED || eventCode === EventCode.FUTURE_WRITE, "a readable future end cannot observe DROPPED");
    end.setPendingEvent(() => futureEvent(result));
  };
  if (reading) {
    end.copy(inst, buffer, onCopyDone);
  } else {
    end.copy(inst, buffer, onCopyDone);
  }
  return finishCopy(end, eventCode, i, opts.async, "future", inst, mode);
}
function finishCopy(end, eventCode, i, async_, what, inst, mode = "plain") {
  const take = () => {
    const [code, index, payload] = end.getPendingEvent();
    assert_(code === eventCode && index === i, `unexpected event delivered by a ${what} copy`);
    return payload;
  };
  if (!end.hasPendingEvent()) {
    if (!async_) {
      if (mode === "jspi" && inst !== undefined) {
        end.hasSyncWaiter = true;
        traceCopy(`${what} sync copy i=${i} BLOCKS`);
        return blockCurrentActivation({
          store: inst.store,
          task: currentTask(),
          readyFunc: () => end.hasPendingEvent(),
          cancellable: false,
          produce: () => {
            end.hasSyncWaiter = false;
            const p2 = take();
            traceCopy(`${what} sync copy i=${i} RESUME -> 0x${p2.toString(16)}`);
            return p2;
          },
          onSettled: () => {
            end.hasSyncWaiter = false;
          }
        });
      }
      needsJspi(`synchronous ${what} copy with no counterpart ready (the calling ` + `wasm frame must block until the other end arrives)`);
    }
    traceCopy(`${what} async copy i=${i} -> BLOCKED`);
    return BLOCKED;
  }
  const p = take();
  traceCopy(`${what} copy(async=${async_}) i=${i} -> 0x${p.toString(16)}`);
  return p;
}
function takeCancelEvent(end, eventCode, i, what) {
  const [code, index, payload] = end.getPendingEvent();
  assert_(!end.copying() && code === eventCode && index === i, `unexpected event delivered by ${what}`);
  const isStreamEvent = eventCode === EventCode.STREAM_READ || eventCode === EventCode.STREAM_WRITE;
  if (isStreamEvent && (payload & 15) === CopyResult.COMPLETED) {
    const p = (payload & ~15 | CopyResult.CANCELLED) >>> 0;
    traceCopy(`${what} i=${i} -> 0x${p.toString(16)} (superseded COMPLETED)`);
    return p;
  }
  traceCopy(`${what} i=${i} -> 0x${payload.toString(16)}`);
  return payload;
}
function cancelCopy(input) {
  const { EndT, eventCode, elem, inst, async_, i, what } = input;
  const mode = input.mode ?? "plain";
  trapIf(!inst.mayLeave, `${what}: cannot leave component instance`);
  const e = inst.handles.get(i);
  trapIf(!(e instanceof EndT), `${what}: wrong end type for this handle`);
  const end = e;
  trapIf(!sameElemType(end.shared.t, elem), `${what}: element type mismatch`);
  trapIf(end.state !== CopyState.COPYING || end.hasSyncWaiter, `${what}: end is not in a cancellable copy`);
  trapIf(end.inWaitableSet() && !async_, `${what}: synchronous cancel on an end that is in a waitable set`);
  end.state = CopyState.CANCELLING_COPY;
  if (!end.hasPendingEvent()) {
    end.shared.cancel();
    if (!end.hasPendingEvent()) {
      if (!async_) {
        if (mode === "jspi") {
          return blockCurrentActivation({
            store: inst.store,
            task: currentTask(),
            readyFunc: () => end.hasPendingEvent(),
            cancellable: false,
            produce: () => takeCancelEvent(end, eventCode, i, what)
          });
        }
        needsJspi(`synchronous ${what} whose copy did not settle immediately (the ` + `calling wasm frame must block)`);
      }
      return BLOCKED;
    }
  }
  return takeCancelEvent(end, eventCode, i, what);
}
function dropEnd(EndT, elem, inst, hi, what) {
  hi = hi >>> 0;
  trapIf(!inst.mayLeave, `${what}: cannot leave component instance`);
  const e = inst.handles.remove(hi);
  trapIf(!(e instanceof EndT), `${what}: wrong end type for this handle`);
  const end = e;
  trapIf(!sameElemType(end.shared.t, elem), `${what}: element type mismatch`);
  end.drop();
}
function createErrorContextNew(decl, ctx, inst) {
  const opts = ctx.options(decl.options);
  return (ptr, taggedCodeUnits) => {
    ptr = (ptr ?? 0) >>> 0;
    taggedCodeUnits = (taggedCodeUnits ?? 0) >>> 0;
    trapIf(!inst.mayLeave, "error-context.new: cannot leave component instance");
    const cx = new LiftLowerContext(cabiOptions(opts), inst, null);
    const s = loadStringFromRange(cx, ptr, taggedCodeUnits);
    return inst.handles.add(new ErrorContext(s));
  };
}
function createErrorContextDebugMessage(decl, ctx, inst) {
  const opts = ctx.options(decl.options);
  return (i, ptr) => {
    i = (i ?? 0) >>> 0;
    ptr = (ptr ?? 0) >>> 0;
    trapIf(!inst.mayLeave, "error-context.debug-message: cannot leave component instance");
    const e = inst.handles.get(i);
    trapIf(!(e instanceof ErrorContext), errorContextTrapMessage("error-context.debug-message", e));
    const cx = new LiftLowerContext(cabiOptions(opts), inst, null);
    storeString(cx, e.debugMessage, ptr);
  };
}
function createErrorContextDrop(inst) {
  return (i) => {
    i = (i ?? 0) >>> 0;
    trapIf(!inst.mayLeave, "error-context.drop: cannot leave component instance");
    const e = inst.handles.remove(i);
    trapIf(!(e instanceof ErrorContext), errorContextTrapMessage("error-context.drop", e));
  };
}
function createStreamRead(d, ctx, inst) {
  const opts = ctx.options(d.options);
  const elem = ctx.streamElem(d.streamTable);
  return (i, ptr, n) => streamCopy({
    mode: ctx.suspensionMode ?? "plain",
    EndT: ReadableStreamEnd,
    reading: true,
    eventCode: EventCode.STREAM_READ,
    elem,
    opts,
    inst,
    i: (i ?? 0) >>> 0,
    ptr: (ptr ?? 0) >>> 0,
    n: (n ?? 0) >>> 0
  });
}
function createStreamWrite(d, ctx, inst) {
  const opts = ctx.options(d.options);
  const elem = ctx.streamElem(d.streamTable);
  return (i, ptr, n) => streamCopy({
    mode: ctx.suspensionMode ?? "plain",
    EndT: WritableStreamEnd,
    reading: false,
    eventCode: EventCode.STREAM_WRITE,
    elem,
    opts,
    inst,
    i: (i ?? 0) >>> 0,
    ptr: (ptr ?? 0) >>> 0,
    n: (n ?? 0) >>> 0
  });
}
function createFutureRead(d, ctx, inst) {
  const opts = ctx.options(d.options);
  const elem = ctx.futureElem(d.futureTable);
  return (i, ptr) => futureCopy({
    mode: ctx.suspensionMode ?? "plain",
    EndT: ReadableFutureEnd,
    reading: true,
    eventCode: EventCode.FUTURE_READ,
    elem,
    opts,
    inst,
    i: (i ?? 0) >>> 0,
    ptr: (ptr ?? 0) >>> 0
  });
}
function createFutureWrite(d, ctx, inst) {
  const opts = ctx.options(d.options);
  const elem = ctx.futureElem(d.futureTable);
  return (i, ptr) => futureCopy({
    mode: ctx.suspensionMode ?? "plain",
    EndT: WritableFutureEnd,
    reading: false,
    eventCode: EventCode.FUTURE_WRITE,
    elem,
    opts,
    inst,
    i: (i ?? 0) >>> 0,
    ptr: (ptr ?? 0) >>> 0
  });
}
function createStreamCancelRead(d, ctx, inst) {
  const elem = ctx.streamElem(d.streamTable);
  return (i) => cancelCopy({
    mode: ctx.suspensionMode ?? "plain",
    EndT: ReadableStreamEnd,
    eventCode: EventCode.STREAM_READ,
    elem,
    inst,
    async_: d.async === true,
    i: (i ?? 0) >>> 0,
    what: "stream.cancel-read"
  });
}
function createStreamCancelWrite(d, ctx, inst) {
  const elem = ctx.streamElem(d.streamTable);
  return (i) => cancelCopy({
    mode: ctx.suspensionMode ?? "plain",
    EndT: WritableStreamEnd,
    eventCode: EventCode.STREAM_WRITE,
    elem,
    inst,
    async_: d.async === true,
    i: (i ?? 0) >>> 0,
    what: "stream.cancel-write"
  });
}
function createFutureCancelRead(d, ctx, inst) {
  const elem = ctx.futureElem(d.futureTable);
  return (i) => cancelCopy({
    mode: ctx.suspensionMode ?? "plain",
    EndT: ReadableFutureEnd,
    eventCode: EventCode.FUTURE_READ,
    elem,
    inst,
    async_: d.async === true,
    i: (i ?? 0) >>> 0,
    what: "future.cancel-read"
  });
}
function createFutureCancelWrite(d, ctx, inst) {
  const elem = ctx.futureElem(d.futureTable);
  return (i) => cancelCopy({
    mode: ctx.suspensionMode ?? "plain",
    EndT: WritableFutureEnd,
    eventCode: EventCode.FUTURE_WRITE,
    elem,
    inst,
    async_: d.async === true,
    i: (i ?? 0) >>> 0,
    what: "future.cancel-write"
  });
}
function createStreamDropReadable(d, ctx, inst) {
  const elem = ctx.streamElem(d.streamTable);
  return (i) => dropEnd(ReadableStreamEnd, elem, inst, i ?? 0, "stream.drop-readable");
}
function createStreamDropWritable(d, ctx, inst) {
  const elem = ctx.streamElem(d.streamTable);
  return (i) => dropEnd(WritableStreamEnd, elem, inst, i ?? 0, "stream.drop-writable");
}
function createFutureDropReadable(d, ctx, inst) {
  const elem = ctx.futureElem(d.futureTable);
  return (i) => dropEnd(ReadableFutureEnd, elem, inst, i ?? 0, "future.drop-readable");
}
function createFutureDropWritable(d, ctx, inst) {
  const elem = ctx.futureElem(d.futureTable);
  return (i) => dropEnd(WritableFutureEnd, elem, inst, i ?? 0, "future.drop-writable");
}
function transferAsyncEnd(input) {
  const { EndT, srcInst, dstInst, srcElem, dstElem, srcIdx, what } = input;
  const e = srcInst.handles.remove(srcIdx);
  trapIf(!(e instanceof EndT), `${what}: handle is not a readable ${what} end`);
  const end = e;
  trapIf(!sameElemType(end.shared.t, srcElem), `${what}: source element mismatch`);
  trapIf(!sameElemType(end.shared.t, dstElem), `${what}: destination element mismatch`);
  trapIf(end.state === CopyState.DONE, what === "future" ? "cannot lift future after previous read succeeded" : "cannot lift stream after being notified that the writable end dropped");
  trapIf(end.state !== CopyState.IDLE, `cannot remove busy ${what}`);
  trapIf(end.inWaitableSet(), `cannot lift ${what} while it's in a waitable set`);
  const Ctor = EndT;
  return dstInst.handles.add(new Ctor(end.shared));
}
function createStreamTransfer(ctx) {
  return (srcIdx, srcTable, dstTable) => {
    srcTable = (srcTable ?? 0) >>> 0;
    dstTable = (dstTable ?? 0) >>> 0;
    return transferAsyncEnd({
      EndT: ReadableStreamEnd,
      srcInst: ctx.streamTableInstance(srcTable),
      dstInst: ctx.streamTableInstance(dstTable),
      srcElem: ctx.streamElem(srcTable),
      dstElem: ctx.streamElem(dstTable),
      srcIdx: (srcIdx ?? 0) >>> 0,
      what: "stream"
    });
  };
}
function createFutureTransfer(ctx) {
  return (srcIdx, srcTable, dstTable) => {
    srcTable = (srcTable ?? 0) >>> 0;
    dstTable = (dstTable ?? 0) >>> 0;
    return transferAsyncEnd({
      EndT: ReadableFutureEnd,
      srcInst: ctx.futureTableInstance(srcTable),
      dstInst: ctx.futureTableInstance(dstTable),
      srcElem: ctx.futureElem(srcTable),
      dstElem: ctx.futureElem(dstTable),
      srcIdx: (srcIdx ?? 0) >>> 0,
      what: "future"
    });
  };
}
function createErrorContextTransfer(ctx, instanceOf) {
  return (srcIdx, srcTable, dstTable) => {
    assert_(typeof srcIdx === "number" && typeof srcTable === "number" && typeof dstTable === "number", "error-context transfer: expected (handle, srcTable, dstTable)");
    const srcInst = instanceOf(srcTable);
    const dstInst = instanceOf(dstTable);
    const e = srcInst.handles.get(srcIdx);
    trapIf(!(e instanceof ErrorContext), errorContextTrapMessage("error-context transfer", e));
    return dstInst.handles.add(e);
  };
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/intrinsics/async_builtins.js
var BLOCKED = 4294967295;
function createTaskReturn(decl, ctx) {
  const opts = ctx.options(decl.options);
  const resultTypes = decl.resultType === null ? [] : ctx.resultTypes(decl.resultType);
  return (...flatArgs) => {
    const task = currentTask();
    trapIf(!task.inst.mayLeave, "task.return: cannot leave component instance (may_leave violation)");
    trapIf(!task.opts.async_, "task.return from a non-async task");
    trapIf((!task.factPassthrough || task.factResultTypesKnown) && !valTypesEqual(resultTypes, task.ft.results), "task.return with a result type that is not the task's result type");
    trapIf(!liftOptionsEqual({ stringEncoding: opts.stringEncoding, memory: opts.memory }, task.factPassthrough ? { stringEncoding: task.opts.stringEncoding, memory: opts.memory } : task.opts), "task.return with canonical options differing from the task's");
    const flat = normalizeCoreValues(flatArgs, opts.coreType.params, "task.return arguments");
    if (task.factPassthrough) {
      task.return_(flat);
      return;
    }
    const cx = new LiftLowerContext(cabiOptions(opts), task.inst, task);
    const vi = new CoreValueIter(flat);
    const result = liftFlatValues(cx, MAX_FLAT_PARAMS, vi, task.ft.results);
    task.return_(result);
  };
}
function createTaskCancel() {
  return () => {
    const task = currentTask();
    trapIf(!task.inst.mayLeave, "task.cancel: cannot leave component instance (may_leave violation)");
    trapIf(!task.opts.async_, "task.cancel from a non-async task");
    task.cancel();
  };
}
function createBackpressureInc(inst) {
  return () => {
    assert_(inst.backpressure >= 0 && inst.backpressure < 2 ** 16, "backpressure counter out of range");
    inst.backpressure += 1;
    trapIf(inst.backpressure === 2 ** 16, "backpressure counter overflow");
  };
}
function createBackpressureDec(inst) {
  return () => {
    assert_(inst.backpressure >= 0 && inst.backpressure < 2 ** 16, "backpressure counter out of range");
    inst.backpressure -= 1;
    trapIf(inst.backpressure < 0, "backpressure counter underflow");
  };
}
function createWaitableSetNew(inst) {
  return () => {
    trapIf(!inst.mayLeave, "waitable-set.new: cannot leave component instance");
    return inst.handles.add(new WaitableSet);
  };
}
function createWaitableSetWait(decl, ctx, inst, mode = "plain") {
  const opts = ctx.options(decl.options);
  const cancellable = opts.cancellable;
  return (si, ptr) => {
    si = (si ?? 0) >>> 0;
    ptr = (ptr ?? 0) >>> 0;
    trapIf(!inst.mayLeave, "waitable-set.wait: cannot leave component instance");
    const wset = requireWaitableSet(inst, si, "waitable-set.wait");
    const task = currentTask();
    let event;
    if (task.deliverPendingCancel(cancellable)) {
      event = [EventCode.TASK_CANCELLED, 0, 0];
    } else if (wset.hasPendingEvent()) {
      traceCopy(`waitable-set.wait si=${si} FAST (pending event)`);
      event = wset.getPendingEvent();
    } else if (mode === "jspi") {
      traceCopy(`waitable-set.wait si=${si} BLOCKS`);
      wset.numWaiting += 1;
      return blockCurrentActivation({
        store: inst.store,
        task,
        readyFunc: () => wset.hasPendingEvent(),
        cancellable,
        produce: (cancelled) => {
          const ev = cancelled ? [EventCode.TASK_CANCELLED, 0, 0] : wset.getPendingEvent();
          return unpackEvent(opts, inst, ptr, ev);
        },
        onSettled: () => {
          wset.numWaiting -= 1;
        }
      });
    } else {
      needsJspi("waitable-set.wait with no pending event (the calling wasm frame " + "must block; a callback-ABI guest should return the WAIT code " + "instead)");
    }
    return unpackEvent(opts, inst, ptr, event);
  };
}
function createWaitableSetPoll(decl, ctx, inst) {
  const opts = ctx.options(decl.options);
  const cancellable = opts.cancellable;
  return (si, ptr) => {
    si = (si ?? 0) >>> 0;
    ptr = (ptr ?? 0) >>> 0;
    trapIf(!inst.mayLeave, "waitable-set.poll: cannot leave component instance");
    const wset = requireWaitableSet(inst, si, "waitable-set.poll");
    const event = wset.poll(currentTask(), cancellable);
    return unpackEvent(opts, inst, ptr, event);
  };
}
function createWaitableSetDrop(inst) {
  return (i) => {
    i = (i ?? 0) >>> 0;
    trapIf(!inst.mayLeave, "waitable-set.drop: cannot leave component instance");
    const wset = inst.handles.remove(i);
    trapIf(!(wset instanceof WaitableSet), "waitable-set.drop: handle is not a waitable set");
    wset.drop();
  };
}
function createWaitableJoin(inst) {
  return (wi, si) => {
    wi = (wi ?? 0) >>> 0;
    si = (si ?? 0) >>> 0;
    trapIf(!inst.mayLeave, "waitable.join: cannot leave component instance");
    const w = inst.handles.get(wi);
    trapIf(!(w instanceof Waitable), "waitable.join: handle is not a waitable");
    trapIf(w.hasSyncWaiter, "waitable cannot be used synchronously while added to a waitable set " + "(waitable.join)");
    if (si === 0) {
      w.join(null);
      return;
    }
    const wset = requireWaitableSet(inst, si, "waitable.join");
    w.join(wset);
  };
}
function createSubtaskDrop(inst) {
  return (i) => {
    i = (i ?? 0) >>> 0;
    trapIf(!inst.mayLeave, "subtask.drop: cannot leave component instance");
    const s = inst.handles.remove(i);
    trapIf(!(s instanceof Subtask), "subtask.drop: handle is not a subtask");
    s.drop();
  };
}
function finishSubtaskCancel(i, st) {
  return () => {
    const [code, index, payload] = st.getPendingEvent();
    assert_(code === EventCode.SUBTASK && index === (i ?? 0) && payload === st.state, "unexpected event delivered by subtask.cancel");
    assert_(st.resolveDelivered(), "subtask.cancel did not deliver the resolution");
    return st.state;
  };
}
function createSubtaskCancel(decl, inst, mode = "plain") {
  const async_ = decl.async === true;
  return (i) => {
    i = (i ?? 0) >>> 0;
    trapIf(!inst.mayLeave, "subtask.cancel: cannot leave component instance");
    const subtask2 = inst.handles.get(i);
    trapIf(!(subtask2 instanceof Subtask), "subtask.cancel: handle is not a subtask");
    const st = subtask2;
    const finish = finishSubtaskCancel(i, st);
    trapIf(st.resolveDelivered(), "subtask.cancel on a subtask whose resolution was already delivered");
    trapIf(st.cancellationRequested, "subtask.cancel on a subtask that was already cancelled");
    trapIf(st.inWaitableSet(), "waitable cannot be used synchronously while added to a waitable set " + "(subtask.cancel)");
    if (st.resolved()) {
      assert_(st.hasPendingEvent(), "resolved subtask without a pending event at cancellation");
    } else {
      st.cancellationRequested = true;
      assert_(st.onCancel !== null, "subtask.cancel on a subtask with no cancellation handler");
      st.hasSyncWaiter = true;
      let parked = false;
      try {
        st.onCancel(inst);
        const callee = st.calleeTask;
        const store3 = inst.store;
        const determinate = () => callee === null || callee.threads.every((th) => th.done()) || store3.waiting.some((w) => w.task === st.calleeTask);
        const ready = () => determinate() && (async_ || st.hasPendingEvent());
        if (mode !== "jspi") {
          if (st.resolved())
            return finish();
          if (!async_) {
            needsJspi("synchronous subtask.cancel whose callee did not resolve " + "immediately (the calling wasm frame must block)");
          }
          return BLOCKED;
        }
        if (!ready()) {
          parked = true;
          if (async_)
            st.hasSyncWaiter = false;
          return blockCurrentActivation({
            store: inst.store,
            task: currentTask(),
            readyFunc: ready,
            cancellable: false,
            produce: () => {
              st.hasSyncWaiter = false;
              return st.resolved() ? finish() : BLOCKED;
            },
            onSettled: () => {
              st.hasSyncWaiter = false;
            }
          });
        }
        return st.resolved() ? finish() : BLOCKED;
      } finally {
        if (!parked)
          st.hasSyncWaiter = false;
      }
    }
    return finish();
  };
}
function createThreadYield(decl, mode = "plain") {
  const cancellable = decl.cancellable === true;
  return () => {
    const thread2 = currentThread();
    trapIf(!thread2.task.inst.mayLeave, "thread.yield: cannot leave component instance");
    if (thread2.task.deliverPendingCancel(cancellable))
      return 1;
    if (mode === "jspi") {
      return blockCurrentActivation({
        store: thread2.task.inst.store,
        task: thread2.task,
        readyFunc: () => true,
        cancellable,
        produce: (cancelled) => cancelled ? 1 : 0
      });
    }
    needsJspi("thread.yield (the calling wasm frame must block; a callback-ABI " + "guest should return the YIELD code instead)");
  };
}
function requireWaitableSet(inst, si, what) {
  const wset = inst.handles.get(si);
  trapIf(!(wset instanceof WaitableSet), `${what}: handle ${si} is not a waitable set`);
  return wset;
}
var EVENT_PAYLOAD_TYPE = Object.freeze({ kind: "u32" });
function unpackEvent(opts, inst, ptr, e) {
  const [event, p1, p2] = e;
  const cx = new LiftLowerContext(cabiOptions(opts), inst, null);
  store(cx, p1, EVENT_PAYLOAD_TYPE, ptr);
  store(cx, p2, EVENT_PAYLOAD_TYPE, ptr + 4);
  return event;
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/intrinsics/fact_calls.js
var PREPARE_ASYNC_NO_RESULT = 4294967295;
var PREPARE_ASYNC_WITH_RESULT = 4294967294;
var START_FLAG_ASYNC_CALLEE = 1;
var PREPARE_FIXED = 8;
function taskOptionsFor(prepared, callback, memory2, calleeUsesAsyncAbi) {
  return {
    async_: calleeUsesAsyncAbi,
    callback: callback !== null,
    stringEncoding: stringEncodingName(prepared.stringEncoding),
    memory: memory2
  };
}
function stringEncodingName(v) {
  switch (v) {
    case 0:
      return "utf8";
    case 1:
      return "utf16";
    case 2:
      return "latin1+utf16";
    default:
      return "utf8";
  }
}
function createPrepareCall(decl, ctx) {
  return (...args) => {
    assert_(args.length >= PREPARE_FIXED, `prepare-call: expected at least ${PREPARE_FIXED} arguments`);
    const [start, return_, callerI, calleeI, taskReturnType, calleeAsync, enc, rc_] = args;
    assert_(typeof start === "function" && typeof return_ === "function", "prepare-call: start/return must be funcrefs");
    assert_(ctx.prepared.current === null, "prepare-call with a preparation already outstanding");
    const params = args.slice(PREPARE_FIXED);
    const rc = Number(rc_) >>> 0;
    const lastParam = () => {
      assert_(params.length > 0, "prepare-call: retptr missing");
      return params[params.length - 1];
    };
    let resultInfo;
    let asyncCallerWithResult = false;
    if (rc === PREPARE_ASYNC_WITH_RESULT) {
      resultInfo = { kind: "heap", retptr: lastParam() };
      asyncCallerWithResult = true;
    } else if (rc === PREPARE_ASYNC_NO_RESULT) {
      resultInfo = { kind: "stack" };
    } else if (rc > MAX_FLAT_RESULTS) {
      resultInfo = { kind: "heap", retptr: lastParam() };
    } else {
      resultInfo = { kind: "stack" };
    }
    ctx.prepared.current = {
      start,
      return_,
      callerInst: ctx.componentInstance(Number(callerI) >>> 0),
      calleeInst: ctx.componentInstance(Number(calleeI) >>> 0),
      taskReturnType: Number(taskReturnType) >>> 0,
      calleeAsync: Number(calleeAsync) !== 0,
      stringEncoding: Number(enc) >>> 0,
      resultCountOrMax: rc,
      params,
      memory: decl.memory === null ? null : ctx.memoryToken(decl.memory),
      resultInfo,
      asyncCallerWithResult
    };
  };
}
function mkCalleeTask(input) {
  const { prepared, callee, callback, postReturn, ctx, calleeUsesAsyncAbi } = input;
  const mode = input.mode ?? "plain";
  const canBlock = input.canBlock ?? false;
  const memory2 = prepared.memory;
  const inst = prepared.calleeInst;
  const declaredResults = ctx.resultTypesForTuple(prepared.taskReturnType);
  const ft = {
    params: [],
    results: declaredResults ?? [],
    async: prepared.calleeAsync
  };
  const task = new Task(ft, taskOptionsFor(prepared, callback, memory2, calleeUsesAsyncAbi), inst, () => {
    ctx.factStartScopes.push({ taskScope: task, lenders: input.lenderScope });
    let calleeArgs;
    try {
      calleeArgs = callCore(prepared.start, prepared.asyncCallerWithResult ? prepared.params.slice(0, -1) : prepared.params);
    } finally {
      ctx.factStartScopes.pop();
    }
    input.onStarted?.();
    return calleeArgs;
  }, (result) => {
    if (result === null) {
      input.onCallerResults(null);
      return;
    }
    const args = result;
    const withRetptr = prepared.resultInfo.kind === "heap" ? [...args, prepared.resultInfo.retptr] : args;
    input.onCallerResults(callCore(prepared.return_, withRetptr));
  });
  task.factPassthrough = true;
  task.factResultTypesKnown = declaredResults !== null;
  const body = function* (thread2) {
    if (!(yield* task.enterImplicitThread(thread2)))
      return;
    const calleeArgs = task.start();
    traceCopy(`mkCalleeTask callee canBlock=${canBlock} mode=${mode}`);
    const raw = yield* awaitCore(canBlock ? enterWasm(callee, mode) : callee, calleeArgs, thread2);
    if (!calleeUsesAsyncAbi) {
      task.return_(raw);
      if (postReturn !== null) {
        assert_(inst.mayLeave, "post-return with may_leave already false");
        inst.mayLeave = false;
        callCore(postReturn, raw);
        inst.mayLeave = true;
        ctx.stats.postReturnsRun++;
      }
      task.exitImplicitThread(thread2);
      return;
    }
    if (callback === null) {
      normalizeCoreValues(raw, [], "stackful callee result");
      task.exitImplicitThread(thread2);
      return;
    }
    const [packed] = normalizeCoreValues(raw, ["i32"], "callee result");
    yield* runCallbackLoop({
      name: "fact-callee",
      task,
      thread: thread2,
      inst,
      callback: canBlock ? enterWasm(callback, mode) : callback,
      packed,
      stats: ctx.stats
    });
    task.exitImplicitThread(thread2);
  };
  return { task, body };
}
function takePrepared(ctx, what) {
  const p = ctx.prepared.current;
  assert_(p !== null, `${what} without a preceding prepare-call`);
  ctx.prepared.current = null;
  return p;
}
function createSyncStartCall(decl, ctx) {
  return (callee, _liftParamCount) => {
    const prepared = takePrepared(ctx, "sync-start-call");
    assert_(typeof callee === "function", "sync-start-call: callee funcref");
    const callback = decl.callback === null ? null : ctx.callback(decl.callback);
    let callerResults = null;
    const lentHandles = [];
    const lenderScope = {
      addLender(h) {
        h.numLends += 1;
        lentHandles.push(h);
      },
      releaseLenders() {
        for (const h of lentHandles)
          h.numLends -= 1;
        lentHandles.length = 0;
      }
    };
    const { task, body } = mkCalleeTask({
      prepared,
      callee,
      callback,
      postReturn: null,
      ctx,
      calleeUsesAsyncAbi: true,
      mode: ctx.suspensionMode,
      canBlock: ctx.calleeCanBlock?.(callee) ?? false,
      onCallerResults: (r) => {
        assert_(r !== null, "sync-start-call: caller results missing");
        callerResults = r;
      },
      lenderScope
    });
    {
      const refusal = entryRefusal(prepared.calleeInst, prepared.callerInst, "cannot enter component instance");
      if (refusal !== null)
        trap(refusal);
    }
    try {
      const thread2 = spawn(task, body);
      thread2.resume();
    } catch (e) {
      if (!(e instanceof NeedsJspi) && !(e instanceof PendingCapability)) {
        notifyInstancePoisoned(prepared.calleeInst, e);
      }
      lenderScope.releaseLenders();
      throw e;
    }
    if (callerResults === null) {
      if (ctx.suspensionMode === "jspi") {
        return blockCurrentActivation({
          store: prepared.callerInst.store,
          task: currentTask(),
          readyFunc: () => callerResults !== null,
          cancellable: false,
          produce: () => {
            lenderScope.releaseLenders();
            return shapeResults(callerResults);
          },
          onSettled: () => lenderScope.releaseLenders()
        });
      }
      lenderScope.releaseLenders();
      needsJspi("sync-start-call whose async-lifted callee did not resolve in its " + "first activation (the caller's wasm frame must block)");
    }
    lenderScope.releaseLenders();
    return shapeResults(callerResults);
  };
}
function unwindSubtaskLenders(subtask2) {
  subtask2.unwindLenders();
}
function shapeResults(out) {
  if (out === null || out.length === 0)
    return;
  if (out.length === 1)
    return out[0];
  return out;
}
function createAsyncStartCall(decl, ctx) {
  return (callee, _paramCount, _resultCount, flags) => {
    const prepared = takePrepared(ctx, "async-start-call");
    assert_(typeof callee === "function", "async-start-call: callee funcref");
    const callback = decl.callback === null ? null : ctx.callback(decl.callback);
    const subtask2 = new Subtask;
    let onProgress = () => {};
    const { task, body } = mkCalleeTask({
      prepared,
      callee,
      callback,
      postReturn: decl.postReturn === null ? null : ctx.callback(decl.postReturn),
      ctx,
      calleeUsesAsyncAbi: ((flags ?? 0) & START_FLAG_ASYNC_CALLEE) !== 0,
      mode: ctx.suspensionMode,
      canBlock: ctx.calleeCanBlock?.(callee) ?? false,
      onStarted: () => {
        if (subtask2.state === SubtaskState.STARTING) {
          subtask2.state = SubtaskState.STARTED;
          onProgress();
        }
      },
      onCallerResults: (r) => {
        if (!subtask2.resolved()) {
          subtask2.resolve(r === null ? subtask2.state === SubtaskState.STARTING ? SubtaskState.CANCELLED_BEFORE_STARTED : SubtaskState.CANCELLED_BEFORE_RETURNED : SubtaskState.RETURNED, []);
        }
        onProgress();
      },
      lenderScope: subtask2
    });
    subtask2.onCancel = (callerInst) => task.requestCancellation(callerInst);
    subtask2.calleeTask = task;
    {
      const refusal = entryRefusal(prepared.calleeInst, prepared.callerInst, "cannot enter component instance");
      if (refusal !== null)
        trap(refusal);
    }
    let thread2;
    try {
      thread2 = spawn(task, body);
      thread2.resume();
    } catch (e) {
      if (!(e instanceof NeedsJspi) && !(e instanceof PendingCapability)) {
        notifyInstancePoisoned(prepared.calleeInst, e);
      }
      unwindSubtaskLenders(subtask2);
      throw e;
    }
    const report = () => {
      if (subtask2.resolved()) {
        subtask2.deliverResolve();
        traceCopy(`async-start-call -> RETURNED (eager)`);
        return SubtaskState.RETURNED;
      }
      const subtaski = prepared.callerInst.handles.add(subtask2);
      onProgress = () => subtask2.setSubtaskPendingEvent(subtaski);
      const packed = packSubtaskResult(subtask2.state, subtaski);
      traceCopy(`async-start-call -> state=${subtask2.state} i=${subtaski} ` + `packed=0x${packed.toString(16)}`);
      return packed;
    };
    if (ctx.suspensionMode === "jspi") {
      const store3 = prepared.callerInst.store;
      const calleeInst = prepared.calleeInst;
      const callerTask = maybeCurrentTask();
      const gatedAtEntry = () => subtask2.state === SubtaskState.STARTING && !subtask2.resolved() && !thread2.done() && thread2.waiting();
      const determinate = () => gatedAtEntry() ? !store3.hasRunnableWork(calleeInst, callerTask) : subtask2.resolved() || thread2.done() || store3.waiting.some((w) => w.task === task);
      if (!determinate()) {
        let produced = false;
        return blockCurrentActivation({
          store: prepared.callerInst.store,
          task: currentTask(),
          readyFunc: determinate,
          cancellable: false,
          produce: () => {
            const r = report();
            produced = true;
            return r;
          },
          onSettled: () => {
            if (!produced)
              unwindSubtaskLenders(subtask2);
          }
        });
      }
    }
    return report();
  };
}
function spawn(task, body) {
  let thread2;
  thread2 = new Thread(task, function* () {
    yield* body(thread2);
  }());
  return thread2;
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/intrinsics/transcode.js
var UTF16_TAG = 2147483648;

class TranscodeMemory {
  #provider;
  #label;
  constructor(provider, label) {
    this.#provider = provider;
    this.#label = label;
  }
  bytes() {
    const m = this.#provider();
    if (m === undefined) {
      throw new Error(`${this.#label} accessed before it was extracted`);
    }
    return new Uint8Array(m.buffer);
  }
}
var TRANSCODE_OPS = [
  "utf8-to-utf8",
  "utf16-to-utf16",
  "latin1-to-latin1",
  "latin1-to-utf16",
  "latin1-to-utf8",
  "utf16-to-compact-probably-utf16",
  "utf16-to-compact-utf16",
  "utf16-to-latin1",
  "utf16-to-utf8",
  "utf8-to-compact-utf16",
  "utf8-to-latin1",
  "utf8-to-utf16"
];
var utf8Fatal = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
function decodeUtf8OrTrap(bytes) {
  try {
    return utf8Fatal.decode(bytes);
  } catch {
    trap("invalid utf8 encoding");
  }
}
function* decodeUtf16OrTrap(bytes, ptr, units) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 0;
  while (i < units) {
    const u = view.getUint16(ptr + 2 * i, true);
    if (u < 55296 || u > 57343) {
      i += 1;
      yield [u, 1];
      continue;
    }
    if (u >= 56320 || i + 1 >= units)
      trap("invalid utf16 encoding");
    const lo = view.getUint16(ptr + 2 * (i + 1), true);
    if (lo < 56320 || lo > 57343)
      trap("invalid utf16 encoding");
    i += 2;
    yield [65536 + (u - 55296 << 10) + (lo - 56320), 2];
  }
}
function utf8Len(cp) {
  if (cp < 128)
    return 1;
  if (cp < 2048)
    return 2;
  if (cp < 65536)
    return 3;
  return 4;
}
function encodeUtf8At(dst, at, cp) {
  if (cp < 128) {
    dst[at] = cp;
    return 1;
  }
  if (cp < 2048) {
    dst[at] = 192 | cp >> 6;
    dst[at + 1] = 128 | cp & 63;
    return 2;
  }
  if (cp < 65536) {
    dst[at] = 224 | cp >> 12;
    dst[at + 1] = 128 | cp >> 6 & 63;
    dst[at + 2] = 128 | cp & 63;
    return 3;
  }
  dst[at] = 240 | cp >> 18;
  dst[at + 1] = 128 | cp >> 12 & 63;
  dst[at + 2] = 128 | cp >> 6 & 63;
  dst[at + 3] = 128 | cp & 63;
  return 4;
}
function encodeUtf16At(view, base, at, cp) {
  if (cp < 65536) {
    view.setUint16(base + 2 * at, cp, true);
    return 1;
  }
  const c = cp - 65536;
  view.setUint16(base + 2 * at, 55296 + (c >> 10), true);
  view.setUint16(base + 2 * (at + 1), 56320 + (c & 1023), true);
  return 2;
}
function utf8Latin1UpTo(bytes, ptr, len) {
  let i = 0;
  while (i < len) {
    const b = bytes[ptr + i];
    if (b < 128) {
      i += 1;
    } else if (b === 194 || b === 195) {
      const next = i + 1 < len ? bytes[ptr + i + 1] : -1;
      if (next < 128 || next > 191)
        break;
      i += 2;
    } else {
      break;
    }
  }
  return i;
}
function inflateLatin1Bytes(dst, dstPtr, latin1Bytes) {
  for (let i = latin1Bytes - 1;i >= 0; i--) {
    dst[dstPtr + 2 * i] = dst[dstPtr + i];
    dst[dstPtr + 2 * i + 1] = 0;
  }
}
function snapshot(bytes, ptr, len) {
  return bytes.slice(ptr, ptr + len);
}
function trapIfOverlap(src, srcPtr, srcLen, dst, dstPtr, dstLen) {
  if (src.buffer !== dst.buffer)
    return;
  const srcStart = src.byteOffset + srcPtr;
  const srcEnd = srcStart + srcLen;
  const dstStart = dst.byteOffset + dstPtr;
  const dstEnd = dstStart + dstLen;
  if (srcStart < dstEnd && dstStart < srcEnd) {
    trap("transcode src/dst regions overlap");
  }
}
function createTranscoder(op, from, to) {
  const fn = createTranscoderInner(op, from, to);
  return (...args) => fn(...args.map((a) => a >>> 0));
}
function createTranscoderInner(op, from, to) {
  switch (op) {
    case "latin1-to-latin1":
      return (srcPtr, srcLen, dstPtr) => {
        const src = from.bytes();
        const dst = to.bytes();
        dst.set(snapshot(src, srcPtr, srcLen), dstPtr);
      };
    case "utf8-to-utf8":
      return (srcPtr, srcLen, dstPtr) => {
        const src = from.bytes();
        const copy = snapshot(src, srcPtr, srcLen);
        decodeUtf8OrTrap(copy);
        to.bytes().set(copy, dstPtr);
      };
    case "utf16-to-utf16":
      return (srcPtr, srcLen, dstPtr) => {
        const src = from.bytes();
        const copy = snapshot(src, srcPtr, 2 * srcLen);
        for (const _ of decodeUtf16OrTrap(copy, 0, srcLen)) {}
        to.bytes().set(copy, dstPtr);
      };
    case "latin1-to-utf16":
      return (srcPtr, srcLen, dstPtr) => {
        const src = snapshot(from.bytes(), srcPtr, srcLen);
        const dst = to.bytes();
        for (let i = 0;i < srcLen; i++) {
          dst[dstPtr + 2 * i] = src[i];
          dst[dstPtr + 2 * i + 1] = 0;
        }
      };
    case "utf8-to-utf16":
      return (srcPtr, srcLen, dstPtr) => {
        const s = decodeUtf8OrTrap(snapshot(from.bytes(), srcPtr, srcLen));
        const dst = to.bytes();
        const view = new DataView(dst.buffer, dst.byteOffset, dst.byteLength);
        let units = 0;
        for (let i = 0;i < s.length && units < srcLen; i++) {
          view.setUint16(dstPtr + 2 * units, s.charCodeAt(i), true);
          units++;
        }
        return units;
      };
    case "utf16-to-compact-probably-utf16":
      return (srcPtr, srcLen, dstPtr) => {
        const src = snapshot(from.bytes(), srcPtr, 2 * srcLen);
        let allLatin1 = true;
        for (const [cp] of decodeUtf16OrTrap(src, 0, srcLen)) {
          if (cp > 255)
            allLatin1 = false;
        }
        const dst = to.bytes();
        dst.set(src, dstPtr);
        if (!allLatin1)
          return (srcLen | UTF16_TAG) >>> 0;
        for (let i = 0;i < srcLen; i++)
          dst[dstPtr + i] = dst[dstPtr + 2 * i];
        return srcLen;
      };
    case "utf8-to-latin1":
      return (srcPtr, srcLen, dstPtr) => {
        const src = snapshot(from.bytes(), srcPtr, srcLen);
        const read = utf8Latin1UpTo(src, 0, srcLen);
        const dst = to.bytes();
        let written = 0;
        let i = 0;
        while (i < read) {
          const b = src[i];
          if (b < 128) {
            dst[dstPtr + written] = b;
            i += 1;
          } else {
            dst[dstPtr + written] = (b & 31) << 6 | src[i + 1] & 63;
            i += 2;
          }
          written++;
        }
        return [read, written];
      };
    case "utf16-to-latin1":
      return (srcPtr, srcLen, dstPtr) => {
        const src = from.bytes();
        const dst = to.bytes();
        trapIfOverlap(src, srcPtr, 2 * srcLen, dst, dstPtr, srcLen);
        const view = new DataView(src.buffer, src.byteOffset, src.byteLength);
        const out = [];
        for (let i = 0;i < srcLen; i++) {
          const u = view.getUint16(srcPtr + 2 * i, true);
          if (u > 255)
            break;
          out.push(u);
        }
        for (let i = 0;i < out.length; i++)
          dst[dstPtr + i] = out[i];
        return [out.length, out.length];
      };
    case "utf16-to-utf8":
      return (srcPtr, srcLen, dstPtr, dstLen, firstPass) => {
        const src = snapshot(from.bytes(), srcPtr, 2 * srcLen);
        const dst = to.bytes();
        let srcRead = 0;
        let dstWritten = 0;
        let consumed = 0;
        for (const [cp, units] of decodeUtf16OrTrap(src, 0, srcLen)) {
          consumed += units;
          if (firstPass !== 0 && cp >= 128)
            break;
          const remaining = dstLen - dstWritten;
          if (remaining < 4 && remaining < utf8Len(cp))
            break;
          srcRead = consumed;
          dstWritten += encodeUtf8At(dst, dstPtr + dstWritten, cp);
        }
        return [srcRead, dstWritten];
      };
    case "latin1-to-utf8":
      return (srcPtr, srcLen, dstPtr, dstLen, firstPass) => {
        const src = snapshot(from.bytes(), srcPtr, srcLen);
        let stop = srcLen;
        if (firstPass !== 0) {
          for (let i = 0;i < srcLen; i++) {
            if (src[i] >= 128) {
              stop = i;
              break;
            }
          }
        }
        const dst = to.bytes();
        let read = 0;
        let written = 0;
        while (read < stop) {
          const b = src[read];
          const need = b < 128 ? 1 : 2;
          if (written + need > dstLen)
            break;
          written += encodeUtf8At(dst, dstPtr + written, b);
          read++;
        }
        return [read, written];
      };
    case "utf8-to-compact-utf16":
      return (srcPtr, srcLen, dstPtr, dstLen, latin1Bytes) => {
        const s = decodeUtf8OrTrap(snapshot(from.bytes(), srcPtr, srcLen));
        const dst = to.bytes();
        inflateLatin1Bytes(dst, dstPtr, latin1Bytes);
        const view = new DataView(dst.buffer, dst.byteOffset, dst.byteLength);
        const capacity = dstLen - latin1Bytes;
        if (s.length > capacity) {
          trap("utf8-to-compact-utf16: destination capacity exceeded");
        }
        let units = 0;
        for (let i = 0;i < s.length; i++) {
          view.setUint16(dstPtr + 2 * (latin1Bytes + units), s.charCodeAt(i), true);
          units++;
        }
        return units + latin1Bytes;
      };
    case "utf16-to-compact-utf16":
      return (srcPtr, srcLen, dstPtr, _dstLen, latin1Bytes) => {
        const src = snapshot(from.bytes(), srcPtr, 2 * srcLen);
        const dst = to.bytes();
        inflateLatin1Bytes(dst, dstPtr, latin1Bytes);
        const view = new DataView(dst.buffer, dst.byteOffset, dst.byteLength);
        let at = latin1Bytes;
        for (const [cp] of decodeUtf16OrTrap(src, 0, srcLen)) {
          at += encodeUtf16At(view, dstPtr, at, cp);
        }
        return srcLen + latin1Bytes;
      };
    default: {
      const exhaustive = op;
      throw new Error(`unknown transcode op ${exhaustive}`);
    }
  }
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/intrinsics/context.js
var NUM_CONTEXT_SLOTS = 2;
function canonContextGet(i, inst) {
  const thread2 = currentThreadForInstance(inst);
  assert_(i < NUM_CONTEXT_SLOTS, `context.get slot ${i} out of range`);
  const result = thread2.storage[i];
  assert_(result < 2 ** 32, "context.get value out of i32 range");
  if (CTX_TRACE)
    trace(`get[${i}] -> ${result}`, thread2);
  return result >>> 0;
}
var CTX_TRACE = (() => {
  try {
    return Deno.env.get("CE_CTX_TRACE") === "1";
  } catch {
    return false;
  }
})();
function ctxThreadId(t) {
  return dbgId(t);
}
function trace(msg, thread2) {
  const a = ambientDebug();
  console.error(`[ctx] ${ctxThreadId(thread2)} ${msg} storage=${JSON.stringify(thread2.storage)} | stack=[${a.stack.map(ctxThreadId).join(",")}] claims=[${a.claims.map(ctxThreadId).join(",")}]`);
}
function canonContextSet(i, v, inst) {
  const thread2 = currentThreadForInstance(inst);
  assert_(i < NUM_CONTEXT_SLOTS, `context.set slot ${i} out of range`);
  if (CTX_TRACE)
    trace(`set[${i}] = ${v >>> 0}`, thread2);
  thread2.storage[i] = v >>> 0;
}
function createUnsafeIntrinsic(symbol, inst) {
  const match = /^context-(get|set)-i32-(\d+)$/.exec(symbol);
  if (match === null) {
    throw new UnsupportedFeatureError("task-core", `component imports the unsafe intrinsic '${symbol}', which has no ` + `portable meaning in a JS host (only context.{get,set} do)`);
  }
  const slot2 = Number(match[2]);
  trapIf(slot2 >= NUM_CONTEXT_SLOTS, `unsafe intrinsic '${symbol}' addresses context slot ${slot2}, but a ` + `thread has ${NUM_CONTEXT_SLOTS}`);
  if (match[1] === "get")
    return () => canonContextGet(slot2, inst);
  return (v) => {
    canonContextSet(slot2, (v ?? 0) >>> 0, inst);
  };
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/intrinsics/mod.js
var FACT_TRAP_MESSAGES = {
  9: "wasm `unreachable` instruction executed",
  17: "cannot enter component instance",
  23: "cannot leave component instance",
  24: "cannot block a synchronous task before returning",
  25: "invalid `char` bit pattern",
  30: "string content out-of-bounds",
  31: "list content out-of-bounds",
  32: "invalid variant discriminant",
  33: "unaligned pointer",
  46: "reference count overflow",
  49: "uncaught exception propagated out of component"
};
var TRAP_UNCAUGHT_EXCEPTION = 49;
var TRAMPOLINE_CAPABILITY = {
  "lower-import": "core",
  trap: "core",
  "enter-sync-call": "core",
  "exit-sync-call": "core",
  "resource-new": "resources",
  "resource-rep": "resources",
  "resource-drop": "resources",
  transcoder: "resources",
  "resource-transfer-own": "resources",
  "resource-transfer-borrow": "resources"
};
function capabilityOf(kind) {
  return TRAMPOLINE_CAPABILITY[kind] ?? "task-core";
}

class SyncCallScope {
  numBorrows = 0;
  lenders = [];
  addLender(h) {
    h.numLends += 1;
    this.lenders.push(h);
  }
  releaseLenders() {
    for (const h of this.lenders)
      h.numLends -= 1;
    this.lenders.length = 0;
  }
}
function createTrampoline(decl, ctx) {
  const fn = createTrampolineBody(decl, ctx);
  return (...args) => {
    try {
      return fn(...args);
    } catch (e) {
      ctx.trapState.pending = e;
      throw e;
    }
  };
}
function sctx(ctx) {
  return ctx;
}
function declaredInstance(decl, ctx) {
  const instance = decl.instance;
  assert_(typeof instance === "number", `trampoline '${decl.kind}' has no declared component instance`);
  return ctx.componentInstance(instance);
}
var SCOPE_TRACE = (() => {
  try {
    return Deno.env.get("CE_SCOPE_TRACE") === "1";
  } catch {
    return false;
  }
})();
function syncScopes(ctx, site = "?") {
  const thread2 = maybeCurrentThread();
  const scopes = thread2?.syncCallStack ?? ctx.syncCallStack;
  if (SCOPE_TRACE) {
    console.error(`[scope] ${site} act=${thread2 ? dbgId(thread2) : "NONE(->ctx fallback)"} ` + `depth=${scopes.length}`);
  }
  return scopes;
}
function createTrampolineBody(decl, ctx) {
  switch (decl.kind) {
    case "lower-import": {
      const d = decl;
      return ctx.loweredImport(d);
    }
    case "trap": {
      const code = decl.code;
      return () => {
        if (code === TRAP_UNCAUGHT_EXCEPTION) {
          const pending = ctx.trapState.pending;
          if (pending !== undefined) {
            throw pending;
          }
        }
        const message = FACT_TRAP_MESSAGES[code];
        trap(message === undefined ? `FACT adapter trap (code ${code})` : `wasm trap: ${message}`);
      };
    }
    case "enter-sync-call":
      return (callerInstance, async_, calleeInstance) => {
        if (typeof callerInstance === "number" && typeof calleeInstance === "number") {
          const callerInst = ctx.componentInstance(callerInstance >>> 0);
          const calleeInst = ctx.componentInstance(calleeInstance >>> 0);
          const refusal = entryRefusal(calleeInst, callerInst, "cannot enter component instance");
          if (refusal !== null)
            trap(refusal);
        }
        ctx.stats.enterSyncCalls++;
        const scopes = syncScopes(ctx, "enter");
        scopes.push(new SyncCallScope);
      };
    case "exit-sync-call":
      return (..._args) => {
        ctx.stats.exitSyncCalls++;
        assert_(ctx.stats.exitSyncCalls <= ctx.stats.enterSyncCalls, "exit-sync-call without matching enter-sync-call");
        const scope = syncScopes(ctx, "exit").pop();
        assert_(scope !== undefined, "exit-sync-call with an empty sync-call stack");
        trapIf(scope.numBorrows > 0, "borrow handles still remain at the end of the call");
        scope.releaseLenders();
      };
    case "resource-new": {
      const d = decl;
      const inst = ctx.componentInstance(d.instance);
      const rt = ctx.resourceToken(d.resource);
      return (rep) => canonResourceNew(inst, rt, rep >>> 0);
    }
    case "resource-rep": {
      const d = decl;
      const inst = ctx.componentInstance(d.instance);
      const rt = ctx.resourceToken(d.resource);
      return (handle) => canonResourceRep(inst, rt, handle >>> 0);
    }
    case "resource-drop": {
      const d = decl;
      const inst = ctx.componentInstance(d.instance);
      const rt = ctx.resourceToken(d.resource);
      return (handle) => {
        canonResourceDrop(inst, rt, handle >>> 0);
      };
    }
    case "transcoder": {
      const d = decl;
      if (d.from64 || d.to64) {
        throw new UnsupportedFeatureError("task-core", `transcoder '${d.op}' over a 64-bit linear memory`);
      }
      if (!TRANSCODE_OPS.includes(d.op)) {
        throw new UnsupportedFeatureError("task-core", `unknown string transcode operation '${d.op}'`);
      }
      return createTranscoder(d.op, ctx.runtimeMemory(d.from), ctx.runtimeMemory(d.to));
    }
    case "task-return":
      return createTaskReturn(decl, ctx);
    case "task-cancel":
      return createTaskCancel();
    case "backpressure-inc":
      return createBackpressureInc(declaredInstance(decl, ctx));
    case "backpressure-dec":
      return createBackpressureDec(declaredInstance(decl, ctx));
    case "waitable-set-new":
      return createWaitableSetNew(declaredInstance(decl, ctx));
    case "waitable-set-wait":
      return createWaitableSetWait(decl, ctx, declaredInstance(decl, ctx), ctx.suspensionMode);
    case "waitable-set-poll":
      return createWaitableSetPoll(decl, ctx, declaredInstance(decl, ctx));
    case "waitable-set-drop":
      return createWaitableSetDrop(declaredInstance(decl, ctx));
    case "waitable-join":
      return createWaitableJoin(declaredInstance(decl, ctx));
    case "subtask-drop":
      return createSubtaskDrop(declaredInstance(decl, ctx));
    case "subtask-cancel":
      return createSubtaskCancel(decl, declaredInstance(decl, ctx), ctx.suspensionMode);
    case "thread-yield":
      return createThreadYield(decl, ctx.suspensionMode);
    case "prepare-call":
      return createPrepareCall(decl, ctx);
    case "sync-start-call":
      return createSyncStartCall(decl, ctx);
    case "async-start-call":
      return createAsyncStartCall(decl, ctx);
    case "stream-new":
      return createStreamNew(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "future-new":
      return createFutureNew(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "stream-read":
      return createStreamRead(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "stream-write":
      return createStreamWrite(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "future-read":
      return createFutureRead(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "future-write":
      return createFutureWrite(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "stream-cancel-read":
      return createStreamCancelRead(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "stream-cancel-write":
      return createStreamCancelWrite(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "future-cancel-read":
      return createFutureCancelRead(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "future-cancel-write":
      return createFutureCancelWrite(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "stream-drop-readable":
      return createStreamDropReadable(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "stream-drop-writable":
      return createStreamDropWritable(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "future-drop-readable":
      return createFutureDropReadable(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "future-drop-writable":
      return createFutureDropWritable(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "error-context-new":
      return createErrorContextNew(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "error-context-debug-message":
      return createErrorContextDebugMessage(decl, sctx(ctx), declaredInstance(decl, ctx));
    case "error-context-drop":
      return createErrorContextDrop(declaredInstance(decl, ctx));
    case "stream-transfer":
      return createStreamTransfer(ctx);
    case "future-transfer":
      return createFutureTransfer(ctx);
    case "error-context-transfer":
      return createErrorContextTransfer(ctx, (t) => ctx.errorContextTableInstance(t));
    case "resource-transfer-own":
      return (handle, srcTable, dstTable) => transferOwn(ctx, handle >>> 0, srcTable, dstTable);
    case "resource-transfer-borrow":
      return (handle, srcTable, dstTable) => transferBorrow(ctx, handle >>> 0, srcTable, dstTable);
    default:
      throw new UnsupportedFeatureError(capabilityOf(decl.kind) === "resources" ? "resources" : "task-core", `component requires host trampoline '${decl.kind}'`);
  }
}
function transferOwn(ctx, handle, srcTable, dstTable) {
  const src = ctx.resourceTableInstance(srcTable);
  const dst = ctx.resourceTableInstance(dstTable);
  const srcRt = ctx.resourceToken(srcTable);
  const dstRt = ctx.resourceToken(dstTable);
  const h = src.handles.remove(handle);
  trapIf(!(h instanceof ResourceHandle), "transfer-own: not a resource handle");
  const rh = h;
  trapIf(rh.rt !== srcRt, "transfer-own: resource type mismatch");
  trapIf(rh.numLends !== 0, "cannot remove owned resource while borrowed (handle still lent out)");
  trapIf(!rh.own, "transfer-own: expected an owning handle");
  return dst.handles.add(new ResourceHandle(dstRt, rh.rep, true));
}
function transferBorrow(ctx, handle, srcTable, dstTable) {
  const src = ctx.resourceTableInstance(srcTable);
  const dst = ctx.resourceTableInstance(dstTable);
  const srcRt = ctx.resourceToken(srcTable);
  const dstRt = ctx.resourceToken(dstTable);
  const fact = ctx.factStartScopes[ctx.factStartScopes.length - 1];
  const stack = syncScopes(ctx);
  const scope = stack[stack.length - 1];
  assert_(fact !== undefined || scope !== undefined, "transfer-borrow outside an enter-sync-call/exit-sync-call bracket " + "or FACT start window");
  const h = src.handles.get(handle);
  trapIf(!(h instanceof ResourceHandle), "transfer-borrow: not a resource handle");
  const rh = h;
  trapIf(rh.rt !== srcRt, "transfer-borrow: resource type mismatch");
  (fact?.lenders ?? scope).addLender(rh);
  if (dstRt.impl !== null && dstRt.impl === dst)
    return rh.rep;
  const borrowScope = fact !== undefined ? fact.taskScope : scope;
  borrowScope.numBorrows += 1;
  return dst.handles.add(new ResourceHandle(dstRt, rh.rep, false, borrowScope));
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/exec/executor.js
var SUSPENDABLE_TRACE = (() => {
  try {
    return Deno.env.get("CE_COPY_TRACE") === "1";
  } catch {
    return false;
  }
})();

class HostResourceType {
  options;
  constructor(options = {}) {
    this.options = options;
  }
}
function hostResourceType(options) {
  return new HostResourceType(options ?? {});
}
var moduleCache = new WeakMap;
async function instantiateComponent(input) {
  const loaded = input.loadedPlan ?? loadPlan(input.plan);
  if (loaded.wire !== input.plan) {
    throw new PlanError("instantiateComponent: `loadedPlan` was converted from a different " + "plan document than `plan`");
  }
  const executor = new Executor(loaded, input);
  await executor.verifyComponent();
  await executor.compileModules();
  executor.bindImportedResources();
  await executor.runInitializers();
  return executor.finish();
}

class Executor {
  wire;
  loaded;
  componentBytes;
  adapterBytes;
  hostImports;
  verifyHash;
  trapOnIdle;
  suspensionMode;
  stats = newStats();
  modules = [];
  instances = [];
  componentInstances = new Map;
  store = new Store;
  unsafeIntrinsics = new Map;
  #declaringInstance = null;
  preparedCall = { current: null };
  liveMemories = new Map;
  wrappedEntries = false;
  wrappedImports = false;
  noteEntry() {
    if (this.suspensionMode === "jspi")
      this.wrappedEntries = true;
    return this.suspensionMode;
  }
  noteImport() {
    if (this.suspensionMode === "jspi")
      this.wrappedImports = true;
    return this.suspensionMode;
  }
  memories = [];
  reallocs = [];
  postReturns = [];
  callbacks = [];
  tables = [];
  lowerings = new Map;
  trampolineCache = new Map;
  hostResourceTypes = new Map;
  syncCallStack = [];
  factStartScopes = [];
  suspendableFuncs = new WeakSet;
  blockingFuncs = new WeakSet;
  wrapFuncs = new WeakSet;
  sawBlockingImport = false;
  sawWrapImport = false;
  suspendableLowerings = new Set;
  trapState = { pending: undefined };
  omittedExports = new Map;
  constructor(loaded, input) {
    this.loaded = loaded;
    this.wire = loaded.wire;
    this.componentBytes = input.componentBytes;
    this.adapterBytes = input.adapters ?? new Map;
    this.hostImports = input.imports ?? {};
    this.verifyHash = input.verifyHash ?? true;
    this.trapOnIdle = input.trapOnIdle ?? false;
    this.suspensionMode = chooseMode(input.jspi, planNeedsSuspension(loaded.wire) || anySuspendingImport(this.hostImports));
  }
  async verifyComponent() {
    const { sha256, len } = this.wire.component;
    if (this.componentBytes.length !== len) {
      throw new PlanError(`component byte length ${this.componentBytes.length} != plan's ${len}`);
    }
    if (!this.verifyHash)
      return;
    const digest = await crypto.subtle.digest("SHA-256", this.componentBytes.slice().buffer);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hex !== sha256) {
      throw new PlanError(`component sha256 mismatch: plan has ${sha256}, bytes are ${hex}`);
    }
  }
  async compileModules() {
    const cached = moduleCache.get(this.wire);
    if (cached !== undefined && cached.componentBytes === this.componentBytes && this.wire.modules.every((m, i) => m.kind === "embedded" || cached.adapterRefs[i] === this.adapterBytes.get(m.file))) {
      this.modules.push(...await cached.modules);
      return;
    }
    const compiled = Promise.all(this.wire.modules.map((m, i) => {
      if (m.kind === "embedded") {
        if (!Number.isInteger(m.offset) || m.offset < 0 || !Number.isInteger(m.len) || m.len < 0) {
          throw new PlanError(`module ${i}: offset/len must be non-negative integers, got ` + `offset=${m.offset}, len=${m.len}`);
        }
        const end = m.offset + m.len;
        if (end > this.componentBytes.length) {
          throw new PlanError(`module ${i}: byte range ${m.offset}..${end} exceeds component ` + `size ${this.componentBytes.length}`);
        }
        return WebAssembly.compile(this.componentBytes.slice(m.offset, end).buffer);
      }
      const bytes = this.adapterBytes.get(m.file);
      if (!bytes) {
        throw new PlanError(`adapter artifact ${m.file} not provided`);
      }
      if (bytes.length !== m.len) {
        throw new PlanError(`adapter ${m.file}: expected ${m.len} bytes, got ${bytes.length}`);
      }
      return WebAssembly.compile(bytes.slice().buffer);
    }));
    const entry = {
      componentBytes: this.componentBytes,
      adapterRefs: this.wire.modules.map((m) => m.kind === "embedded" ? undefined : this.adapterBytes.get(m.file)),
      modules: compiled
    };
    moduleCache.set(this.wire, entry);
    compiled.catch(() => {
      if (moduleCache.get(this.wire) === entry)
        moduleCache.delete(this.wire);
    });
    this.modules.push(...await compiled);
  }
  bindImportedResources() {
    const imported = this.wire.importedResources ?? [];
    imported.forEach((ir, resourceIndex) => {
      const imp = this.wire.imports[ir.import];
      const label = importLabel(imp.name, imp.path);
      const value = this.lookupHostImport(imp.name, imp.path, label);
      if (!(value instanceof HostResourceType)) {
        throw new PlanError(`host import '${label}' must be a HostResourceType (the component ` + `imports a resource type); got ${describe(value)}`);
      }
      const dtor = value.options.dtor;
      this.wire.resourceTables.forEach((table, tableIndex) => {
        if (table.kind !== "concrete" || table.resource !== resourceIndex) {
          return;
        }
        const token = this.loaded.resourceTokens[tableIndex];
        token.impl = null;
        token.dtor = dtor === undefined ? null : (rep) => dtor(rep);
      });
      this.hostResourceTypes.set(resourceIndex, value);
    });
  }
  async runInitializers() {
    for (const init of this.wire.initializers) {
      switch (init.op) {
        case "instantiate-module": {
          const module = this.modules[init.module];
          if (module === undefined) {
            throw new PlanError(`instantiate-module: no module ${init.module}`);
          }
          const declared = WebAssembly.Module.imports(module);
          if (declared.length !== init.args.length) {
            throw new PlanError(`module ${init.module}: ${declared.length} imports but ` + `${init.args.length} args in plan`);
          }
          const importObject = {};
          this.sawBlockingImport = false;
          this.sawWrapImport = false;
          this.#declaringInstance = init.instance === null ? null : this.componentInstance(init.instance);
          const seenAt = new Map;
          declared.forEach((imp, i) => {
            const before = this.sawBlockingImport;
            const value = this.importValue(init.args[i]);
            if (!before && this.sawBlockingImport && SUSPENDABLE_TRACE) {
              console.error(`[suspendable] module ${init.module}: import ` + `${imp.module}.${imp.name} (${JSON.stringify(init.args[i])})`);
            }
            const key = `${imp.module}\x00${imp.name}`;
            const prior = seenAt.get(key);
            if (prior !== undefined && prior.value !== value) {
              throw new PlanError(`module ${init.module}: duplicate import ` + `${JSON.stringify(imp.module)}.${JSON.stringify(imp.name)} ` + `at arg indices ${prior.index} and ${i} resolve to ` + `different values (plan args[${prior.index}]=` + `${JSON.stringify(init.args[prior.index])}, args[${i}]=` + `${JSON.stringify(init.args[i])})`);
            }
            seenAt.set(key, { index: i, value });
            (importObject[imp.module] ??= {})[imp.name] = value;
          });
          this.#declaringInstance = null;
          let instance;
          try {
            instance = await WebAssembly.instantiate(module, importObject);
          } catch (e) {
            if (e?.constructor?.name === "SuspendError") {
              throw new Trap("cannot block a synchronous task before returning");
            }
            throw e;
          }
          if (this.sawBlockingImport || this.sawWrapImport) {
            const promising = this.sawBlockingImport || init.instance !== null;
            for (const exported of Object.values(instance.exports)) {
              if (typeof exported !== "function")
                continue;
              const fn = exported;
              (this.sawBlockingImport ? this.blockingFuncs : this.wrapFuncs).add(fn);
              if (promising)
                this.suspendableFuncs.add(fn);
            }
          }
          this.instances.push(instance);
          break;
        }
        case "lower-import": {
          this.lowerings.set(init.index, init.import);
          break;
        }
        case "extract-memory": {
          const value = this.resolveCoreExport(init.export);
          if (!(value instanceof WebAssembly.Memory)) {
            throw new PlanError(`extract-memory ${init.index}: resolved to non-memory`);
          }
          this.memories[init.index] = value;
          break;
        }
        case "extract-realloc": {
          this.reallocs[init.index] = this.resolveFunction(init.def, `extract-realloc ${init.index}`);
          break;
        }
        case "extract-callback": {
          this.callbacks[init.index] = this.resolveFunction(init.def, `extract-callback ${init.index}`);
          break;
        }
        case "extract-post-return": {
          this.postReturns[init.index] = this.resolveFunction(init.def, `extract-post-return ${init.index}`);
          break;
        }
        case "extract-table": {
          const value = this.resolveCoreExport(init.export);
          if (!(value instanceof WebAssembly.Table)) {
            throw new PlanError(`extract-table ${init.index}: resolved to non-table`);
          }
          this.tables[init.index] = value;
          break;
        }
        case "resource": {
          const dtor = init.dtor === null ? null : this.resolveFunction(init.dtor, `resource ${init.index} dtor`);
          const inst = this.componentInstance(init.instance);
          const resourceIndex = resourceIndexOfDefined(this.loaded, init.index);
          this.wire.resourceTables.forEach((table, tableIndex) => {
            if (table.kind === "concrete" && table.resource === resourceIndex) {
              const token = this.loaded.resourceTokens[tableIndex];
              token.impl = inst;
              token.dtor = dtor === null ? null : (rep) => {
                dtor(rep);
              };
              const suspendable = dtor !== null && this.suspensionMode === "jspi" && this.suspendableFuncs.has(dtor);
              const mkEntry = (mode) => createDtorEntry({
                name: `[dtor] resource ${init.index}`,
                dtor,
                instance: inst,
                suspensionMode: mode,
                stats: this.stats,
                trapState: this.trapState,
                syncCallStack: this.syncCallStack,
                allInstances: () => this.componentInstances.values()
              });
              try {
                token.dtorHost = mkEntry(suspendable ? "jspi" : "plain");
              } catch {
                token.dtorHost = mkEntry("plain");
              }
            }
          });
          break;
        }
        default: {
          const exhaustive = init;
          throw new PlanError(`unsupported initializer op ${exhaustive.op}`);
        }
      }
    }
  }
  finish() {
    const exports = {};
    for (const exp of this.wire.exports) {
      const built = this.buildExport(exp, exp.name);
      if (built.kind === "value")
        exports[exp.name] = built.value;
    }
    assertModeConsistent(this.suspensionMode, this.wrappedEntries, this.wrappedImports);
    const componentInstances = [];
    for (const [i, state] of this.componentInstances) {
      componentInstances[i] = state;
    }
    return {
      exports,
      stats: this.stats,
      componentInstances,
      coreInstances: this.instances,
      suspendableFuncs: this.suspendableFuncs,
      hostResourceTypes: this.hostResourceTypes,
      omittedExports: this.omittedExports,
      loadedPlan: this.loaded
    };
  }
  buildExport(exp, path) {
    switch (exp.kind) {
      case "lifted-func": {
        const ft = this.funcType(exp.type, `export '${path}'`);
        const core = this.resolveFunction(exp.coreDef, `export '${path}'`);
        const opts = this.resolveOptions(exp.options);
        const value = createLiftedFunction({
          name: path,
          ft,
          opts,
          core,
          stats: this.stats,
          suspensionMode: this.noteEntry(),
          trapState: this.trapState,
          syncCallStack: this.syncCallStack,
          allInstances: () => this.componentInstances.values(),
          trapOnIdle: this.trapOnIdle
        });
        if (this.suspensionMode === "jspi" && !ft.async) {
          value[SYNC_ENTRY] = createLiftedFunction({
            name: `${path} (sync entry)`,
            ft,
            opts,
            core,
            stats: this.stats,
            suspensionMode: "plain",
            trapState: this.trapState,
            syncCallStack: this.syncCallStack,
            allInstances: () => this.componentInstances.values(),
            refuseOnEntryHops: true
          });
        }
        return { kind: "value", value };
      }
      case "instance": {
        const nested = {};
        for (const sub of exp.exports) {
          const built = this.buildExport(sub, `${path}/${sub.name}`);
          if (built.kind === "value")
            nested[sub.name] = built.value;
        }
        return { kind: "value", value: nested };
      }
      case "type":
        this.omittedExports.set(path, "type export: no runtime surface (plan-format.md)");
        return {
          kind: "omitted",
          reason: "type export: no runtime surface"
        };
      case "module": {
        const module = this.modules[exp.module];
        if (module === undefined) {
          throw new PlanError(`export '${path}': no module ${exp.module} in the static ` + `module space (${this.modules.length} modules)`);
        }
        return { kind: "value", value: module };
      }
      default: {
        const exhaustive = exp;
        throw new PlanError(`unsupported export kind ${exhaustive.kind}`);
      }
    }
  }
  componentInstance(index) {
    let state = this.componentInstances.get(index);
    if (state === undefined) {
      state = new ComponentInstanceState(index, this.store);
      this.componentInstances.set(index, state);
    }
    return state;
  }
  liveMemory(index) {
    let m = this.liveMemories.get(index);
    if (m === undefined) {
      m = new LiveMemory(() => this.memories[index], `memory ${index}`);
      this.liveMemories.set(index, m);
    }
    return m;
  }
  unsafeIntrinsic(symbol) {
    const inst = this.#declaringInstance;
    const key = `${inst === null ? "-" : inst.index}\x00${symbol}`;
    let fn = this.unsafeIntrinsics.get(key);
    if (fn === undefined) {
      fn = createUnsafeIntrinsic(symbol, inst);
      this.unsafeIntrinsics.set(key, fn);
    }
    return fn;
  }
  importValue(def) {
    const value = this.resolveCoreDef(def);
    if (typeof value === "function" && this.wrapFuncs.has(value)) {
      this.sawWrapImport = true;
    }
    if (typeof value === "function" && this.blockingFuncs.has(value)) {
      this.sawBlockingImport = true;
    }
    if (this.suspensionMode !== "jspi" || def.kind !== "trampoline" || typeof value !== "function") {
      return value;
    }
    const decl = this.wire.trampolines[def.index];
    if (decl === undefined)
      return value;
    const optionsAsync = (i) => this.wire.canonicalOptions[i]?.async === true;
    const d = decl;
    if (d.kind === "lower-import") {
      const lowered = d.lowered;
      if (!this.suspendableLowerings.has(lowered))
        return value;
      this.sawBlockingImport = true;
      this.noteImport();
      return suspendingImport(value, "jspi");
    }
    if (!trampolineCanBlock(d, optionsAsync))
      return value;
    if (trampolineNeedsSuspension(d, optionsAsync)) {
      this.sawBlockingImport = true;
    } else {
      this.sawWrapImport = true;
    }
    this.noteImport();
    return suspendingImport(value, "jspi");
  }
  resolveCoreDef(def) {
    switch (def.kind) {
      case "export": {
        return this.resolveCoreExport({
          instance: def.instance,
          item: def.item
        });
      }
      case "instance-flags":
        return this.componentInstance(def.instance).flags;
      case "trampoline":
        return this.trampoline(def.index);
      case "unsafe-intrinsic":
        return this.unsafeIntrinsic(def.intrinsic);
      default: {
        const exhaustive = def;
        throw new PlanError(`unsupported CoreDef kind ${exhaustive.kind}`);
      }
    }
  }
  resolveCoreExport(ref) {
    const instance = this.instances[ref.instance];
    if (instance === undefined) {
      throw new PlanError(`core export ref: runtime instance ${ref.instance} not created yet`);
    }
    const value = instance.exports[ref.item.name];
    if (value === undefined) {
      throw new PlanError(`core instance ${ref.instance} has no export '${ref.item.name}'`);
    }
    return value;
  }
  resolveFunction(def, what) {
    const value = this.resolveCoreDef(def);
    if (typeof value !== "function") {
      throw new PlanError(`${what}: resolved to non-function`);
    }
    return value;
  }
  trampoline(index) {
    const cached = this.trampolineCache.get(index);
    if (cached !== undefined)
      return cached;
    const decl = this.wire.trampolines[index];
    if (decl === undefined) {
      throw new PlanError(`no trampoline ${index} in plan`);
    }
    const fn = createTrampoline(decl, {
      componentInstance: (i) => this.componentInstance(i),
      resourceToken: (i) => {
        const token = this.loaded.resourceTokens[i];
        if (token === undefined) {
          throw new PlanError(`no resource table ${i} in plan`);
        }
        return token;
      },
      runtimeMemory: (i) => new TranscodeMemory(() => this.memories[i], `runtime memory ${i}`),
      resourceTableInstance: (i) => {
        const table = this.wire.resourceTables[i];
        if (table === undefined) {
          throw new PlanError(`no resource table ${i} in plan`);
        }
        if (table.kind !== "concrete") {
          throw new PlanError(`resource table ${i} is abstract (type-only) and has no runtime ` + `handle table`);
        }
        return this.componentInstance(table.instance);
      },
      options: (i) => this.resolveOptions(i),
      resultTypes: (i) => this.resultTypes(i),
      callback: (i) => {
        const fn2 = this.callbacks[i];
        if (fn2 === undefined) {
          throw new PlanError(`callback ${i} accessed before its extract-callback initializer ran`);
        }
        return fn2;
      },
      memoryToken: (i) => this.liveMemory(i),
      streamElem: (i) => {
        if (i >= this.loaded.streamElems.length) {
          throw new PlanError(`stream table ${i} is not in the plan's streamTables (plan v2)`);
        }
        return this.loaded.streamElems[i];
      },
      streamTableInstance: (i) => {
        const instance = this.loaded.streamTableInstances[i];
        if (instance === undefined) {
          throw new PlanError(`stream table ${i} is not in the plan's streamTables (plan v2)`);
        }
        return this.componentInstance(instance);
      },
      futureTableInstance: (i) => {
        const instance = this.loaded.futureTableInstances[i];
        if (instance === undefined) {
          throw new PlanError(`future table ${i} is not in the plan's futureTables (plan v2)`);
        }
        return this.componentInstance(instance);
      },
      errorContextTableInstance: (i) => {
        const instance = this.loaded.errorContextTableInstances[i];
        if (instance === undefined) {
          throw new PlanError(`error-context table ${i} is not in the plan's ` + `errorContextTables (plan v3)`);
        }
        return this.componentInstance(instance);
      },
      resultTypesForTuple: (i) => {
        const t = this.loaded.resultTupleTypes.get(i);
        return t === undefined ? null : this.resultTypes(t);
      },
      futureElem: (i) => {
        if (i >= this.loaded.futureElems.length) {
          throw new PlanError(`future table ${i} is not in the plan's futureTables (plan v2)`);
        }
        return this.loaded.futureElems[i];
      },
      prepared: this.preparedCall,
      suspensionMode: this.suspensionMode,
      calleeCanBlock: (fn2) => this.suspendableFuncs.has(fn2),
      syncCallStack: this.syncCallStack,
      factStartScopes: this.factStartScopes,
      trapState: this.trapState,
      loweredImport: (d) => this.buildLoweredImport(d),
      stats: this.stats
    });
    this.trampolineCache.set(index, fn);
    return fn;
  }
  buildLoweredImport(decl) {
    const importIndex = this.lowerings.get(decl.lowered);
    if (importIndex === undefined) {
      throw new PlanError(`lower-import trampoline: lowering ${decl.lowered} was never ` + `initialized (initializer order violation)`);
    }
    const imp = this.wire.imports[importIndex];
    if (imp === undefined) {
      throw new PlanError(`no import ${importIndex} in plan`);
    }
    const label = importLabel(imp.name, imp.path);
    const value = this.lookupHostImport(imp.name, imp.path, label);
    if (typeof value !== "function") {
      throw new PlanError(`host import '${label}' missing or not a function (got ` + `${describe(value)})`);
    }
    const ft = this.funcType(decl.type, `import '${label}'`);
    const opts = this.resolveOptions(decl.options);
    const suspendable = isSuspending(value);
    const deferCancel2 = isDeferCancel(value);
    const abortable_ = isAbortable(value);
    if (suspendable)
      this.suspendableLowerings.add(decl.lowered);
    return createLoweredImport({
      name: label,
      ft,
      opts,
      hostFn: value,
      stats: this.stats,
      mode: this.suspensionMode,
      suspendable,
      deferCancel: deferCancel2,
      abortable: abortable_
    });
  }
  lookupHostImport(name, path, label) {
    if (!(name in this.hostImports)) {
      throw new PlanError(`host import '${label}' not provided (no key '${name}' in imports)`);
    }
    let value = this.hostImports[name];
    const walked = [];
    for (const segment of path) {
      if (value === null || typeof value !== "object") {
        throw new PlanError(`host import '${label}': '${[name, ...walked].join("/")}' is ${describe(value)}, expected an object to read ` + `'${segment}' from`);
      }
      value = value[segment];
      walked.push(segment);
    }
    return value;
  }
  resultTypes(index) {
    const entry = this.loaded.types[index];
    if (entry === undefined) {
      throw new PlanError(`task-return results: no type ${index}`);
    }
    if (entry.kind !== "value" || entry.type.kind !== "tuple") {
      throw new PlanError(`task-return results: type ${index} is not a tuple type`);
    }
    return entry.type.elements;
  }
  funcType(index, what) {
    const entry = this.loaded.types[index];
    if (entry === undefined)
      throw new PlanError(`${what}: no type ${index}`);
    if (entry.kind !== "func") {
      throw new PlanError(`${what}: type ${index} is not a function type`);
    }
    return entry.funcType;
  }
  resolveOptions(index) {
    const wire = this.wire.canonicalOptions[index];
    if (wire === undefined) {
      throw new PlanError(`no canonicalOptions ${index} in plan`);
    }
    const memoryIndex = wire.memory;
    return {
      stringEncoding: wire.stringEncoding,
      memory: memoryIndex === null ? null : this.liveMemory(memoryIndex),
      realloc: wire.realloc === null ? null : () => this.reallocs[wire.realloc],
      postReturn: wire.postReturn === null ? null : () => this.postReturns[wire.postReturn],
      callback: wire.callback === null ? null : () => this.callbacks[wire.callback],
      async: wire.async,
      cancellable: wire.cancellable,
      coreType: wire.coreType,
      instance: this.componentInstance(wire.instance)
    };
  }
}
function importLabel(name, path) {
  return path.length === 0 ? name : `${name}/${path.join("/")}`;
}
function describe(v) {
  if (v === null)
    return "null";
  if (v === undefined)
    return "undefined";
  if (typeof v === "object")
    return `a ${v.constructor?.name ?? "object"}`;
  return `a ${typeof v}`;
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/exec/host_streams.js
function hostEndInstance(role) {
  return Object.freeze({ hostEnd: role });
}

class HostBuffer {
  t;
  values;
  length;
  progress = 0;
  #chunks = [];
  constructor(t, values2, length) {
    this.t = t;
    this.values = values2;
    this.length = length;
    if (!Number.isInteger(length) || length < 0) {
      throw new RangeError(`host buffer length must be a non-negative integer, got ${length}`);
    }
    if (length > BUFFER_MAX_LENGTH) {
      throw new RangeError(`host buffer length ${length} exceeds the Component Model's ` + `Buffer.MAX_LENGTH (${BUFFER_MAX_LENGTH})`);
    }
  }
  remain() {
    return this.length - this.progress;
  }
  isZeroLength() {
    return this.length === 0;
  }
  read(n) {
    assert_(n <= this.remain(), "host buffer read beyond remaining");
    const out = this.values === null ? new Array(n).fill(null) : this.values.slice(this.progress, this.progress + n);
    this.progress += n;
    return out;
  }
  write(vs) {
    assert_(vs.length <= this.remain(), "host buffer write beyond remaining");
    this.#chunks.push(vs);
    this.progress += vs.length;
  }
  taken() {
    const u8 = this.t !== null && despecialize(this.t).kind === "u8";
    if (u8) {
      if (this.#chunks.length === 1 && this.#chunks[0] instanceof Uint8Array) {
        return this.#chunks[0];
      }
      const out2 = new Uint8Array(this.progress);
      let o = 0;
      for (const c of this.#chunks) {
        if (c instanceof Uint8Array)
          out2.set(c, o);
        else
          for (let i = 0;i < c.length; i++)
            out2[o + i] = c[i];
        o += c.length;
      }
      return out2;
    }
    if (this.#chunks.length === 1 && Array.isArray(this.#chunks[0])) {
      return this.#chunks[0];
    }
    const out = [];
    for (const c of this.#chunks) {
      for (let i = 0;i < c.length; i++)
        out.push(c[i]);
    }
    return out;
  }
  #scratch = null;
  byteView(n) {
    assert_(n <= this.remain(), "host direct window beyond remaining");
    if (this.values === null) {
      if (this.#scratch === null || this.#scratch.length !== n) {
        this.#scratch = new Uint8Array(n);
      }
      return this.#scratch;
    }
    assert_(this.values instanceof Uint8Array, "host direct window on a non-u8 chunk");
    return this.values.subarray(this.progress, this.progress + n);
  }
  advanceBytes(k) {
    assert_(k >= 0 && k <= this.remain(), "host direct advance beyond remaining");
    if (this.values === null) {
      const scratch2 = this.#scratch ?? new Uint8Array(k);
      this.write(scratch2.subarray(0, k));
    } else {
      this.progress += k;
    }
  }
  endWindow() {
    this.#scratch = null;
  }
}

class HostActivity {
  #store = null;
  #promise = null;
  #resolve = null;
  #closed = false;
  #disarmed = false;
  #pumping = false;
  bind(store3) {
    if (this.#store !== null || this.#closed)
      return;
    this.#store = store3;
    this.#arm();
  }
  #arm() {
    if (this.#store === null || this.#promise !== null)
      return;
    if (this.#closed || this.#disarmed)
      return;
    this.#promise = new Promise((r) => this.#resolve = r);
    markHostActivityArm(this.#promise);
    this.#store.pendingHostCalls.add(this.#promise);
  }
  notify() {
    const p = this.#promise, r = this.#resolve;
    this.#promise = null;
    this.#resolve = null;
    if (p !== null && this.#store !== null) {
      this.#store.pendingHostCalls.delete(p);
    }
    r?.();
    this.#arm();
  }
  pump() {
    const store3 = this.#store;
    if (store3 === null)
      return;
    try {
      for (;; ) {
        const serviced = store3.serviceSettled();
        const ticked = store3.tick();
        if (!serviced && !ticked)
          break;
      }
    } catch (e) {
      store3.hostFailure ??= e;
      throw e;
    }
    if (this.#pumping)
      return;
    if (storeQuiescent(store3))
      return;
    this.#pumping = true;
    this.#pumpAsync(store3);
  }
  async#pumpAsync(store3) {
    try {
      while (!storeQuiescent(store3)) {
        if (storeDriverDepth(store3) > 0) {
          await whenStoreDriverIdle(store3);
          continue;
        }
        await driveStoreAsync(store3, () => store3.pendingHostCalls.size === 0 || storeQuiescent(store3) || storeDriverDepth(store3) > 1, "host stream/future activity");
      }
    } catch (e) {
      store3.hostFailure ??= e;
    } finally {
      this.#pumping = false;
    }
    this.notify();
  }
  close() {
    const p = this.#promise, r = this.#resolve;
    this.#closed = true;
    this.#promise = null;
    this.#resolve = null;
    if (p !== null && this.#store !== null) {
      this.#store.pendingHostCalls.delete(p);
    }
    r?.();
  }
  disarm() {
    const p = this.#promise, r = this.#resolve;
    this.#disarmed = true;
    this.#promise = null;
    this.#resolve = null;
    if (p !== null && this.#store !== null) {
      this.#store.pendingHostCalls.delete(p);
    }
    r?.();
  }
  rearm() {
    if (this.#closed)
      return;
    this.#disarmed = false;
    this.#arm();
  }
}

class DirectScope {
  peer;
  capacity;
  marked = 0;
  #live = true;
  constructor(peer, capacity) {
    this.peer = peer;
    this.capacity = capacity;
  }
  remaining() {
    this.#check();
    return this.peer.byteView(this.capacity).subarray(this.marked);
  }
  markWritten(n) {
    this.#mark(n, "markWritten");
  }
  markRead(n) {
    this.#mark(n, "markRead");
  }
  #mark(n, who) {
    this.#check();
    if (!Number.isInteger(n) || n < 0) {
      throw new TypeError(`${who}(${n}): a direct-access mark must be a non-negative integer`);
    }
    if (this.marked + n > this.capacity) {
      throw new TypeError(`${who}(${n}) would take the invocation's cumulative mark to ` + `${this.marked + n}, past the ${this.capacity} byte(s) the view ` + `held on entry (embedder-api.md §"Streams and futures" ("Direct-access byte edges"))`);
    }
    this.marked += n;
  }
  #check() {
    if (!this.#live) {
      throw new TypeError("this direct-access view is dead: a DirectDestination/DirectSource " + "is scoped to the synchronous callback invocation it was passed " + "to, and retaining one past its return is misuse (embedder-api.md " + `§"Streams and futures" ("Direct-access byte edges"), polyengine#128)`);
    }
  }
  die() {
    this.#live = false;
  }
}

class DirectSession {
  t;
  invoke;
  direct = true;
  total = 0;
  ended = false;
  endedByVerdict = false;
  pending = false;
  cancelled = false;
  #settle = null;
  #reject = null;
  constructor(t, invoke) {
    this.t = t;
    this.invoke = invoke;
  }
  remain() {
    return this.ended ? 0 : BUFFER_MAX_LENGTH;
  }
  isZeroLength() {
    return false;
  }
  read(_n) {
    throw new Error("internal: a direct session must go through the direct-access byte edge seam");
  }
  write(_vs) {
    throw new Error("internal: a direct session must go through the direct-access byte edge seam");
  }
  runDirect(peer, n) {
    const scope = new DirectScope(peer, n);
    try {
      return this.#runDirect(scope, peer);
    } finally {
      peer.endWindow?.();
    }
  }
  #runDirect(scope, peer) {
    let verdict;
    try {
      verdict = this.invoke(scope);
    } catch (e) {
      scope.die();
      this.#fail(e);
      return "failed";
    }
    scope.die();
    if (verdict !== "more" && verdict !== "done") {
      this.#fail(new TypeError(`a direct-access callback must return "more" or "done", got ` + `${JSON.stringify(verdict)} (embedder-api.md §"Streams and futures" ("Direct-access byte edges"))`));
      return "failed";
    }
    const k = scope.marked;
    if (k === 0) {
      if (verdict === "done") {
        this.ended = true;
        this.endedByVerdict = true;
        return "retracted";
      }
      this.#fail(new TypeError('a direct-access callback returned "more" without marking any ' + "bytes; a session that has nothing to offer retracts by " + 'returning "done" (embedder-api.md §"Streams and futures" ("Direct-access byte edges") (polyengine#128))'));
      return "failed";
    }
    peer.advanceBytes(k);
    this.total += k;
    if (verdict === "done") {
      this.ended = true;
      this.endedByVerdict = true;
    }
    return "copied";
  }
  failDirect(error) {
    this.#fail(error);
  }
  arm(settle, reject) {
    this.#settle = settle;
    this.#reject = reject;
  }
  #take() {
    const s = this.#settle, r = this.#reject;
    this.#settle = null;
    this.#reject = null;
    return [s, r];
  }
  #fail(e) {
    this.ended = true;
    this.pending = false;
    const [, r] = this.#take();
    r?.(e);
  }
  finish() {
    this.ended = true;
    this.pending = false;
    const [s] = this.#take();
    s?.("done");
  }
  reissue() {
    this.pending = false;
    const [s] = this.#take();
    s?.("reissue");
  }
}
function requireU8Element(t, who) {
  if (t === null || despecialize(t).kind !== "u8") {
    throw new TypeError(`${who} is available on stream<u8> only; this stream's element type ` + `is ${t === null ? "the zero-width payload" : despecialize(t).kind} ` + `(embedder-api.md §"Streams and futures" ("Direct-access byte edges") (polyengine#128))`);
  }
}
function bindOnLower(shared, activity, kind, alsoOnLowered) {
  const holder = shared;
  assert_(holder.onLowered == null, "internal: a second host wrapper was built for an already-wrapped " + "stream/future (the wrapper cache should have returned the first)");
  assert_(holder.onLifted == null, "internal: a second host wrapper installed a lift hook on an " + "already-wrapped stream/future (the wrapper cache should have " + "returned the first)");
  holder.onLowered = (inst) => {
    alsoOnLowered?.();
    if (kind === "lifted") {
      activity.disarm();
    } else {
      activity.bind(inst.store);
    }
  };
  holder.onLifted = () => activity.rearm();
  shared.whenDropped(() => activity.close());
  const bound = shared.boundStore;
  if (bound)
    activity.bind(bound);
}
function mkStreamEnds(shared, activity) {
  const writeInst = hostEndInstance("write");
  const readInst = hostEndInstance("read");
  const parked = { read: false, write: false };
  const settle = (result) => {
    if (result === CopyResult.DROPPED)
      activity.close();
    else
      activity.notify();
  };
  const withdraw = (side, buf) => {
    if (!parked[side])
      return;
    parked[side] = false;
    if (shared.pendingBuffer === buf)
      shared.cancel();
    activity.notify();
  };
  const direct = {
    read: null,
    write: null
  };
  const runDirectSession = async (side, session) => {
    parked[side] = true;
    direct[side] = session;
    try {
      for (;; ) {
        if (session.cancelled)
          break;
        const step = await new Promise((res, rej) => {
          session.arm(res, rej);
          session.pending = true;
          const onCopy = (reclaim) => {
            if (!session.ended)
              return;
            reclaim();
            activity.notify();
            session.finish();
          };
          const onCopyDone = (result) => {
            session.pending = false;
            settle(result);
            if (result === CopyResult.COMPLETED && !session.ended) {
              session.reissue();
            } else {
              session.finish();
            }
          };
          if (side === "write") {
            shared.write(writeInst, session, onCopy, onCopyDone);
          } else {
            shared.read(readInst, session, onCopy, onCopyDone);
          }
          activity.notify();
          try {
            activity.pump();
          } catch (e) {
            retractDirect(session);
            throw e;
          }
        });
        if (step === "done")
          break;
      }
    } finally {
      parked[side] = false;
      direct[side] = null;
    }
    return session.total;
  };
  const retractDirect = (session) => {
    session.cancelled = true;
    if (session.pending && shared.pendingBuffer === session) {
      shared.cancel();
    } else {
      session.finish();
    }
  };
  const cancelDirect = (session) => {
    retractDirect(session);
    activity.notify();
    activity.pump();
  };
  return {
    writable: {
      write(values2) {
        if (parked.write) {
          throw new TypeError("a write is already in flight on this stream's writable end; " + "await it or cancelWrite() first");
        }
        const buf = new HostBuffer(shared.t, values2, values2.length);
        return new Promise((resolve) => {
          parked.write = true;
          shared.write(writeInst, buf, (reclaim) => {
            if (buf.remain() > 0)
              return;
            reclaim();
            parked.write = false;
            activity.notify();
            resolve(buf.progress);
          }, (result) => {
            parked.write = false;
            settle(result);
            resolve(buf.progress);
          });
          activity.notify();
          try {
            activity.pump();
          } catch (e) {
            withdraw("write", buf);
            throw e;
          }
        });
      },
      async writeAll(values2) {
        let sent = 0;
        while (sent < values2.length && !shared.dropped) {
          const rest = sent === 0 ? values2 : values2 instanceof Uint8Array ? values2.subarray(sent) : values2.slice(sent);
          const n = await this.write(rest);
          if (n === 0)
            break;
          sent += n;
        }
        return sent;
      },
      writeDirect(produce, info) {
        if (parked.write) {
          throw new TypeError("a write is already in flight on this stream's writable end; " + "await it or cancelWrite() first");
        }
        requireU8Element(shared.t, "writeDirect");
        const session = new DirectSession(shared.t, (scope) => produce(scope));
        const p = runDirectSession("write", session);
        if (info === undefined)
          return p;
        return p.then((n) => {
          info.endedByVerdict = session.endedByVerdict;
          return n;
        });
      },
      cancelWrite() {
        if (!parked.write)
          return;
        const session = direct.write;
        if (session !== null)
          return cancelDirect(session);
        parked.write = false;
        shared.cancel();
        activity.notify();
        activity.pump();
      },
      drop() {
        shared.drop();
        activity.close();
        activity.pump();
      },
      onDropped(fn) {
        shared.whenDropped(fn);
      }
    },
    readable: {
      read(max) {
        if (parked.read) {
          throw new TypeError("a read is already in flight on this stream's readable end; " + "await it or cancelRead() first");
        }
        const buf = new HostBuffer(shared.t, null, max);
        return new Promise((resolve) => {
          parked.read = true;
          shared.read(readInst, buf, (reclaim) => {
            reclaim();
            parked.read = false;
            activity.notify();
            resolve(buf.taken());
          }, (result) => {
            parked.read = false;
            settle(result);
            resolve(buf.taken());
          });
          activity.notify();
          try {
            activity.pump();
          } catch (e) {
            withdraw("read", buf);
            throw e;
          }
        });
      },
      readDirect(consume, info) {
        if (parked.read) {
          throw new TypeError("a read is already in flight on this stream's readable end; " + "await it or cancelRead() first");
        }
        requireU8Element(shared.t, "readDirect");
        const session = new DirectSession(shared.t, (scope) => consume(scope));
        const p = runDirectSession("read", session);
        if (info === undefined)
          return p;
        return p.then((n) => {
          info.endedByVerdict = session.endedByVerdict;
          return n;
        });
      },
      cancelRead() {
        if (!parked.read)
          return;
        const session = direct.read;
        if (session !== null)
          return cancelDirect(session);
        parked.read = false;
        shared.cancel();
        activity.notify();
        activity.pump();
      },
      drop() {
        shared.drop();
        activity.close();
        activity.pump();
      }
    }
  };
}
var streamWrappers = new WeakMap;
var futureWrappers = new WeakMap;
function hostStream(element) {
  const shared = new SharedStreamImpl(element);
  const activity = new HostActivity;
  bindOnLower(shared, activity, "created");
  const ends = mkStreamEnds(shared, activity);
  const wrapper = { ...ends, value: shared };
  streamWrappers.set(shared, wrapper);
  return wrapper;
}
function hostStreamFor(value) {
  const shared = value;
  assert_(shared instanceof SharedStreamImpl, "hostStreamFor expects a lifted stream value");
  const cached = streamWrappers.get(shared);
  if (cached !== undefined)
    return cached;
  const activity = new HostActivity;
  bindOnLower(shared, activity, "lifted");
  const ends = mkStreamEnds(shared, activity);
  const wrapper = { ...ends, value };
  streamWrappers.set(shared, wrapper);
  return wrapper;
}
function hostFuture(element) {
  const shared = new SharedFutureImpl(element);
  const activity = new HostActivity;
  const lowering = { lowered: false };
  bindOnLower(shared, activity, "created", () => lowering.lowered = true);
  const wrapper = mkFuture(shared, activity, shared, lowering);
  futureWrappers.set(shared, wrapper);
  return wrapper;
}
function hostFutureFor(value) {
  const shared = value;
  assert_(shared instanceof SharedFutureImpl, "hostFutureFor expects a lifted future value");
  const cached = futureWrappers.get(shared);
  if (cached !== undefined)
    return cached;
  const activity = new HostActivity;
  const lowering = { lowered: false };
  bindOnLower(shared, activity, "lifted", () => lowering.lowered = true);
  const wrapper = mkFuture(shared, activity, value, lowering);
  futureWrappers.set(shared, wrapper);
  return wrapper;
}
function mkFuture(shared, activity, value, lowering) {
  const writeInst = hostEndInstance("write");
  const readInst = hostEndInstance("read");
  const parked = { any: false };
  let delivered = false;
  const settle = (result) => {
    parked.any = false;
    if (result === CopyResult.COMPLETED)
      delivered = true;
    if (result === CopyResult.DROPPED)
      activity.close();
    else
      activity.notify();
  };
  const withdraw = (buf) => {
    if (!parked.any)
      return;
    parked.any = false;
    if (shared.pendingBuffer === buf)
      shared.cancel();
    activity.notify();
  };
  const self = {
    write(v) {
      if (parked.any) {
        throw new TypeError("an operation is already in flight on this future; " + "await it or cancel() first");
      }
      const buf = new HostBuffer(shared.t, [v], 1);
      return new Promise((resolve) => {
        parked.any = true;
        shared.write(writeInst, buf, (result) => {
          settle(result);
          resolve();
        });
        activity.notify();
        try {
          activity.pump();
        } catch (e) {
          withdraw(buf);
          throw e;
        }
      });
    },
    readResult() {
      if (parked.any) {
        throw new TypeError("an operation is already in flight on this future; " + "await it or cancel() first");
      }
      if (shared.dropped) {
        return Promise.resolve({
          value: undefined,
          result: CopyResult.DROPPED
        });
      }
      const buf = new HostBuffer(shared.t, null, 1);
      return new Promise((resolve) => {
        parked.any = true;
        shared.read(readInst, buf, (result) => {
          settle(result);
          resolve({
            value: buf.taken()[0],
            result
          });
        });
        activity.notify();
        try {
          activity.pump();
        } catch (e) {
          withdraw(buf);
          throw e;
        }
      });
    },
    async read() {
      return (await self.readResult()).value;
    },
    cancel() {
      if (!parked.any)
        return;
      parked.any = false;
      shared.cancel();
      activity.notify();
      activity.pump();
    },
    drop() {
      if (!delivered && lowering.lowered && !shared.dropped) {
        abandonSharedFuture(shared, new Error("the host dropped the writable end of this future without " + "writing a value"));
      } else {
        shared.drop();
      }
      activity.close();
      activity.pump();
    },
    value
  };
  return self;
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/embedder/casing.js
function camelCase(label) {
  const parts = label.split("-");
  return parts[0] + parts.slice(1).map(upperFirst).join("");
}
function pascalCase(label) {
  return label.split("-").map(upperFirst).join("");
}
function upperFirst(s) {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
var MANGLED = /^\[([a-z-]+)\](.*)$/;
function parseLeafName(raw) {
  const m = MANGLED.exec(raw);
  if (m === null)
    return { form: "plain", name: raw };
  const [, tag, rest] = m;
  switch (tag) {
    case "constructor":
      if (!rest.includes("["))
        return { form: "constructor", resource: rest };
      break;
    case "method":
    case "static": {
      const dot = rest.indexOf(".");
      if (dot < 0)
        break;
      const resource = rest.slice(0, dot);
      if (resource.includes("["))
        break;
      return { form: tag, resource, member: rest.slice(dot + 1) };
    }
  }
  throw new Error(`unrecognized mangled export/import name '${raw}': the bracket form is ` + `not one this runtime understands (only [constructor]/[method]/` + `[static] are implemented; getter/setter forms like [get]/[set] are ` + `not yet implemented — polyengine#254)`);
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/embedder/errors.js
class NameCollisionError extends Error {
  constructor(message) {
    super(message);
    this.name = "NameCollisionError";
  }
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/embedder/imports.js
function toLoaded(input) {
  if ("wire" in input && "types" in input)
    return input;
  const wire = "plan" in input ? input.plan : input;
  return loadPlan(wire);
}
function requiredImports(input) {
  const loaded = toLoaded(input);
  return loaded.wire.imports.map((imp) => {
    const leaf = imp.path.length === 0 ? imp.name : imp.path[imp.path.length - 1];
    const member = parseLeafName(leaf);
    const out = {
      interfaceId: imp.name,
      path: [...imp.path],
      leaf,
      kind: imp.kind,
      member,
      jsName: jsNameOf(member, imp.kind)
    };
    if (member.form !== "plain")
      out.jsClass = pascalCase(member.resource);
    if (imp.type !== undefined) {
      const t = loaded.types[imp.type];
      if (t !== undefined && t.kind === "func") {
        out.type = {
          params: t.funcType.params.map((p, i) => ({
            name: t.paramNames[i] ?? String(i),
            type: p
          })),
          results: t.funcType.results,
          async: t.funcType.async === true
        };
      }
    }
    return out;
  });
}
function jsNameOf(member, kind) {
  switch (member.form) {
    case "plain":
      return kind === "resource" ? pascalCase(member.name) : camelCase(member.name);
    case "constructor":
      return "constructor";
    case "method":
    case "static":
      return camelCase(member.member);
  }
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/embedder/sync.js
var SYNC_CALLABLE = Symbol.for("polyengine.syncCallable/1");
function markSyncCallable(target, payload) {
  Object.defineProperty(target, SYNC_CALLABLE, {
    value: payload,
    enumerable: false,
    writable: false,
    configurable: false
  });
}
function syncPayloadOf(target) {
  if (target === null)
    return;
  const t = typeof target;
  if (t !== "object" && t !== "function")
    return;
  return target[SYNC_CALLABLE];
}
var views = new WeakMap;

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/embedder/resources.js
var STATE = RESOURCE_STATE;

class GuestResource {
  constructor() {
    defineRealmLocal(this);
  }
  drop() {
    dropWrapper(this);
  }
  [Symbol.dispose]() {
    dropWrapper(this);
  }
}
var runBackstop = (s) => {
  if (!s.valid || !s.owns)
    return;
  s.valid = false;
  if (s.lends > 0) {
    s.pendingDrop = true;
    return;
  }
  runHostDrop(s);
};
var leaked = new FinalizationRegistry(runBackstop);
function runHostDrop(s) {
  try {
    hostDtorCall(s.rt, s.rep);
  } catch (e) {
    recordHostFailure(s.rt, e);
  }
}
function recordHostFailure(rt, e) {
  const store3 = rt.impl?.store;
  if (store3 !== undefined && store3.hostFailure === undefined) {
    store3.hostFailure = e;
  }
}
function initWrapper(w, state) {
  state.copyUrl ??= COPY_URL;
  w[STATE] = state;
  if (state.owns)
    leaked.register(w, state, w);
}
function wrapperState(w) {
  const s = w[STATE];
  if (s === undefined)
    return;
  return s.copyUrl === COPY_URL ? s : undefined;
}
function isForeignWrapper(w) {
  return w[STATE] !== undefined;
}
function requireLive(w, what) {
  const s = wrapperState(w);
  if (s === undefined) {
    if (isForeignWrapper(w)) {
      throw new InvalidHandleError(`${what}: ${describeCrossCopy("this resource handle", "Resource wrappers hold a rep in the minting copy's tables; there " + "is no by-value form — call through the copy that created it.")}`);
    }
    throw new InvalidHandleError(`${what}: not a resource handle`);
  }
  if (!s.valid) {
    throw new InvalidHandleError(`${what}: this ${s.className} handle is no longer valid (it was ` + `transferred as own<…>, dropped, or was a borrow that outlived its ` + `call)`);
  }
  return s;
}
function dropWrapper(w) {
  const s = wrapperState(w);
  if (s === undefined || !s.valid)
    return;
  s.valid = false;
  leaked.unregister(w);
  if (!s.owns)
    return;
  if (s.lends > 0) {
    s.pendingDrop = true;
    return;
  }
  hostDtorCall(s.rt, s.rep);
}
function lendWrapper(w) {
  const s = wrapperState(w);
  if (s === undefined)
    return () => {};
  s.lends += 1;
  let released = false;
  return () => {
    if (released)
      return;
    released = true;
    releaseLend(s);
  };
}
function releaseLend(s) {
  s.lends -= 1;
  if (s.lends > 0 || !s.pendingDrop)
    return;
  s.pendingDrop = false;
  runHostDrop(s);
}
function invalidateWrapper(w) {
  const s = wrapperState(w);
  if (s === undefined)
    return;
  s.valid = false;
  leaked.unregister(w);
}
function takeRep(w, own, what) {
  if (typeof w !== "object" || w === null) {
    throw new InvalidHandleError(`${what}: expected a resource class instance, got ${typeof w}`);
  }
  const s = requireLive(w, what);
  if (own) {
    if (s.lends > 0) {
      throw new InvalidHandleError(`${what}: this ${s.className} handle is still lent out as a borrow ` + `to an in-flight call and cannot be transferred`);
    }
    s.valid = false;
    leaked.unregister(w);
  }
  return s.rep;
}
function buildGuestResourceClass(spec, rt, wrapExport, lowerArgs) {
  const className = pascalCase(spec.name);
  const cls = class extends GuestResource {
    constructor(...args) {
      super();
      if (spec.ctor === null) {
        throw new TypeError(`${className} has no WIT constructor; use its static functions`);
      }
      const where = `${className} constructor`;
      const lowered = lowerArgs(args, spec.ctorParams ?? [], where);
      const rep = spec.ctor(...lowered);
      if (rep !== null && typeof rep === "object" && "then" in rep) {
        throw new TypeError(`${where}: the guest constructor did not complete synchronously. ` + `A JS constructor cannot await; expose an async factory instead.`);
      }
      if (typeof rep !== "number") {
        throw new TypeError(`${where}: expected an own handle rep, got ${typeof rep}`);
      }
      initWrapper(this, {
        rep,
        valid: true,
        owns: true,
        rt,
        className,
        lends: 0,
        pendingDrop: false
      });
    }
  };
  Object.defineProperty(cls, "name", { value: className });
  for (const m of spec.methods) {
    const js = camelCase(m.member);
    const where = `${className}.${js}`;
    const wrapped = wrapExport(m.raw, m.params, m.results, m.async, where);
    const methodFn = function(...args) {
      return wrapped(this, ...args);
    };
    const payload = syncPayloadOf(wrapped);
    if (payload !== undefined) {
      markSyncCallable(methodFn, payload.kind === "free" ? { kind: "method", fn: payload.fn } : payload);
    }
    Object.defineProperty(cls.prototype, js, {
      configurable: true,
      writable: true,
      value: methodFn
    });
  }
  for (const s of spec.statics) {
    const js = camelCase(s.member);
    const where = `${className}.${js} (static)`;
    const wrapped = wrapExport(s.raw, s.params, s.results, s.async, where);
    const staticFn = (...args) => wrapped(...args);
    const payload = syncPayloadOf(wrapped);
    if (payload !== undefined)
      markSyncCallable(staticFn, payload);
    Object.defineProperty(cls, js, {
      configurable: true,
      writable: true,
      value: staticFn
    });
  }
  return cls;
}
function makeWrapper(cls, rep, rt, owns) {
  const w = Object.create(cls.prototype);
  defineRealmLocal(w);
  initWrapper(w, {
    rep,
    valid: true,
    owns,
    rt,
    className: cls.name ?? "resource",
    lends: 0,
    pendingDrop: false
  });
  return w;
}

class HostResourceRegistry {
  className;
  #byRep = new Map;
  #byInstance = new WeakMap;
  #next = 1;
  constructor(className) {
    this.className = className;
  }
  repFor(instance) {
    if (instance === null || typeof instance !== "object") {
      throw new TypeError(`${this.className}: expected a class instance, got ${typeof instance}`);
    }
    const held = this.#byInstance.get(instance);
    if (held !== undefined && this.#byRep.has(held))
      return held;
    const rep = this.#next++;
    this.#byRep.set(rep, instance);
    this.#byInstance.set(instance, rep);
    return rep;
  }
  hasInstance(instance) {
    if (instance === null || typeof instance !== "object")
      return false;
    const held = this.#byInstance.get(instance);
    return held !== undefined && this.#byRep.has(held);
  }
  hasRep(rep) {
    return this.#byRep.has(rep);
  }
  releaseIfPresent(rep) {
    this.#byRep.delete(rep);
  }
  lookup(rep) {
    const inst = this.#byRep.get(rep);
    if (inst === undefined) {
      throw new InvalidHandleError(`${this.className}: no live instance for rep ${rep}`);
    }
    return inst;
  }
  release(rep) {
    const inst = this.lookup(rep);
    this.#byRep.delete(rep);
    return inst;
  }
  dtor(rep) {
    const inst = this.#byRep.get(rep);
    if (inst === undefined)
      return;
    this.#byRep.delete(rep);
    inst[Symbol.dispose]?.();
  }
  get liveCount() {
    return this.#byRep.size;
  }
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/embedder/streams.js
var producerFailures = new WeakMap;
function reportProducerFailure(host, where, cause) {
  const err = isStreamProducerError(cause) ? cause : new StreamProducerError(where, cause);
  const shared = host.value;
  producerFailures.set(host.value, err);
  const store3 = shared.boundStore;
  if (store3 != null && typeof store3 === "object") {
    if (store3.hostFailure === undefined)
      store3.hostFailure = err;
    return true;
  }
  return false;
}
function throwIfFailed(value, where = "stream") {
  const e = producerFailures.get(value);
  if (e !== undefined)
    throw e;
  throwIfPeerTrapped(value, where);
}
function throwIfPeerTrapped(value, where, progress) {
  const p = poisonFailureOf(value);
  if (p !== undefined)
    throw new PeerTrappedError(where, p, progress);
}
function isU8Element(element) {
  return element !== null && despecialize(element).kind === "u8";
}
function requireU8Direct(codec, who) {
  if (codec === null || !isU8Element(codec.element)) {
    throw new TypeError(`${who} is available on stream<u8> only (embedder-api.md §"Streams and futures" ("Direct-access byte edges"), ` + `polyengine#128); use write()/read() for other element types`);
  }
}

class Stream {
  #host;
  #codec;
  #consumed = false;
  #dropped = false;
  #binders = [];
  constructor(host, codec) {
    this.#host = host;
    this.#codec = codec;
    defineRealmLocal(this);
  }
  static fromLifted(value, codec) {
    return new Stream(hostStreamFor(value), codec);
  }
  static fromHostStream(host, codec) {
    return new Stream(host, codec);
  }
  static create() {
    const stream = new Stream(null, null);
    return { stream, writer: new StreamWriter(stream) };
  }
  bindElement(codec) {
    if (this.#host !== null)
      return;
    this.#codec = codec;
    this.#host = hostStream(codec.element);
    publishHostStream(this, this.#host);
    const waiters = this.#binders;
    this.#binders = [];
    for (const w of waiters)
      w();
  }
  whenBound() {
    if (this.#host !== null)
      return Promise.resolve();
    return new Promise((r) => this.#binders.push(r));
  }
  get bound() {
    return this.#host !== null;
  }
  takeValue(codec) {
    this.bindElement(codec);
    if (this.#consumed) {
      throw new TypeError("this Stream handle has already been passed to a guest; a stream " + "value may only be transferred once");
    }
    this.#consumed = true;
    return this.#host.value;
  }
  get codec() {
    return this.#codec;
  }
  #require() {
    if (this.#host === null) {
      throw new TypeError("this Stream was created with Stream.create() and has not been " + "passed to a guest yet, so it has no element type; pass it first, " + "or use the writer, which parks until then");
    }
    if (this.#consumed) {
      throw new TypeError("this Stream handle has already been passed to a guest; the guest " + "owns its readable end, so it can no longer be read from the host " + "(issue #162)");
    }
    return this.#host;
  }
  async read(max) {
    const host = this.#require();
    const where = this.#codec?.where ?? "stream read";
    throwIfFailed(host.value, where);
    const raw = await host.readable.read(max);
    if (raw.length === 0)
      throwIfPeerTrapped(host.value, where);
    return this.#chunk(raw);
  }
  async readDirect(consume) {
    const host = this.#require();
    const where = this.#codec?.where ?? "stream read";
    throwIfFailed(host.value, where);
    requireU8Direct(this.#codec, "readDirect");
    const info = { endedByVerdict: false };
    const n = await host.readable.readDirect(consume, info);
    if (!info.endedByVerdict)
      throwIfPeerTrapped(host.value, where, n);
    return n;
  }
  #chunk(raw) {
    const codec = this.#codec;
    if (isU8Element(codec.element)) {
      return raw instanceof Uint8Array ? raw : Uint8Array.from(raw);
    }
    const vs = raw instanceof Uint8Array ? Array.from(raw) : raw;
    return vs.map((v) => codec.toHost(v));
  }
  cancelRead() {
    this.#host?.readable.cancelRead();
  }
  drop() {
    if (this.#dropped)
      return;
    this.#dropped = true;
    this.#host?.readable.drop();
  }
  dropForTeardown() {
    if (this.#dropped)
      return;
    this.#dropped = true;
    if (this.#host !== null) {
      dropSharedForTeardown(this.#host.value);
    }
  }
  [Symbol.dispose]() {
    this.drop();
  }
  readable() {
    const self = this;
    return new ReadableStream({
      async pull(controller) {
        const chunk = await self.read(READ_CHUNK);
        if (chunk.length === 0) {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
      },
      cancel() {
        self.drop();
      }
    });
  }
  async* [Symbol.asyncIterator]() {
    for (;; ) {
      const chunk = await this.read(READ_CHUNK);
      if (chunk.length === 0)
        return;
      yield chunk;
    }
  }
}
var READ_CHUNK = 4096;

class StreamWriter {
  #stream;
  constructor(stream) {
    this.#stream = stream;
    defineRealmLocal(this);
  }
  async write(values2) {
    await this.#stream.whenBound();
    const host = hostOf(this.#stream);
    const where = this.#stream.codec?.where ?? "stream write";
    throwIfFailed(host.value, where);
    const n = await host.writable.write(packChunk(values2, this.#stream.codec));
    if (n < values2.length)
      throwIfPeerTrapped(host.value, where, n);
    return n;
  }
  async writeDirect(produce) {
    await this.#stream.whenBound();
    const host = hostOf(this.#stream);
    const where = this.#stream.codec?.where ?? "stream write";
    throwIfFailed(host.value, where);
    requireU8Direct(this.#stream.codec, "writeDirect");
    const info = { endedByVerdict: false };
    const n = await host.writable.writeDirect(produce, info);
    if (!info.endedByVerdict)
      throwIfPeerTrapped(host.value, where, n);
    return n;
  }
  async writeAll(values2) {
    await this.#stream.whenBound();
    const host = hostOf(this.#stream);
    const where = this.#stream.codec?.where ?? "stream write";
    throwIfFailed(host.value, where);
    const n = await host.writable.writeAll(packChunk(values2, this.#stream.codec));
    if (n < values2.length)
      throwIfPeerTrapped(host.value, where, n);
    return n;
  }
  cancelWrite() {
    if (!this.#stream.bound)
      return;
    hostOf(this.#stream).writable.cancelWrite();
  }
  async close() {
    await this.#stream.whenBound();
    hostOf(this.#stream).writable.drop();
  }
}
var hostOfStream = new WeakMap;
function hostOf(s) {
  const h = hostOfStream.get(s);
  if (h === undefined) {
    throw new TypeError("stream writer used before the stream was bound");
  }
  return h;
}
function publishHostStream(s, h) {
  hostOfStream.set(s, h);
}

class Future {
  #host;
  #hostP;
  #codec;
  #consumed = false;
  #dropped = false;
  #settled = null;
  constructor(host, hostP, codec) {
    this.#host = host;
    this.#hostP = hostP;
    this.#codec = codec;
    defineRealmLocal(this);
  }
  static fromLifted(value, codec) {
    const h = hostFutureFor(value);
    return new Future(h, Promise.resolve(h), codec);
  }
  static fromHostFuture(host, codec) {
    return new Future(host, Promise.resolve(host), codec);
  }
  static deferred(pending, codec) {
    const hostP = pending.then((v) => {
      const h = hostFutureFor(v);
      f.adopt(h);
      return h;
    });
    hostP.catch(() => {});
    const f = new Future(null, hostP, codec);
    return f;
  }
  adopt(h) {
    this.#host = h;
  }
  takeValue() {
    if (this.#host === null) {
      throw new TypeError("this Future is still in flight and cannot be passed to a guest yet");
    }
    if (this.#consumed) {
      throw new TypeError("this Future handle has already been passed to a guest");
    }
    this.#consumed = true;
    return this.#host.value;
  }
  #read() {
    if (this.#consumed && this.#settled === null) {
      return Promise.reject(new TypeError("this Future handle has already been passed to a guest; the guest " + "owns its readable end, so it can no longer be read from the " + "host (issue #162)"));
    }
    this.#settled ??= (async () => {
      const host = await this.#hostP;
      const { value, result } = await host.readResult();
      if (result !== CopyResult.COMPLETED) {
        throwIfPeerTrapped(host.value, this.#codec.where ?? "future read");
        throw new DroppedError(result === CopyResult.CANCELLED ? "the future read was cancelled" : "the future's write end was dropped without a value");
      }
      return this.#codec.toHost(value);
    })();
    return this.#settled;
  }
  then(onfulfilled, onrejected) {
    return this.#read().then(onfulfilled, onrejected);
  }
  cancel() {
    if (this.#host !== null)
      this.#host.cancel();
    else
      this.#hostP.then((h) => h.cancel(), () => {});
  }
  drop() {
    if (this.#dropped)
      return;
    this.#dropped = true;
    if (this.#host !== null)
      this.#host.drop();
    else
      this.#hostP.then((h) => h.drop(), () => {});
  }
  dropForTeardown() {
    if (this.#dropped)
      return;
    if (this.#host !== null) {
      this.#dropped = true;
      dropSharedForTeardown(this.#host.value);
    } else {
      this.drop();
    }
  }
  [Symbol.dispose]() {
    this.drop();
  }
}

class ErrorContext2 {
  message;
  internal;
  constructor(internal) {
    this.internal = internal;
    this.message = internal.debugMessage;
    defineRealmLocal(this);
  }
}
defineBrand(Stream.prototype, STREAM);
defineBrand(StreamWriter.prototype, STREAM_WRITER);
defineBrand(Future.prototype, FUTURE);
defineBrand(ErrorContext2.prototype, ERROR_CONTEXT);
function lowerStreamSource(src, codec) {
  if (src instanceof Stream) {
    return src.takeValue(codec);
  }
  if (hasBrand(src, STREAM)) {
    throw new TypeError(describeCrossCopy("this stream handle", "To pipe it by value, pass `src.readable()` instead."));
  }
  const host = hostStream(codec.element);
  const stream = Stream.fromHostStream(host, codec);
  publishHostStream(stream, host);
  pump(src, host, codec);
  return host.value;
}
function packChunk(values2, codec) {
  const u8 = isU8Element(codec.element);
  if (values2 instanceof Uint8Array) {
    if (u8)
      return values2;
    return Array.from(values2).map((v) => codec.fromHost(v));
  }
  const lowered = values2.map((v) => codec.fromHost(v));
  return u8 ? Uint8Array.from(lowered) : lowered;
}
var READER_GONE = Symbol("polyengine reader gone");
async function pump(src, host, codec) {
  const where = codec.where ?? "stream producer";
  let failure;
  let produced = 0;
  const gone = new Promise((resolve) => host.writable.onDropped(() => resolve(READER_GONE)));
  try {
    for await (const batch of batches(src, gone)) {
      const lowered = packChunk(batch, codec);
      let n;
      try {
        n = await host.writable.writeAll(lowered);
      } catch (e) {
        releaseUntaken(lowered, e instanceof PeerTrappedError ? e.progress ?? 0 : 0, codec);
        throw e;
      }
      produced += n;
      if (n < lowered.length) {
        releaseUntaken(lowered, n, codec);
        break;
      }
    }
  } catch (e) {
    failure = e;
  }
  if (failure !== undefined) {
    reportProducerFailure(host, where, failure);
  }
  host.writable.drop();
}
function releaseUntaken(lowered, taken, codec) {
  const release = codec.release;
  if (release === undefined || lowered instanceof Uint8Array)
    return;
  for (let i = taken;i < lowered.length; i++)
    release(lowered[i]);
}
async function* batches(src, gone) {
  if (isReadableStream(src)) {
    const reader = src.getReader();
    try {
      for (;; ) {
        const r = await Promise.race([reader.read(), gone]);
        if (r === READER_GONE) {
          await reader.cancel().catch(() => {});
          return;
        }
        if (r.done)
          return;
        yield asBatch(r.value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  if (Symbol.asyncIterator in src) {
    const it = src[Symbol.asyncIterator]();
    try {
      for (;; ) {
        const pending = it.next();
        const r = await Promise.race([pending, gone]);
        if (r === READER_GONE) {
          src.cancel?.();
          try {
            const last = await pending;
            if (!last.done)
              yield asBatch(last.value);
          } catch {}
          return;
        }
        if (r.done)
          return;
        yield asBatch(r.value);
      }
    } finally {
      await it.return?.();
    }
  }
  for (const v of src)
    yield asBatch(v);
}
function asBatch(v) {
  if (v instanceof Uint8Array)
    return v;
  if (Array.isArray(v))
    return v;
  return [v];
}
function isReadableStream(v) {
  return typeof ReadableStream !== "undefined" && v instanceof ReadableStream;
}
function lowerFutureSource(src, codec) {
  if (src instanceof Future)
    return src.takeValue();
  if (hasBrand(src, FUTURE)) {
    throw new TypeError(describeCrossCopy("this future handle", "To pipe it by value, pass `Promise.resolve(f)` instead."));
  }
  const host = hostFuture(codec.element);
  (async () => {
    try {
      const v = await src;
      await host.write(codec.fromHost(v));
    } catch (e) {
      const reported = reportProducerFailure({ value: host.value }, codec.where ?? "future producer", e);
      if (!reported)
        host.drop();
    }
  })();
  return host.value;
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/embedder/values.js
class BorrowScope {
  #invalidate = [];
  add(f) {
    this.#invalidate.push(f);
  }
  end() {
    for (const f of this.#invalidate)
      f();
    this.#invalidate.length = 0;
  }
}
var NO_BORROWS = new BorrowScope;
var checkedLabels = new WeakSet;
function checkNoCollisions(key, labels, what) {
  if (checkedLabels.has(key))
    return;
  const seen = new Map;
  for (const l of labels) {
    const js = camelCase(l);
    const held = seen.get(js);
    if (held !== undefined) {
      throw new NameCollisionError(`${what}: the labels '${held}' and '${l}' both map to the JS name ` + `'${js}'. Rename one in the WIT; the conventions layer will not ` + `guess which one wins.`);
    }
    seen.set(js, l);
  }
  checkedLabels.add(key);
}
var recordTables = new WeakMap;
function recordTable(t) {
  const hit = recordTables.get(t);
  if (hit !== undefined)
    return hit;
  const table = {
    labels: t.fields.map((f) => f.label),
    fields: t.fields.map((f) => ({
      label: f.label,
      js: camelCase(f.label),
      type: f.type,
      isOption: f.type.kind === "option",
      optionInner: f.type.kind === "option" ? f.type.type : null
    }))
  };
  recordTables.set(t, table);
  return table;
}
var variantTables = new WeakMap;
function variantTable(cases) {
  const hit = variantTables.get(cases);
  if (hit !== undefined)
    return hit;
  const m = new Map;
  for (const c of cases)
    if (!m.has(c.label))
      m.set(c.label, c);
  variantTables.set(cases, m);
  return m;
}
var enumTables = new WeakMap;
function enumTable(t) {
  const hit = enumTables.get(t);
  if (hit !== undefined)
    return hit;
  const s = new Set(t.labels);
  enumTables.set(t, s);
  return s;
}
var flagsTables = new WeakMap;
function flagsTable(t) {
  const hit = flagsTables.get(t);
  if (hit !== undefined)
    return hit;
  const table = t.labels.map((label) => ({ label, js: camelCase(label) }));
  flagsTables.set(t, table);
  return table;
}
function toHost(v, t, o, scope = NO_BORROWS, inOption = false) {
  switch (t.kind) {
    case "bool":
    case "s8":
    case "u8":
    case "s16":
    case "u16":
    case "s32":
    case "u32":
    case "s64":
    case "u64":
    case "f32":
    case "f64":
    case "char":
    case "string":
      return v;
    case "error-context":
      return new ErrorContext2(v);
    case "list": {
      const elem = despecialize(t.element);
      if (elem.kind === "u8") {
        return v instanceof Uint8Array ? v : Uint8Array.from(v);
      }
      return v.map((e) => toHost(e, t.element, o, scope));
    }
    case "record": {
      const table = recordTable(t);
      checkNoCollisions(t, table.labels, `${o.where}: record`);
      const src = v;
      const out = {};
      for (const f of table.fields) {
        if (f.isOption) {
          const inner = src[f.label];
          if (inner.kind === "none")
            continue;
          out[f.js] = toHost(inner.value, f.optionInner, o, scope, true);
          continue;
        }
        out[f.js] = toHost(src[f.label], f.type, o, scope);
      }
      return out;
    }
    case "tuple": {
      const src = v;
      return t.elements.map((et, i) => toHost(src[String(i)], et, o, scope));
    }
    case "variant": {
      const { kind: label, value: payload } = internalTag(v, o);
      const c = variantTable(t.cases).get(label);
      if (c === undefined) {
        throw new TypeError(`${o.where}: unknown variant case '${label}'`);
      }
      return c.type === null ? { kind: label } : { kind: label, value: toHost(payload, c.type, o, scope) };
    }
    case "enum": {
      return internalTag(v, o).kind;
    }
    case "option": {
      const { kind: label, value: payload } = internalTag(v, o);
      if (inOption) {
        return label === "none" ? { kind: "none" } : { kind: "some", value: toHost(payload, t.type, o, scope, true) };
      }
      return label === "none" ? undefined : toHost(payload, t.type, o, scope, true);
    }
    case "result": {
      const { kind: label, value: payload } = internalTag(v, o);
      const kind = label === "error" ? "err" : "ok";
      const ct = label === "error" ? t.error : t.ok;
      return ct === null ? { kind } : { kind, value: toHost(payload, ct, o, scope) };
    }
    case "flags": {
      checkNoCollisions(t, t.labels, `${o.where}: flags`);
      const src = v;
      const out = {};
      for (const f of flagsTable(t))
        out[f.js] = Boolean(src[f.label]);
      return out;
    }
    case "map": {
      return toHost(v, despecialize(t), o, scope);
    }
    case "own":
      return o.bridge.liftOwn(v, t);
    case "borrow":
      return o.bridge.liftBorrow(v, t, scope);
    case "stream":
      return Stream.fromLifted(v, elemCodec(t.element, o));
    case "future":
      return Future.fromLifted(v, elemCodec(t.element, o));
  }
}
function internalTag(v, o) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw new TypeError(`${o.where}: expected a { kind, value } case object, got ${describe2(v)}`);
  }
  const rec = v;
  if (typeof rec.kind !== "string") {
    throw new TypeError(`${o.where}: expected a { kind, value } case object, got ${describe2(v)}`);
  }
  return rec;
}
function fromHost(v, t, o, inOption = false) {
  switch (t.kind) {
    case "bool":
      return Boolean(v);
    case "u8":
      return int(v, t.kind, 0, 255, o);
    case "u16":
      return int(v, t.kind, 0, 65535, o);
    case "u32":
      return int(v, t.kind, 0, 4294967295, o);
    case "s8":
      return int(v, t.kind, -128, 127, o);
    case "s16":
      return int(v, t.kind, -32768, 32767, o);
    case "s32":
      return int(v, t.kind, -2147483648, 2147483647, o);
    case "u64":
      return big(v, t.kind, 0n, (1n << 64n) - 1n, o);
    case "s64":
      return big(v, t.kind, -(1n << 63n), (1n << 63n) - 1n, o);
    case "f32":
    case "f64":
      if (typeof v !== "number") {
        throw new TypeError(`${o.where}: ${t.kind} expects a number`);
      }
      return v;
    case "char": {
      if (typeof v !== "string" || [...v].length !== 1) {
        throw new TypeError(`${o.where}: char expects a single-code-point string`);
      }
      const cp = v.codePointAt(0);
      if (cp >= 55296 && cp <= 57343) {
        throw new TypeError(`${o.where}: char expects a Unicode scalar value, got the lone ` + `surrogate U+${cp.toString(16).toUpperCase()}`);
      }
      return v;
    }
    case "string":
      if (typeof v !== "string") {
        throw new TypeError(`${o.where}: string expects a string`);
      }
      return v;
    case "error-context": {
      if (v instanceof ErrorContext2) {
        return v.internal;
      }
      if (v instanceof ErrorContext)
        return v;
      if (hasBrand(v, ERROR_CONTEXT) && typeof v.message === "string") {
        return new ErrorContext(v.message);
      }
      if (hasBrand(v, ERROR_CONTEXT)) {
        throw new TypeError(`${o.where}: ${describeCrossCopy("this error-context")}`);
      }
      throw new TypeError(`${o.where}: expected an ErrorContext`);
    }
    case "list": {
      const elem = despecialize(t.element);
      if (elem.kind === "u8") {
        if (v instanceof Uint8Array)
          return v;
        if (Array.isArray(v))
          return Uint8Array.from(v);
        throw new TypeError(`${o.where}: list<u8> expects a Uint8Array`);
      }
      if (!Array.isArray(v)) {
        throw new TypeError(`${o.where}: list expects an array`);
      }
      return v.map((e) => fromHost(e, t.element, o));
    }
    case "record": {
      if (v === null || typeof v !== "object") {
        throw new TypeError(`${o.where}: record expects an object`);
      }
      const table = recordTable(t);
      checkNoCollisions(t, table.labels, `${o.where}: record`);
      const src = v;
      const out = {};
      for (const f of table.fields) {
        const key = f.js;
        if (f.isOption) {
          const inner = src[key];
          out[f.label] = inner === undefined ? { kind: "none", value: null } : { kind: "some", value: fromHost(inner, f.optionInner, o, true) };
          continue;
        }
        if (!(key in src)) {
          throw new TypeError(`${o.where}: record field '${key}' is missing`);
        }
        out[f.label] = fromHost(src[key], f.type, o);
      }
      return out;
    }
    case "tuple": {
      if (!Array.isArray(v) || v.length !== t.elements.length) {
        throw new TypeError(`${o.where}: tuple expects an array of ${t.elements.length}`);
      }
      const out = {};
      t.elements.forEach((et, i) => {
        out[String(i)] = fromHost(v[i], et, o);
      });
      return out;
    }
    case "variant": {
      const { kind, value, has } = hostTag(v, o);
      const c = variantTable(t.cases).get(kind);
      if (c === undefined) {
        throw new TypeError(`${o.where}: unknown variant case '${kind}'`);
      }
      if (c.type === null)
        return { kind, value: null };
      if (!has) {
        throw new TypeError(`${o.where}: variant case '${kind}' needs a 'value'`);
      }
      return { kind, value: fromHost(value, c.type, o) };
    }
    case "enum": {
      if (typeof v !== "string" || !enumTable(t).has(v)) {
        throw new TypeError(`${o.where}: enum expects one of ${t.labels.join(" | ")}, got ` + describe2(v));
      }
      return { kind: v, value: null };
    }
    case "option": {
      if (inOption) {
        const { kind, value, has } = hostTag(v, o);
        if (kind === "none")
          return { kind: "none", value: null };
        if (kind !== "some") {
          throw new TypeError(`${o.where}: a nested option must be { kind: "some" | "none" }`);
        }
        return {
          kind: "some",
          value: has ? fromHost(value, t.type, o, true) : null
        };
      }
      return v === undefined ? { kind: "none", value: null } : { kind: "some", value: fromHost(v, t.type, o, true) };
    }
    case "result": {
      const { kind, value, has } = hostTag(v, o);
      if (kind !== "ok" && kind !== "err") {
        throw new TypeError(`${o.where}: a result value must be { kind: "ok" | "err" }`);
      }
      const label = kind === "err" ? "error" : "ok";
      const ct = kind === "err" ? t.error : t.ok;
      if (ct === null)
        return { kind: label, value: null };
      if (!has) {
        throw new TypeError(`${o.where}: result case '${kind}' carries a payload and needs a 'value'`);
      }
      return { kind: label, value: fromHost(value, ct, o) };
    }
    case "flags": {
      if (v === null || typeof v !== "object") {
        throw new TypeError(`${o.where}: flags expects an object`);
      }
      checkNoCollisions(t, t.labels, `${o.where}: flags`);
      const src = v;
      const out = {};
      for (const f of flagsTable(t))
        out[f.label] = Boolean(src[f.js]);
      return out;
    }
    case "map":
      return fromHost(v, despecialize(t), o);
    case "own":
      return o.bridge.lowerOwn(v, t);
    case "borrow":
      return o.bridge.lowerBorrow(v, t);
    case "stream":
      return lowerStreamSource(v, elemCodec(t.element, o));
    case "future":
      return lowerFutureSource(v, elemCodec(t.element, o));
  }
}
function hostTag(v, o) {
  if (v === null || typeof v !== "object" || !("kind" in v)) {
    throw new TypeError(`${o.where}: expected a { kind, value? } value, got ${describe2(v)}`);
  }
  const rec = v;
  if (typeof rec.kind !== "string") {
    throw new TypeError(`${o.where}: 'kind' must be a string`);
  }
  return { kind: rec.kind, value: rec.value, has: "value" in rec };
}
function int(v, kind, lo, hi, o) {
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new TypeError(`${o.where}: ${kind} expects an integer number`);
  }
  if (v < lo || v > hi) {
    throw new TypeError(`${o.where}: ${kind} out of range: ${v}`);
  }
  return v;
}
function big(v, kind, lo, hi, o) {
  if (typeof v !== "bigint") {
    throw new TypeError(`${o.where}: ${kind} expects a bigint`);
  }
  if (v < lo || v > hi) {
    throw new TypeError(`${o.where}: ${kind} out of range: ${v}`);
  }
  return v;
}
function elemCodec(element, o) {
  return {
    element,
    where: o.where,
    toHost: (v) => element === null ? undefined : toHost(v, element, o),
    fromHost: (v) => element === null ? null : fromHost(v, element, o),
    release: element !== null && element.kind === "own" ? (v) => o.bridge.dropOwn(v, element) : undefined
  };
}
function describe2(v) {
  if (v === null)
    return "null";
  if (v === undefined)
    return "undefined";
  if (typeof v === "object")
    return `a ${v.constructor?.name ?? "object"}`;
  return `a ${typeof v} (${String(v)})`;
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/embedder/version.js
class ImportRegistrationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImportRegistrationError";
  }
}

class ImportResolutionError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImportResolutionError";
  }
}
var SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
function parseInterfaceId(id) {
  const at = id.lastIndexOf("@");
  if (at < 0)
    return { base: id, version: null, semver: null };
  const base = id.slice(0, at);
  const version = id.slice(at + 1);
  return { base, version, semver: parseSemver(version) };
}
function parseSemver(v) {
  const m = SEMVER.exec(v);
  if (m === null)
    return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] === undefined ? [] : m[4].split("."),
    build: m[5] ?? null
  };
}
function trackKeyOf(base, v) {
  if (v.prerelease.length > 0)
    return null;
  if (v.major > 0)
    return `${base}@${v.major}`;
  if (v.minor > 0)
    return `${base}@0.${v.minor}`;
  return null;
}
function asTrackKeySpelling(id) {
  const p = parseInterfaceId(id);
  if (p.version === null || p.semver !== null)
    return null;
  if (/^\d+$/.test(p.version))
    return p.version === "0" ? null : id;
  if (/^0\.\d+$/.test(p.version))
    return id;
  return null;
}

class ImportResolver {
  #exact = new Map;
  #tracks = new Map;
  #unversioned = new Map;
  constructor(record) {
    for (const key of Object.keys(record)) {
      if (this.#exact.has(key)) {
        throw new ImportRegistrationError(`duplicate import key '${key}'`);
      }
      this.#exact.set(key, record[key]);
      this.#register(key);
    }
  }
  #register(key) {
    const trackSpelling = asTrackKeySpelling(key);
    if (trackSpelling !== null) {
      this.#claim(trackSpelling, { key, version: null });
      return;
    }
    const p = parseInterfaceId(key);
    if (p.version === "0") {
      throw new ImportRegistrationError(`import key '${key}': '@0' is not a compatibility track. Major 0 ` + `tracks the MINOR version (\`@0.2\`), so no version canonicalizes ` + `to '@0' and this registration could never be resolved.`);
    }
    if (p.version === null) {
      if (p.base.includes("/") || p.base.includes(":")) {
        this.#unversioned.set(p.base, key);
      }
      return;
    }
    if (p.semver === null)
      return;
    const track = trackKeyOf(p.base, p.semver);
    if (track !== null)
      this.#claim(track, { key, version: p.semver });
  }
  #claim(track, claim) {
    const held = this.#tracks.get(track);
    if (held === undefined) {
      this.#tracks.set(track, claim);
      return;
    }
    if (held.version === null !== (claim.version === null)) {
      const [t, f] = held.version === null ? [held.key, claim.key] : [claim.key, held.key];
      throw new ImportRegistrationError(`import registration is ambiguous on compatibility track '${track}': ` + `the track key '${t}' and the full version '${f}' are both ` + `registered. Register one or the other, never both.`);
    }
    if (held.version === null) {
      throw new ImportRegistrationError(`compatibility track '${track}' is claimed twice ('${held.key}' and ` + `'${claim.key}')`);
    }
    if (compareSemver(claim.version, held.version) > 0) {
      this.#tracks.set(track, claim);
    }
  }
  keys() {
    return [...this.#exact.keys()];
  }
  resolve(id) {
    if (this.#exact.has(id))
      return { key: id, value: this.#exact.get(id) };
    const p = parseInterfaceId(id);
    if (p.semver !== null) {
      const track = trackKeyOf(p.base, p.semver);
      if (track !== null) {
        const claim = this.#tracks.get(track);
        if (claim !== undefined) {
          return { key: claim.key, value: this.#exact.get(claim.key) };
        }
      }
      const un = this.#unversioned.get(p.base);
      if (un !== undefined) {
        throw new ImportResolutionError(`import '${id}' is versioned but the only registration for ` + `'${p.base}' is the unversioned key '${un}'. Version-agnostic ` + `folding is banned (contracts/embedder-api.md §"Version canonicalization"): ` + `register '${p.base}@${p.version}' or the compatibility-track ` + `key '${trackKeyOf(p.base, p.semver) ?? p.base + "@" + p.version}'.`);
      }
      return;
    }
    if (p.version === null) {
      const near = [...this.#exact.keys()].filter((k) => parseInterfaceId(k).base === p.base);
      if (near.length > 0) {
        throw new ImportResolutionError(`import '${id}' is unversioned but the registrations for it are ` + `versioned (${near.join(", ")}). Version-agnostic folding is ` + `banned (contracts/embedder-api.md §"Version canonicalization").`);
      }
    }
    return;
  }
}
function compareSemver(a, b) {
  if (a.major !== b.major)
    return a.major - b.major;
  if (a.minor !== b.minor)
    return a.minor - b.minor;
  if (a.patch !== b.patch)
    return a.patch - b.patch;
  const ap = a.prerelease, bp = b.prerelease;
  if (ap.length === 0 && bp.length === 0)
    return 0;
  if (ap.length === 0)
    return 1;
  if (bp.length === 0)
    return -1;
  for (let i = 0;i < Math.max(ap.length, bp.length); i++) {
    const x = ap[i], y = bp[i];
    if (x === undefined)
      return -1;
    if (y === undefined)
      return 1;
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
    if (xn && yn) {
      if (Number(x) !== Number(y))
        return Number(x) - Number(y);
    } else if (xn !== yn) {
      return xn ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/embedder/instantiate.js
function relayMarks(from, to) {
  if (isSuspending(from))
    suspending(to);
  if (isDeferCancel(from))
    deferCancel(to);
  if (isAbortable(from))
    abortable(to);
  return to;
}
function elementCodec(element, o) {
  return {
    element,
    where: o.where,
    toHost: (v) => element === null ? undefined : toHost(v, element, o),
    fromHost: (v) => element === null ? null : fromHost(v, element, o)
  };
}
async function resolveArtifacts(src) {
  if ("plan" in src)
    return src;
  const translator2 = src.translator instanceof Translator ? src.translator : await Translator.create(src.translator);
  const { plan, adapters } = translator2.translate(src.componentBytes);
  return { plan, componentBytes: src.componentBytes, adapters };
}
async function instantiate(source, imports = {}, opts = {}) {
  const artifacts = await resolveArtifacts(source);
  const facade = new Facade(artifacts, imports);
  const handle = await instantiateComponent({
    plan: artifacts.plan,
    componentBytes: artifacts.componentBytes,
    adapters: artifacts.adapters,
    imports: facade.rawImports,
    jspi: opts.jspi,
    verifyHash: opts.verifyHash,
    loadedPlan: facade.loaded
  });
  facade.bind(handle);
  const instance = {
    exports: facade.buildExports(handle),
    handle,
    imports: facade.leaves
  };
  Object.defineProperty(instance, INTERNAL_HOST_REGISTRIES, {
    value: facade.hostRegistries,
    enumerable: false
  });
  return instance;
}
var INTERNAL_HOST_REGISTRIES = Symbol("polyengine.embedder.hostRegistries");

class Facade {
  artifacts;
  leaves;
  rawImports = {};
  #resolver;
  #bindings = new Map;
  #tokenIndex = new Map;
  loaded;
  #bridge;
  #lowerScope = null;
  hostRegistries = new Map;
  #exportsBuilt = false;
  constructor(artifacts, providers) {
    this.artifacts = artifacts;
    this.#resolver = new ImportResolver(providers);
    this.loaded = loadPlan(artifacts.plan);
    artifacts.plan.resourceTables.forEach((table, i) => {
      if (table.kind !== "concrete")
        return;
      const token = this.loaded.resourceTokens[i];
      if (token !== undefined)
        this.#tokenIndex.set(token, table.resource);
    });
    this.leaves = requiredImports(this.loaded);
    const resourceLeaves = this.leaves.filter((l) => l.kind === "resource");
    if (resourceLeaves.length > 0 && (artifacts.plan.importedResources ?? []).length === 0) {
      throw new PlanError(`this component imports the resource type(s) ` + `${resourceLeaves.map((l) => `'${l.leaf}'`).join(", ")}, but the ` + `plan carries no \`importedResources\` table, so they cannot be ` + `bound to a ResourceIndex (contracts/plan-format.md v0.2). ` + `Re-translate with a shim that emits it.`);
    }
    this.#bridge = this.#makeBridge();
    this.#buildRawImports();
    this.#bindHostResources();
  }
  bind(handle) {
    if (handle.loadedPlan !== this.loaded) {
      throw new PlanError("the executor instantiated from a different LoadedPlan than the " + "facade built its import wrappers from; resource identity tokens " + "would not match");
    }
  }
  #indexOf(rt) {
    const i = this.#tokenIndex.get(rt);
    if (i === undefined) {
      throw new PlanError("resource type is not bound to any resource table in this plan");
    }
    return i;
  }
  #binding(rt) {
    const index = this.#indexOf(rt);
    let b = this.#bindings.get(index);
    if (b === undefined) {
      if (!this.#exportsBuilt) {
        throw new PlanError(`a guest-implemented resource (ResourceIndex ${index}) crossed the ` + `boundary before instantiation finished — a guest \`start\` ` + `function passed an own/borrow handle to a host import. Its class ` + `is assembled from the component's own lifted exports, which do ` + `not exist yet. Host-implemented resources are unaffected. If a ` + `real component needs this, the class must be built lazily from ` + `the plan's export table instead of the runtime's export surface.`);
      }
      b = { kind: "guest", name: `resource-${index}` };
      this.#bindings.set(index, b);
    }
    return b;
  }
  #guestClass(b) {
    b.cls ??= buildGuestResourceClass({ name: b.name, ctor: null, ctorParams: null, methods: [], statics: [] }, { impl: null, dtor: null }, () => () => Promise.reject(new TypeError("no methods")), () => []);
    return b.cls;
  }
  #bindHostResources() {
    const importedResources = this.artifacts.plan.importedResources ?? [];
    for (const p of this.#pendingHostResources) {
      const at = importedResources.findIndex((ir) => ir.import === p.importIndex);
      if (at < 0)
        continue;
      this.#bindings.set(at, {
        kind: "host",
        name: this.leaves[p.importIndex].leaf,
        registry: p.registry,
        cls: p.cls
      });
      this.hostRegistries.set(at, p.registry);
    }
  }
  #makeBridge() {
    const self = this;
    return {
      liftOwn(rep, t) {
        const b = self.#binding(t.rt);
        if (b.kind === "host")
          return b.registry.release(rep);
        return makeWrapper(self.#guestClass(b), rep, t.rt, true);
      },
      liftBorrow(rep, t, scope) {
        const b = self.#binding(t.rt);
        if (b.kind === "host")
          return b.registry.lookup(rep);
        const w = makeWrapper(self.#guestClass(b), rep, t.rt, false);
        scope.add(() => invalidateWrapper(w));
        return w;
      },
      lowerOwn(v, t) {
        const b = self.#binding(t.rt);
        if (b.kind === "host")
          return b.registry.repFor(v);
        return takeRep(v, true, `own<${b.name}>`);
      },
      lowerBorrow(v, t) {
        const b = self.#binding(t.rt);
        if (b.kind === "host") {
          const known = b.registry.hasInstance(v);
          const rep2 = b.registry.repFor(v);
          if (!known) {
            self.#lowerScope?.push(() => b.registry.releaseIfPresent(rep2));
          }
          return rep2;
        }
        const rep = takeRep(v, false, `borrow<${b.name}>`);
        const release = lendWrapper(v);
        if (self.#lowerScope === null) {
          release();
        } else {
          self.#lowerScope.push(release);
        }
        return rep;
      },
      dropOwn(rep, t) {
        const b = self.#binding(t.rt);
        if (b.kind === "host") {
          b.registry.dtor(rep);
          return;
        }
        hostDtorCall(t.rt, rep);
      }
    };
  }
  #opts(where) {
    return { bridge: this.#bridge, where };
  }
  #funcType(index, what) {
    const loaded = this.loaded;
    if (index === undefined)
      throw new PlanError(`${what}: no type index`);
    const t = loaded.types[index];
    if (t === undefined || t.kind !== "func") {
      throw new PlanError(`${what}: type ${index} is not a function type`);
    }
    return t.funcType;
  }
  #buildRawImports() {
    this.leaves.forEach((leaf, importIndex) => {
      const provider = this.#provider(leaf);
      const target = leaf.path.length === 0 ? null : nest(this.rawImports, leaf.interfaceId, leaf.path.slice(0, -1));
      const value = this.#wrapLeaf(leaf, importIndex, provider);
      if (target === null)
        this.rawImports[leaf.interfaceId] = value;
      else
        target[leaf.path[leaf.path.length - 1]] = value;
    });
  }
  #provider(leaf) {
    if (leaf.path.length === 0 && leaf.member.form !== "plain") {
      const r = leaf.member.resource;
      const hit2 = this.#resolver.resolve(r) ?? this.#resolver.resolve(camelCase(r));
      if (hit2 === undefined) {
        throw new PlanError(`host import '${label(leaf)}' not provided: the component ` + `imports the world-level resource '${r}'; provide its class ` + `under the key '${camelCase(r)}' (registered: ` + `${this.#resolver.keys().join(", ") || "<none>"})`);
      }
      return hit2.value;
    }
    const hit = this.#resolver.resolve(leaf.interfaceId) ?? (leaf.path.length === 0 ? this.#resolver.resolve(camelCase(leaf.interfaceId)) : undefined);
    if (hit === undefined) {
      throw new PlanError(`host import '${label(leaf)}' not provided (no key ` + `'${leaf.interfaceId}' in imports; registered: ` + `${this.#resolver.keys().join(", ") || "<none>"})`);
    }
    let value = hit.value;
    for (const seg of leaf.path.slice(0, -1)) {
      if (value === null || typeof value !== "object") {
        throw new PlanError(`host import '${label(leaf)}': '${seg}' is not reachable ` + `(${describe2(value)})`);
      }
      value = value[seg];
    }
    return value;
  }
  #wrapLeaf(leaf, importIndex, provider) {
    if (leaf.kind === "resource") {
      return this.#wrapResourceType(leaf, importIndex, provider);
    }
    if (leaf.kind !== "func") {
      throw new PlanError(`host import '${label(leaf)}': unsupported import kind '${leaf.kind}'`);
    }
    const dispatch = this.#dispatcher(leaf, provider);
    let impl = null;
    const wrapper = (...raw) => {
      if (impl === null) {
        const ft = this.#funcType(this.artifacts.plan.imports[importIndex].type, `import '${label(leaf)}'`);
        impl = this.#wrapImportFn(leaf, ft, dispatch);
      }
      return impl(...raw);
    };
    return relayMarks(dispatch, wrapper);
  }
  #wrapResourceType(leaf, importIndex, provider) {
    const cls = leaf.path.length === 0 ? provider : pick(provider, [], [pascalCase(leaf.leaf), leaf.leaf]);
    if (cls === undefined) {
      throw new PlanError(`host import '${label(leaf)}': the component imports the resource ` + `type '${leaf.leaf}'; provide the implementing class as ` + `'${pascalCase(leaf.leaf)}'`);
    }
    const registry = new HostResourceRegistry(pascalCase(leaf.leaf));
    this.#pendingHostResources.push({ importIndex, registry, cls });
    return hostResourceType({
      name: leaf.leaf,
      dtor: (rep) => registry.dtor(rep)
    });
  }
  #pendingHostResources = [];
  #dispatcher(leaf, provider) {
    const m = leaf.member;
    if (m.form === "plain") {
      const fn = leaf.path.length === 0 ? provider : pick(provider, [], [camelCase(m.name), m.name]);
      if (typeof fn !== "function") {
        throw new PlanError(`host import '${label(leaf)}' missing or not a function (got ` + `${describe2(fn)}); expected '${camelCase(m.name)}'`);
      }
      const receiver = leaf.path.length === 0 ? undefined : provider;
      const dispatch = (args) => fn.apply(receiver, args);
      return relayMarks(fn, dispatch);
    }
    const clsName = pascalCase(m.resource);
    const cls = leaf.path.length === 0 ? provider : pick(provider, [], [clsName, m.resource]);
    if (cls === undefined) {
      throw new PlanError(`host import '${label(leaf)}': no class '${clsName}' provided`);
    }
    switch (m.form) {
      case "constructor":
        return (args) => new cls(...args);
      case "method": {
        const protoFn = dataMember(cls?.prototype, camelCase(m.member));
        const dispatch = (args) => {
          const [self, ...rest] = args;
          const fn = self?.[camelCase(m.member)];
          if (typeof fn !== "function") {
            throw new Trap(`host import '${label(leaf)}': the ${clsName} instance has no ` + `method '${camelCase(m.member)}'`);
          }
          return fn.apply(self, rest);
        };
        return relayMarks(protoFn, dispatch);
      }
      case "static": {
        const fn = cls[camelCase(m.member)];
        if (typeof fn !== "function") {
          throw new PlanError(`host import '${label(leaf)}': ${clsName} has no static ` + `'${camelCase(m.member)}'`);
        }
        const dispatch = (args) => fn.apply(cls, args);
        return relayMarks(fn, dispatch);
      }
    }
  }
  #wrapImportFn(leaf, ft, dispatch) {
    const where = `import '${label(leaf)}'`;
    const o = this.#opts(where);
    const resultType = ft.results.length === 0 ? null : ft.results[0];
    const isResult = resultType !== null && resultType.kind === "result";
    const ok = (v) => {
      if (resultType === null)
        return;
      if (isResult) {
        const rt = resultType;
        return {
          kind: "ok",
          value: rt.ok === null ? null : fromHost(v, rt.ok, o)
        };
      }
      return fromHost(v, resultType, o);
    };
    const fail = (e, args) => {
      if (isComponentException(e) && isResult) {
        const rt = resultType;
        return {
          kind: "error",
          value: rt.error === null ? null : fromHost(e.payload, rt.error, o)
        };
      }
      releaseAsyncArgs(args);
      if (isTrap(e))
        throw e;
      if (isComponentException(e)) {
        throw new Trap(`${where} threw a ComponentException, but its WIT type has no err side; ` + `only a fallible import may signal an error value`);
      }
      const census = copyCensus();
      throw new Trap(`${where} threw ${describeThrow(e)}. An unbranded throw from a host ` + `import is a host bug and becomes a trap: signal a WIT error with ` + `\`throw new ComponentException(payload)\`.` + (census === "" ? "" : ` (${census} — an error carrying no polyengine brand in a ` + `multi-copy graph usually means a pre-module identity runtime copy threw ` + `it, issue #83.)`));
    };
    return (...raw) => {
      const scope = new BorrowScope;
      const args = ft.params.map((p, i) => toHost(raw[i], p, o, scope));
      for (let i = ft.params.length;i < raw.length; i++)
        args.push(raw[i]);
      let out;
      try {
        out = dispatch(args);
      } catch (e) {
        scope.end();
        return fail(e, args);
      }
      if (isThenable2(out)) {
        if (resultType !== null && resultType.kind === "future") {
          scope.end();
          return ok(out);
        }
        return out.then((v) => {
          scope.end();
          return ok(v);
        }, (e) => {
          scope.end();
          return fail(e, args);
        });
      }
      scope.end();
      return ok(out);
    };
  }
  buildExports(handle) {
    this.#exportsBuilt = true;
    const out = {};
    const worldLeaves = [];
    for (const exp of this.artifacts.plan.exports) {
      if (exp.kind === "instance") {
        out[exp.name] = this.#buildInterface(exp.name, exp.exports, handle.exports[exp.name]);
      } else {
        worldLeaves.push(exp);
      }
    }
    if (worldLeaves.length > 0) {
      Object.assign(out, this.#buildInterface("", worldLeaves, handle.exports));
    }
    return out;
  }
  #buildInterface(id, exps, raw) {
    const obj = {};
    const claimed = new Map;
    const claim = (js, leaf) => {
      const held = claimed.get(js);
      if (held !== undefined) {
        throw new NameCollisionError(`export '${id || "<world>"}': the leaves '${held}' and '${leaf}' ` + `both map to the JS name '${js}'. Rename one in the WIT; the ` + `conventions layer will not guess which one wins.`);
      }
      claimed.set(js, leaf);
      return js;
    };
    const specs = new Map;
    const specRt = new Map;
    const spec = (name) => {
      let s = specs.get(name);
      if (s === undefined) {
        s = { name, ctor: null, ctorParams: null, methods: [], statics: [] };
        specs.set(name, s);
      }
      return s;
    };
    for (const exp of exps) {
      if (exp.kind === "type") {
        if (exp.type.kind === "resource") {
          const token = this.loaded.resourceTokens[exp.type.resource];
          if (token !== undefined && this.#tokenIndex.has(token)) {
            const index = this.#tokenIndex.get(token);
            const held = this.#bindings.get(index);
            if (held === undefined) {
              this.#bindings.set(index, { kind: "guest", name: exp.name });
            } else if (held.kind === "guest") {
              held.name = exp.name;
            }
          }
        }
        continue;
      }
      if (exp.kind === "module") {
        continue;
      }
      if (exp.kind === "instance") {
        throw new PlanError(`export '${id || "<world>"}/${exp.name}': nested instance exports ` + `are not surfaced by the conventions layer (only one level of ` + `interface nesting exists in plan v2)`);
      }
      if (exp.kind !== "lifted-func") {
        throw new PlanError(`export '${id || "<world>"}/${exp.name}': ` + `unsupported export kind ` + `'${exp.kind}'`);
      }
      const fn = raw[exp.name];
      if (typeof fn !== "function") {
        throw new PlanError(`export '${id || "<world>"}/${exp.name}': the runtime produced no ` + `callable for this lifted function`);
      }
      const ft = this.#funcType(exp.type, `export '${id}/${exp.name}'`);
      const member = parseLeafName(exp.name);
      const where = id === "" ? exp.name : `${id}#${exp.name}`;
      switch (member.form) {
        case "plain":
          obj[claim(camelCase(member.name), member.name)] = this.#wrapExportFn(fn, ft, where);
          break;
        case "constructor": {
          const s = spec(member.resource);
          s.ctor = fn[SYNC_ENTRY] ?? fn;
          s.ctorParams = ft.params;
          rtOf(ft.results[0], specRt, member.resource);
          break;
        }
        case "method": {
          spec(member.resource).methods.push({
            member: member.member,
            raw: fn,
            params: ft.params,
            results: ft.results,
            async: ft.async === true
          });
          rtOf(ft.params[0], specRt, member.resource);
          break;
        }
        case "static": {
          spec(member.resource).statics.push({
            member: member.member,
            raw: fn,
            params: ft.params,
            results: ft.results,
            async: ft.async === true
          });
          break;
        }
      }
    }
    for (const [name, s] of specs) {
      const rt = specRt.get(name);
      if (rt === undefined) {
        throw new PlanError(`export '${id}': resource '${name}' has leaves but no own/borrow ` + `type to identify it by`);
      }
      const cls = buildGuestResourceClass(s, rt, (raw2, params, results, async, where) => this.#wrapExportFn(raw2, { params, results, async }, where), (args, params, where) => args.map((a, i) => fromHost(a, params[i], this.#opts(where))));
      obj[claim(pascalCase(name), name)] = cls;
      const index = this.#tokenIndex.get(rt);
      if (index !== undefined) {
        this.#bindings.set(index, { kind: "guest", name, cls });
      }
    }
    return obj;
  }
  #lowerParams(params, args, o) {
    const scope = [];
    const outer = this.#lowerScope;
    this.#lowerScope = scope;
    let lowered;
    try {
      lowered = params.map((p, i) => fromHost(args[i], p, o));
    } catch (e) {
      for (const r of scope)
        r();
      throw e;
    } finally {
      this.#lowerScope = outer;
    }
    let released = false;
    return {
      lowered,
      release: () => {
        if (released)
          return;
        released = true;
        for (const r of scope)
          r();
      }
    };
  }
  #wrapExportFn(fn, ft, where) {
    const o = this.#opts(where);
    const resultType = ft.results.length === 0 ? null : ft.results[0];
    let wrapper;
    if (resultType !== null && resultType.kind === "future") {
      const element = resultType.element;
      wrapper = (...args) => {
        if (args.length !== ft.params.length) {
          throw new TypeError(`${where}: expected ${ft.params.length} argument(s), got ` + `${args.length}`);
        }
        const { lowered, release } = this.#lowerParams(ft.params, args, o);
        let pending;
        try {
          pending = Promise.resolve(fn(...lowered));
        } catch (e) {
          release();
          throw e;
        }
        pending.then(release, release);
        return Future.deferred(pending, elementCodec(element, o));
      };
    } else {
      wrapper = async (...args) => {
        if (args.length !== ft.params.length) {
          throw new TypeError(`${where}: expected ${ft.params.length} argument(s), got ${args.length}`);
        }
        const { lowered, release } = this.#lowerParams(ft.params, args, o);
        let raw;
        try {
          raw = await fn(...lowered);
        } finally {
          release();
        }
        if (resultType === null)
          return;
        if (resultType.kind === "result") {
          const v = raw;
          if (v.kind === "error") {
            throw new ComponentException(resultType.error === null ? undefined : toHost(v.value, resultType.error, o));
          }
          return resultType.ok === null ? undefined : toHost(v.value, resultType.ok, o);
        }
        return toHost(raw, resultType, o);
      };
    }
    if (ft.async === true) {
      markSyncCallable(wrapper, { kind: "async" });
    } else {
      markSyncCallable(wrapper, {
        kind: "free",
        fn: this.#buildSyncForm(fn, ft, where, o)
      });
    }
    return wrapper;
  }
  #buildSyncForm(fn, ft, where, o) {
    const resultType = ft.results.length === 0 ? null : ft.results[0];
    const entry = fn[SYNC_ENTRY] ?? fn;
    const unreachableThenable = (raw) => {
      throw new Error(`${where}: the sync entry returned a thenable, which should be ` + `unreachable for a sync-typed WIT export (a genuine park surfaces ` + `as a trap, NeedsJspi, or SyncEntryBusy instead) — this indicates ` + `a runtime defect`);
    };
    if (resultType !== null && resultType.kind === "future") {
      const element = resultType.element;
      return (...args) => {
        if (args.length !== ft.params.length) {
          throw new TypeError(`${where}: expected ${ft.params.length} argument(s), got ` + `${args.length}`);
        }
        const { lowered, release } = this.#lowerParams(ft.params, args, o);
        let raw;
        try {
          raw = entry(...lowered);
        } finally {
          release();
        }
        if (isThenable2(raw))
          unreachableThenable(raw);
        return Future.fromLifted(raw, elementCodec(element, o));
      };
    }
    return (...args) => {
      if (args.length !== ft.params.length) {
        throw new TypeError(`${where}: expected ${ft.params.length} argument(s), got ${args.length}`);
      }
      const { lowered, release } = this.#lowerParams(ft.params, args, o);
      let raw;
      try {
        raw = entry(...lowered);
      } finally {
        release();
      }
      if (isThenable2(raw))
        unreachableThenable(raw);
      if (resultType === null)
        return;
      if (resultType.kind === "result") {
        const v = raw;
        if (v.kind === "error") {
          throw new ComponentException(resultType.error === null ? undefined : toHost(v.value, resultType.error, o));
        }
        return resultType.ok === null ? undefined : toHost(v.value, resultType.ok, o);
      }
      return toHost(raw, resultType, o);
    };
  }
}
function rtOf(t, into, name) {
  if (t === undefined)
    return;
  if (t.kind === "own" || t.kind === "borrow")
    into.set(name, t.rt);
}
function label(leaf) {
  return leaf.path.length === 0 ? leaf.interfaceId : `${leaf.interfaceId}/${leaf.path.join("/")}`;
}
function nest(root, key, path) {
  let cur = root[key] ??= {};
  for (const seg of path) {
    cur = cur[seg] ??= {};
  }
  return cur;
}
function pick(container, path, names) {
  let v = container;
  for (const seg of path) {
    if (v === null || typeof v !== "object")
      return;
    v = v[seg];
  }
  if (v === null || typeof v !== "object") {
    return names.length === 0 ? v : undefined;
  }
  for (const n of names) {
    const hit = v[n];
    if (hit !== undefined)
      return hit;
  }
  return;
}
function dataMember(obj, key) {
  for (let o = obj;o !== null && (typeof o === "object" || typeof o === "function"); o = Object.getPrototypeOf(o)) {
    const d = Object.getOwnPropertyDescriptor(o, key);
    if (d !== undefined)
      return "value" in d ? d.value : undefined;
  }
  return;
}
function isThenable2(v) {
  return v !== null && typeof v === "object" && "then" in v && typeof v.then === "function";
}
function releaseAsyncArgs(args) {
  for (const a of args) {
    if (a instanceof Stream || a instanceof Future) {
      try {
        a.dropForTeardown();
      } catch {}
    }
  }
}
function describeThrow(e) {
  if (e instanceof Error)
    return `${e.name}: ${e.message}`;
  return describe2(e);
}
// ../../../../../Users/ijhar/.bun/install/cache/@polyengine/runtime@0.6.7@@@1/esm/embedder/mod.js
registerRuntimeCopy({
  url: COPY_URL,
  runtimeVersion: RUNTIME_VERSION,
  protocolGeneration: PROTOCOL_GENERATION
});

// browser.ts
var WORLD = "sha256:9d978bf670230e8d972ba5c359a5be6227b9b313c037e298318422eeadc72e0c";
var DOC = "loop:document-tool/documents@0.1.0";
var WASI = new Set(["wasi:io/poll@0.2.9", "wasi:io/error@0.2.9", "wasi:io/streams@0.2.9", "wasi:cli/terminal-input@0.2.9", "wasi:cli/terminal-output@0.2.9", "wasi:cli/exit@0.2.9", "wasi:cli/stdin@0.2.9", "wasi:cli/stdout@0.2.9", "wasi:cli/stderr@0.2.9", "wasi:clocks/monotonic-clock@0.2.9", "wasi:cli/environment@0.2.9", "wasi:cli/terminal-stdin@0.2.9", "wasi:cli/terminal-stdout@0.2.9", "wasi:cli/terminal-stderr@0.2.9"]);
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var assert = (ok, message) => {
  if (!ok)
    throw Error(message);
};
var error = (kind, value) => new ComponentException(value === undefined ? { kind } : { kind, value });
var live = 0;
var pending = 0;
var documentCounts = () => ({ live, pending });

class Document {
  #policy;
  constructor(policy) {
    this.#policy = policy;
    live++;
  }
  check(write = false) {
    const p = this.#policy;
    if (p.closed || p.revoked)
      throw error("revoked");
    if (p.cancelled)
      throw error("cancelled");
    if (p.principal !== "fixture-author" || write && !p.write)
      throw error("denied");
    return p;
  }
  async read() {
    const p = this.#policy;
    p.events.push("read-enter");
    pending++;
    await sleep(35);
    pending--;
    p.events.push("read-resume");
    this.check();
    return { revision: String(p.revision), source: p.source };
  }
  async write(expectedRevision, source) {
    const p = this.#policy;
    p.events.push("write-enter");
    pending++;
    await sleep(35);
    pending--;
    p.events.push("write-resume");
    this.check(true);
    if (new TextEncoder().encode(source).length > 65536)
      throw error("invalid-source", "64KiB limit");
    if (String(p.revision) !== expectedRevision)
      throw error("conflict", { revision: String(p.revision), source: p.source });
    p.revision++;
    p.source = source;
    p.events.push("commit");
    return { revision: String(p.revision), source };
  }
  [Symbol.dispose]() {
    if (!this.#policy.closed) {
      this.#policy.closed = true;
      live--;
    }
  }
}
var policy = (write = true) => ({ revision: 0, source: "hello world", principal: "fixture-author", write, revoked: false, cancelled: false, closed: false, events: [] });
function providers(leaves) {
  const imports = { [DOC]: { Document } };
  const denied = [];
  for (const leaf of leaves) {
    if (leaf.interfaceId === DOC)
      continue;
    if (!WASI.has(leaf.interfaceId))
      throw Error("profile denied " + leaf.interfaceId);
    const iface = imports[leaf.interfaceId] ??= {};
    const deny = () => {
      denied.push(leaf.interfaceId + "." + leaf.leaf);
      throw Error("unused runtime import denied");
    };
    if (leaf.kind === "resource")
      iface[leaf.jsName] = class {
      };
    else if (leaf.jsClass) {
      const cls = iface[leaf.jsClass] ??= class {
      };
      cls.prototype[leaf.jsName] = deny;
    } else
      iface[leaf.jsName] = deny;
  }
  return { imports, denied };
}
var decode = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
window.bootProbe = async (input) => {
  const started = performance.now();
  const bytes = decode(input.component), translatorBytes = decode(input.translator);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (v) => v.toString(16).padStart(2, "0")).join("");
  assert(hash === input.sha256, "source artifact bytes mismatch");
  const translator2 = await Translator.create(translatorBytes), translated = translator2.translate(bytes);
  assert(translated.plan.worldDigest === WORLD, "world profile mismatch");
  const leaves = requiredImports(translated.plan), p = providers(leaves);
  const make = () => instantiate({ plan: translated.plan, adapters: translated.adapters, componentBytes: bytes }, p.imports);
  const instantiateStart = performance.now(), instance = await make();
  const receipt = { browser: navigator.userAgent, componentSha256: hash, worldDigest: translated.plan.worldDigest, jspi: { Suspending: typeof WebAssembly.Suspending, promising: typeof WebAssembly.promising }, setupMs: performance.now() - started, instantiateMs: performance.now() - instantiateStart, tests: [], deniedRuntimeCalls: p.denied };
  const result = async (fn) => {
    try {
      return { ok: await fn() };
    } catch (e) {
      return { error: e.payload ?? { message: String(e), stack: e.stack } };
    }
  };
  const close = (d) => d[Symbol.dispose]();
  window.receipt = receipt;
  document.querySelector("#run").addEventListener("click", async () => {
    try {
      const grant = policy(), d = new Document(grant), value = document.querySelector("#replacement").value;
      let settled = false;
      const t = performance.now();
      const call = instance.exports.replaceText(d, "hello", value).finally(() => settled = true);
      await sleep(15);
      assert(!settled, "guest did not genuinely suspend");
      assert(grant.events[0] === "read-enter", "guest did not enter actual read import");
      const output = await call;
      assert(output === `${input.expectedPrefix ?? ""}revision=1;source=${value} world`, "fresh guest result mismatch");
      assert(performance.now() - t >= 60, "missing delayed read/write");
      receipt.tests.push({ name: "real-browser-input-granted-async", output, callMs: performance.now() - t, events: [...grant.events] });
      document.querySelector("#output").textContent = output;
      grant.revoked = true;
      const revoked = await result(() => instance.exports.replaceText(d, "world", "forbidden"));
      assert(revoked.error?.kind === "revoked" && grant.revision === 1, "revoked mutation");
      receipt.tests.push({ name: "retained-resource-revoked", ...revoked });
      close(d);
      const viewer = policy(false), vd = new Document(viewer);
      const denied = await result(() => instance.exports.replaceText(vd, "hello", "viewer"));
      assert(denied.error?.kind === "denied" && viewer.revision === 0, "viewer mutation");
      receipt.tests.push({ name: "viewer-denied", ...denied });
      close(vd);
      const wrong = policy();
      wrong.principal = "other";
      const wd = new Document(wrong);
      const deniedPrincipal = await result(() => instance.exports.replaceText(wd, "hello", "wrong"));
      assert(deniedPrincipal.error?.kind === "denied" && wrong.revision === 0, "wrong principal mutation");
      receipt.tests.push({ name: "wrong-principal-denied", ...deniedPrincipal });
      close(wd);
      const forgedInstance = await make(), forged = await result(() => forgedInstance.exports.replaceText(Object.create(Document.prototype), "hello", "forged"));
      assert(!!forged.error, "forged resource succeeded");
      receipt.tests.push({ name: "forged-resource-trap", ...forged });
      const race = policy(), rd = new Document(race), other = await make();
      const drafts = ["A", "B"];
      const wins = await Promise.all([result(() => instance.exports.replaceText(rd, "hello", drafts[0])), result(() => other.exports.replaceText(rd, "hello", drafts[1]))]);
      assert(wins.filter((x) => x.ok).length === 1 && wins.filter((x) => x.error?.kind === "conflict").length === 1 && race.revision === 1, "CAS not one winner");
      receipt.tests.push({ name: "two-instance-cas-race", results: wins, draftsUnchanged: drafts, events: [...race.events] });
      close(rd);
      for (const [phase, delay, cancel] of [["before-read", 10, false], ["during-write", 50, false], ["cancel-before-commit", 50, true], ["after-commit", 100, false]]) {
        const state = policy(), d2 = new Document(state);
        const call2 = result(() => instance.exports.replaceText(d2, "hello", "race"));
        const timer = sleep(delay).then(() => {
          if (cancel)
            state.cancelled = true;
          else
            state.revoked = true;
        });
        const [out] = await Promise.all([call2, timer]);
        if (delay < 70) {
          assert(out.error?.kind === (cancel ? "cancelled" : "revoked") && state.revision === 0, "cancel/revoke committed");
        } else {
          assert(!!out.ok && state.revision === 1, "committed outcome lost");
        }
        receipt.tests.push({ name: phase, ...out, revision: state.revision, events: [...state.events] });
        close(d2);
      }
      assert(live === 0 && pending === 0, "resource/task leak");
      assert(p.denied.length === 0, "unexpected WASI runtime call");
      receipt.cleanup = { liveHostDocuments: live, pendingHostCalls: pending, borrowedOnly: true, guestOwnedDrop: "not exercised", instanceDispose: "no public disposal API; isolated browser process closed by supervisor" };
      receipt.done = true;
    } catch (e) {
      receipt.failure = { message: String(e), stack: e.stack };
      receipt.done = true;
    }
  });
  return { componentSha256: hash, worldDigest: receipt.worldDigest, ready: true };
};
export {
  providers,
  policy,
  documentCounts,
  Document
};
