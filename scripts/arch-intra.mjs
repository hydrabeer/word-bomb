// @ts-check
// Intra-application Clean Architecture analyzer (per app).
// Builds layer graphs for frontend and backend separately.
//
// Usage:
//   node scripts/arch-intra.mjs [audit/<timestamp>]
// Outputs in the same audit folder:
//   - arch-frontend.dot / arch-frontend.svg
//   - arch-backend.dot  / arch-backend.svg
//   - arch-intra-frontend.{metrics,violations}.tsv
//   - arch-intra-backend.{metrics,violations}.tsv

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function newestAuditDir() {
  const base = path.join(__dirname, '..', 'audit');
  if (!fs.existsSync(base)) return null;
  const dirs = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return dirs.length ? path.join(base, dirs[dirs.length - 1]) : null;
}

const AUD = process.argv[2] || newestAuditDir();
if (!AUD) {
  console.error('No audit/* found. Run scripts/gen-dep-audit.zsh first.');
  process.exit(1);
}
const IN = path.join(AUD, 'depcruise-graph.json');
if (!fs.existsSync(IN)) {
  console.error('Missing depcruise-graph.json in ' + AUD);
  process.exit(1);
}
const depc = JSON.parse(fs.readFileSync(IN, 'utf8'));
/** @type {Array<any>} */
const modules = Array.isArray(depc.modules) ? depc.modules : [];

/** @param {string} p */
function norm(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
}

// ----- Per-app configs -------------------------------------------------------
// Adjust these groups if you reorganize folders later.

const FRONT_GROUPS = [
  { key: 'ui-pages', match: /^apps\/frontend\/src\/pages\//, layer: 'UI' },
  {
    key: 'ui-components',
    match: /^apps\/frontend\/src\/components\//,
    layer: 'UI',
  },
  {
    key: 'ui-hooks',
    match: /^apps\/frontend\/src\/hooks\//,
    layer: 'Application',
  },
  { key: 'ui-api', match: /^apps\/frontend\/src\/api\//, layer: 'API' },
  { key: 'ui-socket', match: /^apps\/frontend\/src\/socket\//, layer: 'API' },
  {
    key: 'ui-utils',
    match: /^apps\/frontend\/src\/utils\//,
    layer: 'Application',
  },
  {
    key: 'ui-root',
    match: /^apps\/frontend\/src\/(main\.tsx|socket\.ts|index\.css$)/,
    layer: 'UI',
  },
];

const BACK_GROUPS = [
  { key: 'be-routes', match: /^apps\/backend\/src\/routes\//, layer: 'API' },
  { key: 'be-socket', match: /^apps\/backend\/src\/socket\//, layer: 'API' },
  {
    key: 'be-room',
    match: /^apps\/backend\/src\/room\//,
    layer: 'Application',
  },
  {
    key: 'be-game',
    match: /^apps\/backend\/src\/game\//,
    layer: 'Application',
  },
  {
    key: 'be-core',
    match: /^apps\/backend\/src\/core\//,
    layer: 'Application',
  },
  {
    key: 'be-utils',
    match: /^apps\/backend\/src\/utils\//,
    layer: 'Application',
  },
  { key: 'be-root', match: /^apps\/backend\/src\/index\.ts$/, layer: 'API' },
];

// Intra-app policies (allowed flows: outer -> inner)
/** @type {Set<string>} */
const FRONT_POLICY = new Set([
  'UI->Application',
  'UI->API',
  'Application->API', // hooks/utils calling fetch/socket is fine
  // If you want “UI cannot call API directly”, remove 'UI->API'
]);

/** @type {Set<string>} */
const BACK_POLICY = new Set([
  'API->Application',
  'Application->Domain', // if you import from packages/domain (path-name mapping not needed here)
]);

/**
 * @param {Array<{key:string, match: RegExp, layer: string}>} groups
 * @param {string} p
 */
function groupOf(groups, p) {
  for (const g of groups) if (g.match.test(p)) return g.key;
  return null;
}
/**
 * @param {Array<{key:string, match: RegExp, layer: string}>} groups
 * @param {string} key
 */
function layerOf(groups, key) {
  return groups.find((g) => g.key === key)?.layer || 'Unmapped';
}

/**
 * @param {string} appPrefix
 * @param {Array<{key:string, match: RegExp, layer: string}>} groups
 * @param {Set<string>} policy
 * @param {string} outBase
 */
function buildAppGraph(appPrefix, groups, policy, outBase) {
  /** @type {Map<string, number>} */ const edges = new Map();
  /** @type {Map<string, Set<string>>} */ const incoming = new Map();
  /** @type {Map<string, Set<string>>} */ const outgoing = new Map();
  const nodes = new Set(groups.map((g) => g.key));

  for (const m of modules) {
    const from = norm(m.source || m.name || '');
    if (!from.startsWith(appPrefix)) continue;
    const gf = groupOf(groups, from);
    if (!gf) continue;
    const deps = Array.isArray(m.dependencies) ? m.dependencies : [];
    for (const d of deps) {
      const to = norm(d.resolved || d.to || d.module || '');
      if (!to.startsWith(appPrefix)) continue;
      const gt = groupOf(groups, to);
      if (!gt || gt === gf) continue;
      const k = `${gf}->${gt}`;
      edges.set(k, (edges.get(k) || 0) + 1);
      if (!outgoing.has(gf)) outgoing.set(gf, new Set());
      if (!incoming.has(gt)) incoming.set(gt, new Set());
      const outSet = outgoing.get(gf);
      const inSet = incoming.get(gt);
      outSet && outSet.add(gt);
      inSet && inSet.add(gf);
    }
  }

  // metrics
  const metrics = [];
  for (const key of Array.from(nodes).sort()) {
    const Ce = outgoing.get(key)?.size ?? 0;
    const Ca = incoming.get(key)?.size ?? 0;
    const I = Ca + Ce === 0 ? 0 : Number((Ce / (Ca + Ce)).toFixed(3));
    metrics.push({ comp: key, Ca, Ce, I, layer: layerOf(groups, key) });
  }

  // violations
  const violations = [];
  for (const [k, count] of edges.entries()) {
    const [a, b] = /** @type {[string,string]} */ (k.split('->'));
    const allow = policy.has(`${layerOf(groups, a)}->${layerOf(groups, b)}`);
    if (!allow) {
      violations.push({
        from: a,
        to: b,
        fromLayer: layerOf(groups, a),
        toLayer: layerOf(groups, b),
        edges: count,
      });
    }
  }

  // write tsvs
  fs.writeFileSync(
    path.join(AUD ?? '', `arch-intra-${outBase}.metrics.tsv`),
    ['component\tlayer\tCa\tCe\tinstability']
      .concat(
        metrics.map((m) => `${m.comp}\t${m.layer}\t${m.Ca}\t${m.Ce}\t${m.I}`),
      )
      .join('\n') + '\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(AUD ?? '', `arch-intra-${outBase}.violations.tsv`),
    ['from\tto\tfromLayer\ttoLayer\tedges']
      .concat(
        violations.map(
          (v) => `${v.from}\t${v.to}\t${v.fromLayer}\t${v.toLayer}\t${v.edges}`,
        ),
      )
      .join('\n') + '\n',
    'utf8',
  );

  // dot
  let dot = `digraph G {
    rankdir=LR;
    node [shape=box,style="rounded,filled",fillcolor="#f8fafc",fontname="Inter",fontsize=10];
    edge [color="#334155",arrowsize=0.7];
  `;
  const layers = Array.from(new Set(groups.map((g) => g.layer)));
  for (const L of layers) {
    dot += `subgraph "cluster_${L}" { label="${L}"; style="rounded,dashed"; color="#cbd5e1";\n`;
    for (const g of groups.filter((x) => x.layer === L))
      dot += `  "${g.key}";\n`;
    dot += '}\n';
  }
  for (const [k, count] of edges.entries()) {
    const [a, b] = /** @type {[string,string]} */ (k.split('->'));
    const allow = policy.has(`${layerOf(groups, a)}->${layerOf(groups, b)}`);
    const color = allow ? '#334155' : '#ef4444';
    const pen = allow ? '1' : '2';
    dot += `"${a}" -> "${b}" [label="${count}", color="${color}", penwidth=${pen}];\n`;
  }
  dot += '}\n';
  fs.writeFileSync(path.join(AUD ?? '', `arch-${outBase}.dot`), dot, 'utf8');
}

// Build per-app graphs
buildAppGraph('apps/frontend/', FRONT_GROUPS, FRONT_POLICY, 'frontend');
buildAppGraph('apps/backend/', BACK_GROUPS, BACK_POLICY, 'backend');

console.log('Wrote:');
console.log(' -', path.join(AUD, 'arch-frontend.dot'));
console.log(' -', path.join(AUD, 'arch-backend.dot'));
console.log(' -', path.join(AUD, 'arch-intra-frontend.metrics.tsv'));
console.log(' -', path.join(AUD, 'arch-intra-backend.metrics.tsv'));
console.log(' -', path.join(AUD, 'arch-intra-frontend.violations.tsv'));
console.log(' -', path.join(AUD, 'arch-intra-backend.violations.tsv'));
