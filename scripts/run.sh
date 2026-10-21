#!/usr/bin/env bash
# Run the Yaadein desktop app in development. Loads apps/desktop/.env at runtime.
# Usage: ./scripts/run.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="apps/desktop/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy apps/desktop/.env.example and fill the public Entra, Cosmos, and Blob values." >&2
  exit 1
fi

required=(
  YAADEIN_ENTRA_CLIENT_ID
  YAADEIN_ENTRA_TENANT_ID
  YAADEIN_COSMOS_ENDPOINT
  YAADEIN_BLOB_ACCOUNT_URL
)

for key in "${required[@]}"; do
  value="$(grep -E "^${key}=" "$ENV_FILE" | head -n 1 | cut -d= -f2- | tr -d '[:space:]' || true)"
  if [[ -z "${value}" ]]; then
    echo "$ENV_FILE needs a non-empty ${key}." >&2
    exit 1
  fi
done

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required (this repo uses pnpm@9.15.4)." >&2
  exit 1
fi

if [[ $# -gt 0 ]]; then
  echo "Usage: ./scripts/run.sh" >&2
  exit 1
fi

pnpm install
pnpm dev
