/**
 * Issue #3: Doubao Realtime TTS → speaker raw playback.
 *
 * Usage:
 *   1. Fill doubao credentials in config.ts
 *   2. Ensure speaker client is connected
 *   3. pnpm doubao:speak "你好"
 */
import { chunkPcm, kPlayAudioConfig, sleep } from "../migpt/audio-config.js";
import { DoubaoClient } from "../migpt/doubao/client.js";
import { DoubaoSession } from "../migpt/doubao/session.js";
import { RustServer } from "../migpt/open-xiaoai.js";
import { OpenXiaoAISpeaker } from "../migpt/speaker.js";
import { kOpenXiaoAIConfig } from "../config.js";

const WAIT_FOR_CLIENT_MS = Number(process.env.WAIT_MS ?? 8_000);
const text = process.argv.slice(2).join(" ").trim() || "你好，我是 Cooper。";

if (!kOpenXiaoAIConfig.doubao?.appId || !kOpenXiaoAIConfig.doubao?.accessKey) {
  console.error("❌ 请在 config.ts 中填写 doubao.appId 和 doubao.accessKey");
  process.exit(1);
}

(global as any).RUST_CALLBACKS = {
  on_event: (event: string) => {
    if (process.env.DEBUG) console.log("[event]", event);
  },
  on_input_data: () => {},
};

async function speakOnSpeaker() {
  console.log(`⏳ 等待 ${WAIT_FOR_CLIENT_MS / 1000}s，请确认音箱 Client 已连接...`);
  await sleep(WAIT_FOR_CLIENT_MS);

  const client = new DoubaoClient(kOpenXiaoAIConfig.doubao!);
  const session = new DoubaoSession(client, kOpenXiaoAIConfig.doubao!);

  console.log(`🗣️  豆包合成: "${text}"`);
  const started = await OpenXiaoAISpeaker.startPlay(kPlayAudioConfig);
  if (!started) {
    console.error("❌ start_play 失败 — 音箱 Client 可能未连接");
    process.exit(1);
  }

  try {
    let totalBytesSent = 0;
    const startTime = Date.now();

    await session.speak({
      text,
      systemPrompt: kOpenXiaoAIConfig.prompt?.system ?? "",
      onAudioChunk: async (chunk) => {
        const ok = await OpenXiaoAISpeaker.play({ bytes: new Uint8Array(chunk) });
        if (!ok) throw new Error("on_output_data failed");

        totalBytesSent += chunk.length;
        const expectedDurationMs = (totalBytesSent / 2 / 24000) * 1000;
        const elapsedMs = Date.now() - startTime;
        const sleepMs = Math.max(0, expectedDurationMs - elapsedMs - 50);

        if (sleepMs > 0) {
          await sleep(sleepMs);
        }
      },
    });
  } finally {
    await sleep(300);
    await OpenXiaoAISpeaker.stopPlay();
    await client.close();
  }

  console.log("✅ 播放完成");
  process.exit(0);
}

setTimeout(() => {
  speakOnSpeaker().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}, 0);

console.log("✅ WebSocket Server 启动中 (0.0.0.0:4399)...");
await RustServer.start();
