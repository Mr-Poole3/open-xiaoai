## Parent

#11

## What to build

**GitHub Actions** pipeline triggered by push tags `v*.*.*`:

1. **test** job: `npx tsc --noEmit` + `pnpm test` (gate — fail stops deploy)
2. **build** job: `pnpm build` on `ubuntu-latest`, tar deploy artifact
3. **deploy** job: SSH to VPS, extract to `/opt/migpt/releases/<tag>/`, render `config.ts` + `.env` from GitHub Secrets, `ln -sfn` → `current`, `pm2 reload migpt`
4. **smoke** job (same deploy or follow-up): WebSocket connect to VPS with token; on failure revert `current` symlink to previous release + `pm2 reload`
5. Upload tar to **GitHub Releases**

**GitHub Secrets:** `DOUBAO_*`, `OPEN_XIAOAI_TOKEN`, `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`

Public repo: never commit real `config.ts`; deploy step generates it from Secrets.

## Acceptance criteria

- [ ] Push `v2.0.0-test` (or dry-run) runs full pipeline
- [ ] Failed tests block deploy
- [ ] Successful deploy leaves PM2 `migpt` online on VPS
- [ ] Smoke test validates token auth end-to-end
- [ ] Failed smoke reverts `current` to previous release

## Blocked by

- #12 (token auth required for smoke test)
