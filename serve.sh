#!/usr/bin/env bash
# Serve the built site in docs/ on http://localhost:PORT (default 8000).
set -euo pipefail
cd "$(dirname "$0")"

python3 -m http.server "${1:-8000}" -d docs
