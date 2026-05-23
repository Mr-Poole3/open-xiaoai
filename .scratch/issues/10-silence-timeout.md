## Parent

#1

## What to build

Handle **silence after interrupt +「我在」** when the user never speaks again:

1. 10s after「我在」wav ends with no ASR final → play bundled wav「还有什么事吗？」(`blocking: true`; bundled asset, not mico TTS)
2. Start 5s timer after prompt wav ends
3. Still no ASR final → full cleanup: FinishSession + `resetDialog` + `stopPlay`; return to idle

VAD during the 10s (or 5s) window resets the active timer (shared with awaiting routing).

Do not leave orphaned Doubao sessions or raw AudioPlayer after silence.

## Acceptance criteria

- [ ] Interrupt →「我在」→ silence 10s → user hears bundled prompt wav
- [ ] Silence 5s more after prompt → full L3 cleanup; next「小爱同学，请…」starts fresh Cooper dialog
- [ ] Speaking during silence window resets timer (no cleanup while user is talking)
- [ ] Bundled prompt wav committed under repo assets (no dependency on live mico TTS)

## Blocked by

- #8
