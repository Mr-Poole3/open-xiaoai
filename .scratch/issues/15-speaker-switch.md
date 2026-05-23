## Parent

#11

## What to build

Scripts to switch speaker **`server.txt`** between **local Mac dev** and **cloud production** without manual SSH editing.

**Files**

- `examples/migpt/speaker.local.env.example` — `SPEAKER_SSH`, `LOCAL_SERVER`, `PROD_SERVER`
- `speaker.local.env` gitignored
- `scripts/speaker-server-local.sh` — SSH write `LOCAL_SERVER` to `/data/open-xiaoai/server.txt`, restart client if needed
- `scripts/speaker-server-prod.sh` — write `PROD_SERVER` (`ws://115.190.170.8:4399?token=...`)
- `package.json` scripts: `speaker:local`, `speaker:prod`

**Prod URL** uses same token as `OPEN_XIAOAI_TOKEN` (document: copy from GitHub Secrets or local env).

## Acceptance criteria

- [ ] `pnpm speaker:prod` points speaker at cloud VPS
- [ ] `pnpm speaker:local` points speaker at Mac LAN IP for `pnpm start` dev
- [ ] Example env committed; real env gitignored
- [ ] Documented in `docs/deploy-remote.md`

## Blocked by

None — can parallel with #12
