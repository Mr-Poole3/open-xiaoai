/**
 * Issue #2: verify raw PCM playback on a connected speaker.
 *
 * Usage:
 *   1. Ensure the speaker client is connected (boot.sh / manual client)
 *   2. pnpm test:raw-audio
 */
import { chunkPcm, generateSinePcm, kPlayAudioConfig, sleep } from "../migpt/audio-config.js";
import { RustServer } from "../migpt/open-xiaoai.js";
import { OpenXiaoAISpeaker } from "../migpt/speaker.js";

const WAIT_FOR_CLIENT_MS = Number(process.env.WAIT_MS ?? 8_000);
const TONE_HZ = Number(process.env.TONE_HZ ?? 440);
const TONE_SEC = Number(process.env.TONE_SEC ?? 2);

(global as any).RUST_CALLBACKS = {
  on_event: (event: string) => {
    if (process.env.DEBUG) console.log("[event]", event);
  },
  on_input_data: () => {},
};

async function playTestTone() {
  console.log(`⏳ 等待 ${WAIT_FOR_CLIENT_MS / 1000}s，请确认音箱 Client 已连接...`);
  await sleep(WAIT_FOR_CLIENT_MS);

  console.log(`🔊 播放测试音 ${TONE_HZ}Hz / ${TONE_SEC}s（24kHz PCM）...`);
  const started = await OpenXiaoAISpeaker.startPlay(kPlayAudioConfig);
  if (!started) {
    console.error("❌ start_play 失败 — 音箱 Client 可能未连接");
    process.exit(1);
  }

  const pcm = generateSinePcm(TONE_HZ, kPlayAudioConfig.sample_rate, TONE_SEC);
  for (const chunk of chunkPcm(pcm)) {
    const ok = await OpenXiaoAISpeaker.play({ bytes: chunk });
    if (!ok) {
      console.error("❌ on_output_data 失败");
      await OpenXiaoAISpeaker.stopPlay();
      process.exit(1);
    }
    await sleep(20);
  }

  await sleep(300);
  const stopped = await OpenXiaoAISpeaker.stopPlay();
  console.log(stopped ? "✅ 测试音播放完成" : "⚠️ stop_play 返回 false");
  process.exit(stopped ? 0 : 1);
}

setTimeout(() => {
  playTestTone().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}, 0);

console.log("✅ WebSocket Server 启动中 (0.0.0.0:4399)...");
await RustServer.start();
