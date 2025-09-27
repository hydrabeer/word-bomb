// @ts-check
// Summarize Clean Architecture signals into a markdown report.
// Usage: node scripts/arch-report.mjs [audit/2025...]
import fs from 'node:fs';
import path from 'node:path';

const dir =
  process.argv[2] ||
  (fs
    .readdirSync('audit', { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .pop()
    ? `audit/${fs
        .readdirSync('audit', { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
        .pop()}`
    : null);

if (!dir) {
  console.error('No audit/* found');
  process.exit(1);
}

const depcPath = path.join(dir, 'depcruise-graph.json');
const metPath = path.join(dir, 'arch-metrics.tsv');
const vioPath = path.join(dir, 'arch-violations.tsv');

/** @param {string} p */
const has = (p) => fs.existsSync(p);

const metrics = has(metPath)
  ? fs
      .readFileSync(metPath, 'utf8')
      .trim()
      .split('\n')
      .slice(1)
      .map((l) => {
        const [comp, Ca, Ce, I] = l.split('\t');
        return { comp, Ca: +Ca, Ce: +Ce, I: +I };
      })
  : [];

const violations = has(vioPath)
  ? fs
      .readFileSync(vioPath, 'utf8')
      .trim()
      .split('\n')
      .slice(1)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [from, to, fromL, toL, count] = l.split('\t');
        return { from, to, fromL, toL, count: +count };
      })
  : [];

const depc = has(depcPath) ? JSON.parse(fs.readFileSync(depcPath, 'utf8')) : {};
const mods = Array.isArray(depc.modules) ? depc.modules : [];

const edges = new Map();
for (const m of mods) {
  const from = String(m.source ?? m.name ?? '');
  const deps = Array.isArray(m.dependencies) ? m.dependencies : [];
  for (const d of deps) {
    const to = String(d.resolved ?? d.to ?? d.module ?? '');
    if (!to) continue;
    const key = `${from} -> ${to}`;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  }
}
// top cross-component edges (fold paths to components)
/** @param {string} p */
const mapComp = (p) =>
  p
    .replace(/^apps\/frontend\//, 'frontend/')
    .replace(/^apps\/backend\//, 'backend/')
    .replace(/^packages\/domain\//, 'domain/')
    .replace(/^packages\/types\//, 'types/');

const compEdges = new Map();
for (const [k, count] of edges.entries()) {
  if (!/^apps\/|^packages\//.test(k)) continue;
  const mapped = k.replace(/^(apps|packages)\//, '');
  const [a, b] = mapped.split(' -> ');
  if (!/(frontend|backend|domain|types)\//.test(a)) continue;
  if (!/(frontend|backend|domain|types)\//.test(b)) continue;
  const A = mapComp(a).split('/')[0];
  const B = mapComp(b).split('/')[0];
  if (A === B) continue;
  const kk = `${A} -> ${B}`;
  compEdges.set(kk, (compEdges.get(kk) ?? 0) + count);
}
const topCompEdges = [...compEdges.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

const lines = [];
lines.push(`# Architecture Report (${dir})\n`);
lines.push(`## Summary\n`);
if (violations.length === 0) lines.push(`- ✅ No layer violations detected.`);
else lines.push(`- ❌ ${violations.length} layer violations (see below).`);
if (metrics.length) {
  const sortedI = [...metrics].sort((a, b) => b.I - a.I);
  lines.push(`- Instability (Ce/(Ca+Ce)) by component:`);
  for (const m of sortedI)
    lines.push(`  - \`${m.comp}\`: I=${m.I} (Ca=${m.Ca}, Ce=${m.Ce})`);
}

lines.push(`\n## Top cross-component edges\n`);
for (const [e, c] of topCompEdges) lines.push(`- ${c}× \`${e}\``);
if (!topCompEdges.length) lines.push(`- (none)`);

lines.push(`\n## Violations (by layer)\n`);
if (violations.length) {
  lines.push(`from | to | fromLayer → toLayer | edges`);
  lines.push(`---|---|---|---`);
  for (const v of violations) {
    lines.push(`${v.from} | ${v.to} | ${v.fromL} → ${v.toL} | ${v.count}`);
  }
} else {
  lines.push(`(none)`);
}

lines.push(`\n## Recommendations\n`);
lines.push(
  `- Keep **Domain/Types** stable (low \`I\`). If their \`Ce\` rises, push logic outward.`,
);
lines.push(
  `- Resolve violations by moving code into \`packages/*\` or adding adapter entry points.`,
);
lines.push(
  `- Add or relax POLICY rules in \`scripts/arch-clean.mjs\` if an edge is intentional.`,
);

const out = path.join(dir, 'ARCHITECTURE_REPORT.md');
fs.writeFileSync(out, lines.join('\n') + '\n', 'utf8');
console.log('Wrote', out);
