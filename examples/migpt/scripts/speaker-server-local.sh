#!/usr/bin/env bash
# Write speaker server.txt for local Mac dev (pnpm start on LAN).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/speaker.local.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}. Copy speaker.local.env.example first." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${SPEAKER_SSH:?SPEAKER_SSH required}"
: "${LOCAL_SERVER:?LOCAL_SERVER required}"

ssh "$SPEAKER_SSH" "mkdir -p /data/open-xiaoai && echo '${LOCAL_SERVER}' > /data/open-xiaoai/server.txt && pkill -f '/data/open-xiaoai/client' || true; sleep 1; /data/open-xiaoai/client \"\$(cat /data/open-xiaoai/server.txt)\" >/dev/null 2>&1 &"

echo "✅ Speaker → LOCAL: ${LOCAL_SERVER}"
