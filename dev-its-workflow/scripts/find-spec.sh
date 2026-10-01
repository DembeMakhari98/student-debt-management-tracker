#!/usr/bin/env bash
# Print candidate spec files for the dev-its-workflow, best match first.
# Usage: find-spec.sh [name-or-glob]   (e.g. find-spec.sh login-redirect)
set -euo pipefail

root="$(pwd)"
pat="${1:-}"

# Search order: an explicit name/glob, then SDD, then docs, then anywhere.
declare -a globs
if [[ -n "$pat" ]]; then
  globs+=("**/*${pat}*.spec.md" "**/${pat}")
fi
globs+=("docs/SDD/*.spec.md" "docs/**/*.spec.md" "**/*.spec.md")

found=()
for g in "${globs[@]}"; do
  while IFS= read -r -d '' f; do
    # de-dup and skip node_modules / .git / dist / target
    case "$f" in */node_modules/*|*/.git/*|*/dist/*|*/target/*) continue;; esac
    if [[ ! " ${found[*]-} " == *" $f "* ]]; then found+=("$f"); fi
  done < <(find "$root" -type f -path "*${g#**/}" -print0 2>/dev/null | sort -z)
done

if [[ ${#found[@]} -eq 0 ]]; then
  echo "No *.spec.md found under $root" >&2
  exit 1
fi
printf '%s\n' "${found[@]}"
