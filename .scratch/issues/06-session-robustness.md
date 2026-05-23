## Parent

#1

## What to build

Harden Doubao session and playback behavior for real-world use. Ensure: new query finishes any stale session first; _hasNewMsg cancels in-progress playback when new ASR text arrives; WebSocket disconnect triggers reconnect and recovery; rapid consecutive wake-ups do not leak sessions or produce garbled/overlapping audio.

## Acceptance criteria

- [ ] Two rapid Cooper queries do not produce overlapping audio
- [ ] New ASR text while Cooper is speaking cancels current playback (_hasNewMsg)
- [ ] Simulated WebSocket drop → auto reconnect → next query succeeds without Server restart
- [ ] FinishSession sent after normal TTS completion; no orphaned sessions

## Blocked by

- #4 (MiGPT Doubao integration must work first)

## Further Notes

Can be implemented in parallel with #5 (D1 interrupt) once #4 is done.
