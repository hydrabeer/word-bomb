#!/usr/bin/env zsh
set -euo pipefail

# prerequisites: pnpm installed
# optional: brew install jq graphviz syft osv-scanner

TS="$(date +%Y%m%d-%H%M%S)"
OUT="audit/$TS"
mkdir -p "$OUT"

echo ">> Writing outputs to $OUT"

# 0) Lock context (helpful for reproducibility)
git rev-parse HEAD > "$OUT/git_commit.txt" || true
node -v        > "$OUT/node_version.txt"   || true
pnpm -v        > "$OUT/pnpm_version.txt"   || true

# 1) Full dependency tree across all workspaces (JSON)
echo ">> pnpm list (this can take a bit on first run)…"
pnpm -r list --depth Infinity --json > "$OUT/pnpm-tree.json"

# 2) CycloneDX SBOM (Syft only; robust for pnpm workspaces)
echo ">> CycloneDX SBOM…"
if command -v syft >/dev/null 2>&1; then
  syft dir:. -o cyclonedx-json > "$OUT/sbom-cyclonedx.json" || echo '{}' > "$OUT/sbom-cyclonedx.json"
else
  echo "   Syft not found; skipping SBOM. Install with: brew install syft  (or see https://github.com/anchore/syft)"
  echo '{"note":"syft not installed; no SBOM generated"}' > "$OUT/sbom-cyclonedx.json"
fi

# 3) License inventory (flat, easy to eyeball + parse)
echo ">> License inventory…"
npx --yes license-checker-rseidelsohn \
  --json --relativeLicensePath --production --start . \
  > "$OUT/licenses-production.json" || true

# (dev licenses too, since monorepo tooling often lives here)
npx --yes license-checker-rseidelsohn \
  --json --relativeLicensePath --development --start . \
  > "$OUT/licenses-development.json" || true

# 4) Static import graph + validation (Dependency Cruiser)
# Uses your .dependency-cruiser.mjs and tsconfig.base.json
echo ">> Dependency Cruiser graph…"
npx --yes dependency-cruiser \
  --config ./.dependency-cruiser.mjs \
  --validate \
  -T json . > "$OUT/depcruise-graph.json"

# DOT (optional visual)
npx --yes dependency-cruiser \
  --config ./.dependency-cruiser.mjs \
  -T dot . > "$OUT/depcruise-graph.dot" || true

# 5) (Optional) Vulnerability report – try pnpm; optionally OSV if installed
echo ">> Vulnerability audit (optional)…"
if pnpm audit --json > "$OUT/vulns-pnpm.json"; then
  echo "   pnpm audit: OK"
else
  echo "   pnpm audit failed; trying --workspace-root…"
  if pnpm audit --workspace-root --json > "$OUT/vulns-pnpm.json"; then
    echo "   pnpm audit (workspace-root): OK"
  else
    echo "   pnpm audit still failed."
    if command -v osv-scanner >/dev/null 2>&1; then
      echo "   Using OSV-Scanner on pnpm-lock.yaml…"
      osv-scanner --lockfile=pnpm-lock.yaml --format=json > "$OUT/vulns-osv.json" \
        || echo '{}' > "$OUT/vulns-osv.json"
      echo '{"note":"pnpm audit unavailable; see vulns-osv.json"}' > "$OUT/vulns-pnpm.json"
    else
      echo "   OSV-Scanner not found; skipping vuln fallback."
      echo '{"note":"pnpm audit unavailable and OSV-Scanner not installed; no vuln data"}' > "$OUT/vulns-pnpm.json"
    fi
  fi
fi

# 6) Workspace + peer dep diagnostics (as NDJSON: one JSON object per line)
echo ">> Workspace peer dependency diagnostics…"
pnpm -r exec node -e 'const fs=require("fs");const pkg=require("./package.json");
process.stdout.write(JSON.stringify({name:pkg.name,version:pkg.version,peerDependencies:pkg.peerDependencies||{} }) + "\n");' \
  > "$OUT/workspace-peers.ndjson" || true

# 7) Summarize sizes of node_modules per workspace (handles scoped names)
echo ">> Node modules footprint…"
pnpm -r exec bash -lc '
  if [ -d node_modules ]; then
    du -sk node_modules 2>/dev/null | awk -v pkg="$PNPM_PACKAGE_NAME" "{ print \$1 \" KB\t\" pkg }"
  else
    awk -v pkg="$PNPM_PACKAGE_NAME" "BEGIN { print 0 \" KB\t\" pkg }"
  fi
' | sort -nr > "$OUT/node-modules-sizes.tsv" || true

echo ">> Done. Artifacts:"
ls -1 "$OUT"
