## V2 Status — Planning (Remote Always-On)

**Goal:** Run MiGPT on a cloud VPS 24/7 so the speaker connects over the public internet. No manual `pnpm start` on Mac for production. Deploy by pushing a `v*.*.*` git tag.

**Production endpoint:** `ws://115.190.170.8:4399?token=<OPEN_XIAOAI_TOKEN>`

---

## Problem Statement

V1 requires the MiGPT Server to run on a developer Mac on the same LAN. If the Mac sleeps or is offline, the speaker Client cannot connect and Cooper stops working. The user wants a always-on remote Server while keeping the existing Client-on-speaker architecture (speaker outbound WebSocket to Server).

## Solution

Deploy MiGPT on **Ubuntu 24.04 VPS** with **PM2**, protected by **URL query token** auth (no IP whitelist — home egress IP is dynamic). **GitHub Actions** on `v*.*.*` tags: test → build → SSH deploy → WebSocket smoke test (auto-rollback symlink on failure). Secrets stay in **GitHub Secrets** (public repo — no credentials in git). Speaker `server.txt` points to cloud IP; local dev uses switch scripts.

## User Stories

### V2 — To build

1. As a user, I want the speaker to connect to a cloud Server automatically, so that Cooper works without my Mac running.
2. As a user, I want `git tag v2.x.x` to deploy to VPS, so that releases are one step.
3. As a developer, I want CI to run tests before deploy, so that broken builds never reach production.
4. As a developer, I want secrets in GitHub Secrets (not git), so that a public repo stays safe.
5. As a developer, I want `pnpm speaker:local` / `pnpm speaker:prod` to switch speaker routing, so that I can still debug on Mac when needed.
6. As a developer, I want deploy smoke test + auto rollback, so that a bad release does not stay live.
7. As a developer, I want SSH rollback documented, so that I can revert quickly without a rollback workflow.

### V2.1 — Backlog

- WSS/TLS + domain (DDNS)
- GitHub `workflow_dispatch` one-click rollback
- V1 deferred: awaiting /「我在」/ KWS production

## Implementation Decisions

### Network & security

| Decision | Choice |
|---|---|
| Topology | Cross-network: speaker (home) → VPS (cloud) |
| Connection direction | Unchanged: **Client connects to Server** on 4399 |
| IP whitelist | **No** (dynamic home egress IP) |
| Auth | **`?token=` query param** on WebSocket URL; Server validates against `OPEN_XIAOAI_TOKEN` |
| Transport | Plain `ws://` in V2 (WSS deferred) |
| Speaker address | **`ws://115.190.170.8:4399?token=...`** |

Invalid token → reject/close connection before accepting Event/RPC traffic.

### VPS runtime

- **OS:** Ubuntu 24.04 x64
- **Process manager:** PM2 (`restart` + `pm2 startup systemd`)
- **Layout:**

```
/opt/migpt/
  releases/v2.0.0/ …
  releases/v2.0.1/ …
  current -> releases/v2.0.1/
```

- Keep **last 3 releases**; prune older
- **Bootstrap:** `scripts/vps-bootstrap.sh` (Node 22 + PM2 + directories) — one-time on VPS

### CI/CD (C2)

**Trigger:** push tag matching `v*.*.*`

**Pipeline:**

1. `npx tsc --noEmit` + `pnpm test` — **gate** (fail = no deploy)
2. `pnpm build` (native `open-xiaoai.node` on Linux x64)
3. Tar artifact → GitHub Releases
4. SSH deploy: extract to `releases/<tag>/`, generate `config.ts` + `.env` from Secrets, `ln -sfn`, `pm2 reload`
5. WebSocket smoke test to `ws://115.190.170.8:4399?token=...` — on failure: revert `current` symlink to previous release + `pm2 reload` + fail job

**GitHub Secrets (minimum):**

- `DOUBAO_APP_ID`, `DOUBAO_ACCESS_KEY`, … (render `config.ts` at deploy)
- `OPEN_XIAOAI_TOKEN`
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`

Public repo: **`config.example.ts` only**; never commit real `config.ts`.

### Local dev vs production

- **Production:** speaker `server.txt` → cloud URL
- **Local debug:** `speaker.local.env` (gitignored) + `pnpm speaker:local` / `pnpm speaker:prod`
- Example env: `SPEAKER_SSH`, `LOCAL_SERVER`, `PROD_SERVER`

### Rollback (V2)

Document SSH steps only (no workflow):

```bash
ln -sfn /opt/migpt/releases/v2.0.0 /opt/migpt/current
pm2 reload migpt
```

## Deep Modules (V2)

1. **WebSocket token gate** — validate `?token=` on Server accept (extend `examples/migpt/src/server.rs` or connection handler)
2. **Deploy workflow** — `.github/workflows/migpt-deploy.yml`
3. **VPS bootstrap** — `scripts/vps-bootstrap.sh`
4. **Speaker switch scripts** — `scripts/speaker-server-local.sh`, `speaker-server-prod.sh`
5. **Config renderer** — deploy step: Secrets → `config.ts` on VPS

## Testing Decisions

- **CI gate:** existing 14 unit tests + `tsc --noEmit`
- **Post-deploy:** WebSocket connect smoke with valid token
- **Manual E2E:** speaker on prod URL →「小爱同学，请你…」→ Cooper; interrupt → 小爱 handoff (V1 behavior)

## Out of Scope (V2)

- Docker / docker-compose deploy
- IP firewall whitelist
- WSS / TLS / domain
- GitHub rollback workflow
- Committing secrets to git (repo is public)
- Awaiting state machine /「我在」/ KWS (V1 backlog)

## Further Notes

- V1 PRD closed as shipped (#1); sub-issues #2–#7 done; #8–#10 deferred
- Speaker Client binary unchanged; only `server.txt` URL update + token
- Cloud security group: open **4399/tcp** to world; rely on token
- VPS IP: `115.190.170.8` — if IP changes, update speaker `server.txt` (domain = V2.1)

## Planned Issue Slices (suggested)

1. Server WebSocket token authentication
2. GitHub Actions deploy pipeline (test → build → deploy → smoke)
3. VPS bootstrap + deploy-remote docs
4. Speaker local/prod switch scripts
