#!/bin/bash

# Repo Map Generator
# Emits the generated sections of docs/project/architecture.md from the code itself,
# so the structure/endpoint inventory cannot drift from reality.
#
# Usage:
#   ./scripts/gen-repo-map.sh            Rewrite the generated blocks in architecture.md
#   ./scripts/gen-repo-map.sh --check    Exit 1 if the committed blocks are stale
#   ./scripts/gen-repo-map.sh --print    Print the generated content to stdout

set -euo pipefail

# Collation must be identical on every machine or the generated ordering differs
# between a macOS dev box (en_US.UTF-8) and the Ubuntu CI runner (C.UTF-8),
# producing spurious --check failures. This affects both sort(1) and bash glob
# expansion, so it is set for the whole script.
export LC_ALL=C

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCH_DOC="$REPO_ROOT/docs/project/architecture.md"
CONTROLLERS="$REPO_ROOT/backend/src/PropertyManager.Api/Controllers"
APPLICATION="$REPO_ROOT/backend/src/PropertyManager.Application"
FEATURES="$REPO_ROOT/frontend/src/app/features"

# --- endpoint inventory, parsed from [Route] + [HttpVerb] attributes ---
gen_endpoints() {
  for f in "$CONTROLLERS"/*.cs; do
    [ -e "$f" ] || continue
    local name
    name="$(basename "$f" .cs)"
    # TestController is a dev-only fixture endpoint, not part of the product API
    [ "$name" = "TestController" ] && continue
    # slug = controller name minus the "Controller" suffix, lowercased,
    # used to expand the [controller] route token
    local slug
    slug="$(echo "${name%Controller}" | tr '[:upper:]' '[:lower:]')"
    awk -v ctrl="$name" -v slug="$slug" '
      /^\[Route\(/ {
        if (match($0, /"[^"]+"/)) {
          route = substr($0, RSTART + 1, RLENGTH - 2)
          gsub(/\[controller\]/, slug, route)
        }
      }
      /^[[:space:]]+\[Http[A-Za-z]+/ {
        line = $0
        if (match(line, /\[Http[A-Za-z]+/)) {
          verb = toupper(substr(line, RSTART + 5, RLENGTH - 5))
        }
        suffix = ""
        if (match(line, /\("[^"]*"\)/)) {
          suffix = substr(line, RSTART + 2, RLENGTH - 4)
        }
        # a suffix beginning with "/" is an absolute route and replaces
        # the controller-level [Route] entirely (ASP.NET Core behaviour)
        if (substr(suffix, 1, 1) == "/") {
          full = substr(suffix, 2)
        } else if (suffix == "") {
          full = route
        } else {
          full = route "/" suffix
        }
        if (!header_printed) { printf "\n# %s\n", ctrl; header_printed = 1 }
        printf "%-6s %s\n", verb, full
      }
    ' "$f"
  done
}

# --- backend Application feature slices ---
gen_application() {
  find "$APPLICATION" -maxdepth 1 -mindepth 1 -type d \
    -not -name bin -not -name obj \
    -exec basename {} \; | sort | sed 's/^/  /'
}

# --- frontend features, with stores and services ---
gen_frontend() {
  for d in "$FEATURES"/*/; do
    [ -d "$d" ] || continue
    local feat detail
    feat="$(basename "$d")"
    detail=""
    if [ -d "$d/stores" ]; then
      local stores
      stores="$(find "$d/stores" -name '*.store.ts' -exec basename {} \; | sort | tr '\n' ' ')"
      [ -n "$stores" ] && detail="stores: ${stores% }"
    fi
    if [ -d "$d/services" ]; then
      [ -n "$detail" ] && detail="$detail | "
      detail="${detail}services"
    fi
    if [ -n "$detail" ]; then
      printf '  %-22s %s\n' "$feat/" "$detail"
    else
      printf '  %s\n' "$feat/"
    fi
  done
}

render() {
  cat <<EOF
<!-- BEGIN GENERATED: repo-map (scripts/gen-repo-map.sh — do not edit by hand) -->

### Backend — Application Feature Slices

\`\`\`
backend/src/PropertyManager.Application/
$(gen_application)
\`\`\`

### Frontend — Feature Modules

\`\`\`
frontend/src/app/features/
$(gen_frontend)
\`\`\`

### API Endpoint Inventory

Parsed from \`[Route]\` and \`[Http*]\` attributes. \`TestController\` is excluded
as a development-only fixture.

\`\`\`
$(gen_endpoints)
\`\`\`

<!-- END GENERATED: repo-map -->
EOF
}

BEGIN_MARK='<!-- BEGIN GENERATED: repo-map'
END_MARK='<!-- END GENERATED: repo-map -->'

splice() {
  local tmp bstart bend
  tmp="$(mktemp)"
  bstart="$(grep -nF "$BEGIN_MARK" "$ARCH_DOC" | head -1 | cut -d: -f1 || true)"
  bend="$(grep -nF "$END_MARK" "$ARCH_DOC" | head -1 | cut -d: -f1 || true)"
  if [ -z "$bstart" ] || [ -z "$bend" ]; then
    echo "error: generated-block markers not found in $ARCH_DOC" >&2
    exit 2
  fi
  {
    head -n "$((bstart - 1))" "$ARCH_DOC"
    render
    tail -n "+$((bend + 1))" "$ARCH_DOC"
  } > "$tmp"
  mv "$tmp" "$ARCH_DOC"
}

case "${1:-}" in
  --print) render ;;
  --check)
    before="$(cat "$ARCH_DOC")"
    splice
    after="$(cat "$ARCH_DOC")"
    if [ "$before" != "$after" ]; then
      printf '%s\n' "$before" > "$ARCH_DOC"
      echo "STALE: docs/project/architecture.md repo-map is out of date." >&2
      echo "Run ./scripts/gen-repo-map.sh and commit the result." >&2
      exit 1
    fi
    echo "OK: architecture.md repo-map matches the code."
    ;;
  *) splice; echo "Updated $ARCH_DOC" ;;
esac
