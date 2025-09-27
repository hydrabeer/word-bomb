// @ts-check
// Clean Architecture analyzer for depcruise output with package-name awareness.
// Usage: node scripts/arch-clean.mjs [audit/<timestamp>]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Return newest audit/* dir or null */
function newestAuditDir() {
  const base = path.join(__dirname, '..', 'audit');
  if (!fs.existsSync(base)) return null;
  const entries = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const last = entries.length ? entries[entries.length - 1] : null;
  return last ? path.join(base, last) : null;
}

const AUDIT_DIR = process.argv[2] || newestAuditDir();
if (!AUDIT_DIR) {
  console.error(
    'No audit/* directory found. Run scripts/gen-dep-audit.zsh first or pass a path.',
  );
  process.exit(1);
}

const IN = path.join(AUDIT_DIR, 'depcruise-graph.json');
if (!fs.existsSync(IN)) {
  console.error(`Missing ${IN} (run the audit script first)`);
  process.exit(1);
}

/** Component config (by path prefix) */
const COMPONENTS = [
  { key: 'frontend', prefix: 'apps/frontend/' },
  { key: 'backend', prefix: 'apps/backend/' },
  { key: 'domain', prefix: 'packages/domain/' },
  { key: 'types', prefix: 'packages/types/' },
];

/** Layers and allowed layer-to-layer flows (policy) */
const LAYERS = [
  { name: 'UI', comps: ['frontend'] },
  { name: 'API', comps: ['backend'] },
  { name: 'Application', comps: ['backend'] },
  { name: 'Domain', comps: ['domain', 'types'] },
];
const POLICY = /** @type {Array<[string,string]>} */ ([
  ['UI', 'API'],
  ['UI', 'Types'],
  ['API', 'Application'],
  ['Application', 'Domain'],
  ['API', 'Domain'],
  ['Domain', 'Types'],
  // ['UI','Domain'], // enable if you want UI→Domain
]);

/** Normalize to repo-relative posix path: "apps/.../file.ts"
 * @param {string} p
 */
function normalizeRepoPath(p) {
  if (!p) return '';
  let s = String(p).replace(/\\/g, '/'); // win → posix
  // strip leading cwd if present
  const repoRootMarker = /(\/(?:apps|packages)\/.*)$/;
  const m = s.match(repoRootMarker);
  if (m) s = m[1].replace(/^\//, '');
  // also drop any leading slash
  return s.replace(/^\//, '');
}

/** Build a map of workspace package names → component keys */
function buildPkgNameMap() {
  /** @type {Record<string,string>} */
  const nameToComp = {};
  const root = path.join(__dirname, '..');

  const pairs =
    /** @type {Array<{dir: string, compByDir: Record<string,string>}>} */ ([
      {
        dir: path.join(root, 'packages'),
        compByDir: { domain: 'domain', types: 'types' },
      },
      {
        dir: path.join(root, 'apps'),
        compByDir: { backend: 'backend', frontend: 'frontend' },
      }, // usually not needed
    ]);

  for (const { dir, compByDir } of pairs) {
    if (!fs.existsSync(dir)) continue;
    for (const sub of fs.readdirSync(dir)) {
      const pkgPath = path.join(dir, sub, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const name = typeof pkg.name === 'string' ? pkg.name : '';
        const comp = compByDir[sub] || null;
        if (name && comp) nameToComp[name] = comp;
      } catch {}
    }
  }
  return nameToComp;
}

const nameToComp = buildPkgNameMap();

/**
 * @param {string} p
 */
function compFromPath(p) {
  const rel = normalizeRepoPath(p);
  for (const c of COMPONENTS) if (rel.startsWith(c.prefix)) return c.key;
  return null;
}

/** Try to infer a package name from a dep target
 * @param {string} target
 * @returns {string | null}
 */
function inferPackageName(target) {
  const s = String(target).replace(/\\/g, '/');
  // 1) raw import like "@word-bomb/types/foo"
  const m1 = s.match(/^@?[^/]+\/[^/]+/); // scope + name OR name/name
  if (m1 && nameToComp[m1[0]]) return m1[0];

  // 2) node_modules path ".../node_modules/@scope/name/..."
  const m2 = s.match(/node_modules\/(@?[^/]+\/[^/]+)/);
  if (m2 && nameToComp[m2[1]]) return m2[1];

  return null;
}

const depcruise = JSON.parse(fs.readFileSync(IN, 'utf8'));
/** @type {Array<any>} */
const modules = Array.isArray(depcruise.modules) ? depcruise.modules : [];

const layerOfComp = new Map();
for (const layer of LAYERS)
  for (const c of layer.comps) layerOfComp.set(c, layer.name);
const policySet = new Set(POLICY.map(([a, b]) => `${a}->${b}`));

/** @type {Map<string, number>} */
const edges = new Map();
/** @type {Map<string, Set<string>>} */
const incoming = new Map(),
  outgoing = new Map();
/** @type {Set<string>} */
const allComps = new Set(COMPONENTS.map((c) => c.key));

for (const m of modules) {
  const fromPath = normalizeRepoPath(m.source ?? m.name ?? '');
  const inferredPkg = inferPackageName(fromPath);
  const fromComp =
    compFromPath(fromPath) || (inferredPkg ? nameToComp[inferredPkg] : null);
  if (!fromComp) continue;

  const deps = Array.isArray(m.dependencies) ? m.dependencies : [];
  for (const d of deps) {
    const tgt = d.resolved ?? d.to ?? d.module ?? '';
    const toPathComp = compFromPath(String(tgt));
    const toPkgName = inferPackageName(String(tgt));
    const toComp = toPathComp || (toPkgName ? nameToComp[toPkgName] : null);
    if (!toComp || toComp === fromComp) continue;

    const k = `${fromComp}->${toComp}`;
    edges.set(k, (edges.get(k) ?? 0) + 1);

    if (!outgoing.has(fromComp)) outgoing.set(fromComp, new Set());
    if (!incoming.has(toComp)) incoming.set(toComp, new Set());
    const outSet = outgoing.get(fromComp);
    const inSet = incoming.get(toComp);
    // Non-null after the guards above
    outSet && outSet.add(toComp);
    inSet && inSet.add(fromComp);
    allComps.add(fromComp);
    allComps.add(toComp);
  }
}

// Metrics
const metrics = [];
for (const comp of Array.from(allComps).sort()) {
  const Ce = outgoing.get(comp)?.size ?? 0;
  const Ca = incoming.get(comp)?.size ?? 0;
  const I = Ca + Ce === 0 ? 0 : Number((Ce / (Ca + Ce)).toFixed(3));
  metrics.push({ comp, Ca, Ce, I });
}

// Violations
const violations = [];
for (const [k, count] of edges.entries()) {
  const [a, b] = /** @type {[string,string]} */ (k.split('->'));
  const ok = policySet.has(
    `${layerOfComp.get(a) ?? 'Unmapped'}->${layerOfComp.get(b) ?? 'Unmapped'}`,
  );
  if (!ok)
    violations.push({
      fromComp: a,
      toComp: b,
      fromLayer: layerOfComp.get(a) ?? 'Unmapped',
      toLayer: layerOfComp.get(b) ?? 'Unmapped',
      count,
    });
}

// Emit
const OUT_DOT = path.join(AUDIT_DIR, 'arch-graph.dot');
const OUT_MET = path.join(AUDIT_DIR, 'arch-metrics.tsv');
const OUT_VIO = path.join(AUDIT_DIR, 'arch-violations.tsv');

let dot = `digraph G {
  rankdir=LR;
  graph [compound=true, fontsize=11, fontname="Inter"];
  node  [shape=box, style="rounded,filled", fillcolor="#f8fafc", fontname="Inter", fontsize=10];
  edge  [color="#334155", arrowsize=0.7];
`;
for (const layer of LAYERS) {
  dot += `  subgraph "cluster_${layer.name}" {
    label="${layer.name}";
    style="rounded,dashed";
    color="#cbd5e1";
`;
  for (const c of layer.comps) if (allComps.has(c)) dot += `    "${c}";\n`;
  dot += `  }\n`;
}
for (const [k, count] of edges.entries()) {
  const [a, b] = /** @type {[string,string]} */ (k.split('->'));
  const allowed = policySet.has(
    `${layerOfComp.get(a) ?? 'Unmapped'}->${layerOfComp.get(b) ?? 'Unmapped'}`,
  );
  const color = allowed ? '#334155' : '#ef4444';
  const pen = allowed ? '1' : '2';
  dot += `  "${a}" -> "${b}" [label="${count}", color="${color}", penwidth=${pen}];\n`;
}
dot += '}\n';

fs.writeFileSync(OUT_DOT, dot, 'utf8');
fs.writeFileSync(
  OUT_MET,
  ['component\tCa\tCe\tinstability']
    .concat(metrics.map((m) => `${m.comp}\t${m.Ca}\t${m.Ce}\t${m.I}`))
    .join('\n') + '\n',
  'utf8',
);
fs.writeFileSync(
  OUT_VIO,
  ['from\tto\tfromLayer\ttoLayer\tedges']
    .concat(
      violations.map(
        (v) =>
          `${v.fromComp}\t${v.toComp}\t${v.fromLayer}\t${v.toLayer}\t${v.count}`,
      ),
    )
    .join('\n') + '\n',
  'utf8',
);

console.log('Wrote:');
console.log(' -', path.relative(process.cwd(), OUT_DOT));
console.log(' -', path.relative(process.cwd(), OUT_MET));
console.log(' -', path.relative(process.cwd(), OUT_VIO));
