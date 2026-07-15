#!/bin/sh
# Parity engine test suite — run `./parity --help` for usage.
# Works from any cwd; uses the locally installed tsx (run `npm install` once).
dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ ! -x "$dir/node_modules/.bin/tsx" ]; then
  echo "tsx not installed — run: (cd \"$dir\" && npm install)" >&2
  exit 2
fi
exec "$dir/node_modules/.bin/tsx" "$dir/src/cli.ts" "$@"
