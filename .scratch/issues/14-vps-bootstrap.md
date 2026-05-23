## Parent

#11

## What to build

One-time **VPS bootstrap** and operator documentation for Ubuntu 24.04 x64.

**`scripts/vps-bootstrap.sh`**

- Install Node.js 22 + pnpm + PM2
- Create `/opt/migpt/releases/` layout and `current` symlink target
- `pm2 startup systemd` instructions
- Open firewall note: allow `4399/tcp` (ufw/security group — operator manual)

**`docs/deploy-remote.md`**

- Prerequisites (VPS, Secrets, security group)
- Run bootstrap once
- Configure GitHub Secrets list
- First tag deploy walkthrough
- Speaker `server.txt`: `ws://115.190.170.8:4399?token=...`
- **SSH rollback** (3 commands: symlink + pm2 reload)
- Keep last 3 releases / prune policy

## Acceptance criteria

- [ ] Fresh Ubuntu 24.04 can bootstrap from script + doc
- [ ] Rollback steps documented and verified once manually
- [ ] No secrets in repo

## Blocked by

None — can parallel with #12
