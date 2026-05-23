## Parent

#11

## What to build

Add **WebSocket connection token** authentication to the MiGPT Server so port `4399` can be safely exposed on a public VPS without IP whitelisting.

- Read `OPEN_XIAOAI_TOKEN` from environment at Server start
- On inbound Client connection, parse `?token=` from the WebSocket URL (speaker `server.txt` format: `ws://115.190.170.8:4399?token=...`)
- **Valid token** → accept connection (existing Event/RPC flow unchanged)
- **Missing or invalid token** → reject/close immediately; do not process messages
- If `OPEN_XIAOAI_TOKEN` is unset, log a clear warning (dev mode: optional allow-local-only — document behavior)

## Acceptance criteria

- [ ] Client with correct token connects and Cooper E2E works
- [ ] Client with wrong/missing token is rejected
- [ ] Unit or integration test covers token accept/reject
- [ ] `docs/deploy-remote.md` (or #14) documents env var name

## Blocked by

None — start first
