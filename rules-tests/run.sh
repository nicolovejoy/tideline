#!/usr/bin/env bash
# Run the firestore.rules tests against the Firestore emulator.
#
# The emulator needs a JVM. On this Mac the JDK is Homebrew's keg-only openjdk,
# which is deliberately NOT on PATH, so add it when it's there. CI runners have
# java already, and this is a no-op for them.
set -euo pipefail

if [ -d /opt/homebrew/opt/openjdk/bin ]; then
  export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
fi

if ! command -v java >/dev/null 2>&1; then
  echo "error: the Firestore emulator needs a Java runtime and none was found." >&2
  echo "       macOS: brew install openjdk" >&2
  exit 1
fi

cd "$(dirname "$0")"
exec ./node_modules/.bin/firebase emulators:exec --config ../firebase.json \
  --only firestore \
  --project demo-tideline \
  "./node_modules/.bin/vitest run ${*:-}"
