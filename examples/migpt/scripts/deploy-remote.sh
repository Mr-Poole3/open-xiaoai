#!/usr/bin/env bash
# Run on VPS during CI deploy. Expects env file path as $1 (default /tmp/migpt-deploy.env).
set -euo pipefail

ENV_FILE="${1:-/tmp/migpt-deploy.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing deploy env: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

: "${TAG:?TAG required}"
: "${DOUBAO_APP_ID:?DOUBAO_APP_ID required}"
: "${DOUBAO_ACCESS_KEY:?DOUBAO_ACCESS_KEY required}"
: "${OPEN_XIAOAI_TOKEN:?OPEN_XIAOAI_TOKEN required}"

MIGPT_ROOT="/opt/migpt"
RELEASE="${MIGPT_ROOT}/releases/${TAG}"
ARCHIVE="/tmp/migpt-${TAG}.tar.gz"

mkdir -p "${MIGPT_ROOT}/releases"
rm -rf "${RELEASE}"
mkdir -p "${RELEASE}"
tar xzf "${ARCHIVE}" -C "${RELEASE}"
rm -f "${ARCHIVE}"

PREVIOUS=""
if [[ -L "${MIGPT_ROOT}/current" ]]; then
  PREVIOUS="$(readlink -f "${MIGPT_ROOT}/current" || true)"
fi
echo "${PREVIOUS}" > /tmp/migpt-previous-release

cd "${RELEASE}"
export CI=true
pnpm install --frozen-lockfile
node scripts/render-deploy-config.mjs
printf 'OPEN_XIAOAI_TOKEN=%s\n' "${OPEN_XIAOAI_TOKEN}" > .env

ln -sfn "${RELEASE}" "${MIGPT_ROOT}/current"
cd "${MIGPT_ROOT}/current"

if pm2 describe migpt >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
  pm2 save
fi

cd "${MIGPT_ROOT}/releases"
ls -1dt v* 2>/dev/null | tail -n +4 | xargs -r rm -rf

echo "✅ Deployed ${TAG} → ${MIGPT_ROOT}/current"
