## Parent

#1

Extends closed #5 (D1 应用层 interrupt) with synchronous orchestration and「我在」ack.

## What to build

When Cooper is playing raw PCM and VAD fires (`is_vad_begin`), run a **fully synchronous** interrupt pipeline end-to-end:

1. `await stopPlay` — first voice stops immediately; skip `remainingPlayMs` drain in `playDoubaoReply` finally when `playbackSeq` / `interruptRequested` changed
2. `await cancelActive` — FinishSession for the **current round only**; **keep** `dialog_id` (do not `resetDialog`)
3. Play built-in wakeup wav「我在」(`speaker.play({ url: wakeup wav, blocking: true })`) — do **not** use `abortXiaoAI` here
4. Enter `awaitingFollowup`; start 10s silence timer **after** wav finishes

State machine (decision-rich core):

```
playing → playingAck → awaitingFollowup
```

- `playingAck`: ignore VAD until「我在」wav completes
- Replace fire-and-forget `void interruptCooper()` with awaited orchestrator entry

## Acceptance criteria

- [ ] Cooper playing → user speaks (VAD) → raw audio stops within one round-trip (no 1–2s tail from finally drain)
- [ ] User hears built-in「我在」/「在」wav after interrupt, not native mico restart side-effects alone
- [ ] No `resetDialog()` on VAD interrupt; `dialog_id` preserved for a follow-up Cooper turn
- [ ] `pnpm test` and `npx tsc --noEmit` pass

## Blocked by

None — can start immediately
