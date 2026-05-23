#!/usr/bin/env bash
# One-time VPS bootstrap for MiGPT remote deploy (Ubuntu 24.04 x64).
set -euo pipefail

MIGPT_ROOT="/opt/migpt"
NODE_MAJOR=22

echo "==> MiGPT VPS bootstrap (Ubuntu 24.04)"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run as root (or with sudo)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg build-essential

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v${NODE_MAJOR}* ]]; then
  echo "==> Installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "==> Installing pnpm"
  npm install -g pnpm@9
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> Installing PM2"
  npm install -g pm2
fi

mkdir -p "${MIGPT_ROOT}/releases"

echo "==> PM2 startup (run the command PM2 prints if not already done)"
env PATH="$PATH:$(npm prefix -g)" pm2 startup systemd -u "${SUDO_USER:-root}" --hp "/root" || true

cat <<EOF

✅ Bootstrap complete.

Next steps:
1. Open cloud security group / ufw: allow TCP 4399
2. Configure GitHub Secrets (DOUBAO_*, OPEN_XIAOAI_TOKEN, VPS_*)
3. Push tag: git tag v2.0.0 && git push origin v2.0.0
4. On speaker: ws://115.190.170.8:4399?token=YOUR_TOKEN in /data/open-xiaoai/server.txt

Rollback (see docs/deploy-remote.md):
  ln -sfn ${MIGPT_ROOT}/releases/vX.Y.Z ${MIGPT_ROOT}/current && pm2 reload migpt
EOF
