## Parent

#1

## What to build

Implement the Doubao Realtime client stack (protocol encode/decode, WebSocket lifecycle with persistent connection and reconnect, session management) and a CLI entry point. Given text input and credentials from config.ts, the CLI sends ChatTextQuery to Doubao O2.0 with xiaohe voice, receives pcm_s16le 24 kHz TTSResponse chunks, and plays them on the connected speaker using the raw audio path from the previous slice.

Each CLI invocation runs StartSession → ChatTextQuery → stream audio → FinishSession. WebSocket connection is reused across invocations (G1). Include unit tests for protocol round-trip and session mock behavior.

## Acceptance criteria

- [ ] `pnpm doubao:speak "你好"` (or equivalent CLI) plays xiaohe-voice audio on the connected speaker
- [ ] config.ts doubao section holds appId, accessKey, model 1.2.1.1, speaker zh_female_xiaohe_jupiter_bigtts
- [ ] Protocol encode/decode unit tests pass
- [ ] Session mock tests verify TTSResponse → audio chunks and FinishSession cleanup
- [ ] WebSocket reconnect works after simulated disconnect

## Blocked by

- #2 (Speaker raw audio RPC must work first)
