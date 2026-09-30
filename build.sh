#!/usr/bin/env bash
# Build the static site into docs/ with Node 24 (see Containerfile).
set -euo pipefail
cd "$(dirname "$0")"

rm -rf docs
# podman build steps default to 1024 open files, which the Vite build exceeds.
podman build --ulimit nofile=65536:65536 --output type=local,dest=docs .
