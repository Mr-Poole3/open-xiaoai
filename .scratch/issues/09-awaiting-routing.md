## Parent

#1

## What to build

After interrupt +「我在」, MiGPT enters `awaitingFollowup`. Route the **next ASR final** end-to-end:

**Cooper path** (ASR matches `callAIKeywords` —「请/你」):
- New `speak()` with the **same** `dialog_id` (session continues)
- Existing Cooper playback path (`abortXiaoAI` before raw stream as today)

**Native 小爱 path** (ASR does not match keywords):
- Full L3 teardown: FinishSession + `resetDialog`
- `stopPlay` → `abortXiaoAI` → wait → `askXiaoAI(text, { silent: true })`
- No overlapping Doubao raw audio and native TTS

**While awaiting:**
- `is_vad_begin` resets the 10s silence timer (user started speaking)

Split session cleanup:
- `cancelActive` / pause — interrupt only, keep `dialog_id`
- `teardown` — native handoff and silence full cleanup (used by #3 as well)

UX note: user must say「请继续讲」, not「继续讲」, to continue Cooper.

## Acceptance criteria

- [ ] Interrupt →「我在」→「请继续讲」→ Cooper replies with dialog continuity (same `dialog_id`)
- [ ] Interrupt →「我在」→「打开客厅灯」→ native executes; no Doubao audio overlap
- [ ] VAD during awaiting resets 10s timer (ASR can complete without premature timeout)
- [ ] Unit tests for routing + teardown vs cancel paths

## Blocked by

- #8
