## Parent

#1

## What to build

Implement application-layer interrupt (D1). While Cooper audio is playing, detect native is_vad_begin events (wake word without ASR text) from InstructionMonitor. On interrupt: stop_play, FinishSession on current Doubao session, abortXiaoAI. Playback Controller gains an interrupt() method orchestrating these steps.

Do not rely on Doubao ASRInfo (B1 text mode does not stream mic audio to Doubao).

## Acceptance criteria

- [ ] During a long Cooper reply, saying「小爱同学」immediately stops audio playback
- [ ] No simultaneous native「哎」and Cooper audio after interrupt
- [ ] After interrupt, user can speak a new command and Cooper responds normally
- [ ] interrupt() calls stop_play, FinishSession, and abortXiaoAI in correct order

## Blocked by

- #4 (MiGPT Doubao integration must work first)
