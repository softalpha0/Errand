#!/usr/bin/env bash
# Restores the Kite Passport login on the server.
#
# kpass keeps its login in ~/.kite-passport/ (config.json, agent.json).
# On Render, add those two files as Secret Files named
#   kite-passport-config.json  and  kite-passport-agent.json
# and they appear in /etc/secrets/. This script copies them into place.
# Nothing is printed: the files hold your login token.
set -euo pipefail

TARGET="${KPASS_WORKDIR:-/root}/.kite-passport"
mkdir -p "$TARGET"
chmod 700 "$TARGET"

for pair in "kite-passport-config.json:config.json" "kite-passport-agent.json:agent.json" "kite-passport-runtime.key:runtime.key"; do
  src="/etc/secrets/${pair%%:*}"
  dst="$TARGET/${pair##*:}"
  if [ -f "$src" ]; then
    cp "$src" "$dst"
    chmod 600 "$dst"
  fi
done

if [ "${ERRAND_MODE:-demo}" = "live" ] && [ ! -f "$TARGET/config.json" ]; then
  echo "ERRAND_MODE=live but no Kite Passport login was found. See docs/deploy.md (Secret Files)." >&2
fi

exec "$@"
