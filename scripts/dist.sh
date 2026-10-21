#!/usr/bin/env bash
# Build Yaadein desktop installers. Public config from apps/desktop/.env is embedded.
# Usage: ./scripts/dist.sh [mac|win|all]
# Default: mac on macOS, win on Windows.

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

target="${1:-}"
if [[ -z "$target" ]]; then
  case "$(uname -s)" in
    Darwin) target="mac" ;;
    MINGW* | MSYS* | CYGWIN*) target="win" ;;
    *)
      echo "Pass mac, win, or all. This host is $(uname -s)." >&2
      exit 1
      ;;
  esac
fi

pnpm install

case "$target" in
  mac) pnpm dist:mac ;;
  win) pnpm dist:win ;;
  all) pnpm dist ;;
  *)
    echo "Usage: ./scripts/dist.sh [mac|win|all]" >&2
    exit 1
    ;;
esac

echo "Installers are in apps/desktop/release/"
