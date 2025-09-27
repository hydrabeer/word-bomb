#!/usr/bin/env zsh
set -euo pipefail

# Usage: scripts/audit-summary.zsh [AUDIT_DIR]
# If omitted, it uses the most recent audit/* directory.

AUDIT_ROOT="${1:-}"
if [[ -z "${AUDIT_ROOT}" ]]; then
  AUDIT_ROOT="$(ls -1d audit/* 2>/dev/null | sort | tail -n1 || true)"
fi
[[ -n "${AUDIT_ROOT}" ]] || { echo "No audit/* folder found"; exit 1; }

SBOM="$AUDIT_ROOT/sbom-cyclonedx.json"
DEPC="$AUDIT_ROOT/depcruise-graph.json"
LICP="$AUDIT_ROOT/licenses-production.json"
LICD="$AUDIT_ROOT/licenses-development.json"
VULN_PNPM="$AUDIT_ROOT/vulns-pnpm.json"
VULN_OSV="$AUDIT_ROOT/vulns-osv.json"
SIZES="$AUDIT_ROOT/node-modules-sizes.tsv"

echo "=== Audit Summary for: $AUDIT_ROOT ==="

# 1) Depcruise summary
if [[ -f "$DEPC" ]]; then
  echo "-- Import graph / rules --"
  jq -r '.summary? // {} | "errors=\(.errors // 0) warnings=\(.warnings // 0)"' "$DEPC"
  echo "rule violations:"
  jq -r '
    (.violations? // [])
    | map({r:.rule.name, from:.from, to:.to})
    | .[]
    | [.r, .from, .to] | @tsv
  ' "$DEPC" 2>/dev/null || true
else
  echo "-- Import graph: missing ($DEPC)"
fi
echo

# 2) Licenses
echo "-- Licenses (production: GPL/AGPL/LGPL/MPL/CDDL/UNKNOWN) --"
if [[ -f "$LICP" ]]; then
  jq -r '
    to_entries[]
    | select(.value.licenses|test("GPL|AGPL|LGPL|MPL|CDDL|UNKNOWN";"i"))
    | "\(.key)\t\(.value.licenses)"
  ' "$LICP" || true
else
  echo "missing: $LICP"
fi
echo

# 3) Potentially risky install scripts (from SBOM)
echo "-- Packages with install scripts --"
if [[ -f "$SBOM" ]]; then
  jq -r '
    (.components? // [])
    | map(select(.properties[]? | .name=="npm:hasInstallScripts" and .value=="true"))
    | .[] | "\(.name)@\(.version)"
  ' "$SBOM" | sort -u
else
  echo "missing: $SBOM"
fi
echo

# 4) Duplicate versions (top 20 libs with >1 version)
echo "-- Duplicated packages (>1 version) --"
if [[ -f "$SBOM" ]]; then
  jq -r '
    (.components? // [])
    | group_by(.name)
    | map({name: .[0].name, versions: (map(.version)|unique) })
    | map(select((.versions|length) > 1))
    | sort_by(.name)
    | .[:20]
    | .[] | "\(.name): " + (.versions|join(", "))
  ' "$SBOM"
else
  echo "missing: $SBOM"
fi
echo

# 5) Size hotspots
echo "-- Largest node_modules by workspace --"
if [[ -f "$SIZES" ]]; then
  sort -nr "$SIZES" | head -n 10 | column -t -s $'\t'
else
  echo "missing: $SIZES"
fi
echo

# 6) Security vulnerabilities
echo "-- Vulnerabilities --"
if [[ -f "$VULN_PNPM" && "$(jq -r 'type' "$VULN_PNPM" 2>/dev/null)" != "null" ]]; then
  # Print any severities found (format varies by pnpm; try to be liberal)
  jq -r '
    ..|objects
    | select(has("severity"))
    | [.severity, (.package?.name // .name // ""), (.package?.version // .version // ""), (.title // .id // .advisory // "")]
    | @tsv
  ' "$VULN_PNPM" 2>/dev/null | sort -u || true
elif [[ -f "$VULN_OSV" ]]; then
  jq -r '
    (.results? // [])[]
    | .packages[]? as $p
    | $p.versions[]? as $v
    | ($p.package.name+"@"+$v) as $pv
    | .issues[]? | [$pv, .severity, .id] | @tsv
  ' "$VULN_OSV" 2>/dev/null || true
else
  echo "No vuln JSON present."
fi

echo "=== End ==="
