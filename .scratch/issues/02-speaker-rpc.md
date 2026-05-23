## Parent

#1

## What to build

Expose speaker raw audio playback from the MiGPT Server to a connected XiaoAI client. When the Server calls start_play with a 24 kHz PCM configuration, the client starts its AudioPlayer pipeline. The Server can then stream PCM chunks via on_output_data and the speaker plays them. stop_play kills the aplay process.

Deliver a minimal test script that plays a known PCM buffer (or generated tone) on the speaker when connected — no Doubao, no engine changes. Connection greeting ("已连接") may continue using native TTS for now.

## Acceptance criteria

- [ ] Node.js can invoke start_play and stop_play RPCs against the connected client
- [ ] PCM audio at 24 kHz mono s16le plays audibly on the OH2P speaker via the test script
- [ ] stop_play immediately stops playback
- [ ] No changes to packages/client-rust client binary on the speaker

## Blocked by

None — can start immediately
