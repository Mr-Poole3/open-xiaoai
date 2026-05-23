import { type EngineConfig, MiGPTEngine } from "@mi-gpt/engine";
import { deepMerge, sleep } from "@mi-gpt/utils";
import { jsonDecode } from "@mi-gpt/utils/parse";
import type { Prettify } from "@mi-gpt/utils/typing";
import { randomUUID } from "node:crypto";
import { kPlayAudioConfig } from "./audio-config.js";
import { DOUBAO_CANCELLED } from "./doubao/session.js";
import { DoubaoManager } from "./doubao/manager.js";
import type { DoubaoConfig } from "./doubao/types.js";
import { PlaybackOrchestrator } from "./playback-orchestrator.js";
import { RustServer } from "./open-xiaoai.js";
import { OpenXiaoAISpeaker } from "./speaker.js";
import { WakeRouter } from "./wake-router.js";

export type OpenXiaoAIProvider = "doubao" | "openai";

export type OpenXiaoAIConfig = Prettify<
  EngineConfig<OpenXiaoAIEngine> & {
    provider?: OpenXiaoAIProvider;
    doubao?: DoubaoConfig;
  }
>;

const kDefaultOpenXiaoAIConfig: OpenXiaoAIConfig = {
  provider: "doubao",
};

/** Ignore duplicate Cooper ASR within this window (VPS WAN often delivers twice). */
const COOPER_DEDUPE_MS = 60_000;

/** Ignore spurious is_vad_begin before the first Cooper audio chunk arrives. */
const PLAYBACK_VAD_GRACE_MS = 4_000;

async function interruptibleSleep(
  ms: number,
  shouldContinue: () => boolean
) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (!shouldContinue()) return false;
    await sleep(Math.min(100, end - Date.now()));
  }
  return true;
}

class OpenXiaoAIEngine extends MiGPTEngine {
  speaker = OpenXiaoAISpeaker;
  declare config: OpenXiaoAIConfig;
  private doubaoManager: DoubaoManager | null = null;
  private cooperPlaying = false;
  private interruptRequested = false;
  private playbackSeq = 0;
  private lastAbortAt = 0;
  private playbackStartedAt = 0;
  private cooperAudioStarted = false;
  private activeCooperText = "";
  private activeCooperStartedAt = 0;
  private wakeRouter = new WakeRouter();
  private playbackOrchestrator = new PlaybackOrchestrator();

  async start(config: OpenXiaoAIConfig) {
    await super.start(deepMerge(kDefaultOpenXiaoAIConfig, config));
    if (this.isDoubaoProvider() && this.config.doubao) {
      this.doubaoManager = new DoubaoManager(this.config.doubao);
    }
    this.playbackOrchestrator.setSilenceHandler(() => {
      this.onAwaitingSilenceTimeout();
    });
    (global as any).RUST_CALLBACKS = {
      on_event: this.onEvent,
      on_input_data: this.onRecord,
    };
    console.log("✅ 服务已启动...");
    await RustServer.start();
  }

  private isDoubaoProvider() {
    return (this.config.provider ?? "doubao") === "doubao";
  }

  private shouldRouteToCooper(text: string) {
    return this.wakeRouter.shouldRouteToCooper(
      text,
      this.config.callAIKeywords ?? []
    );
  }

  private isCooperActive() {
    return (
      this.cooperPlaying ||
      this.interruptRequested ||
      this.playbackOrchestrator.isPlayingCooper()
    );
  }

  private shouldIgnoreVadBegin() {
    if (this.playbackOrchestrator.shouldIgnoreVadBegin()) {
      return true;
    }
    if (!this.playbackOrchestrator.isPlayingCooper()) {
      return false;
    }
    if (this.cooperAudioStarted) {
      return false;
    }
    return Date.now() - this.playbackStartedAt < PLAYBACK_VAD_GRACE_MS;
  }

  private isDuplicateCooperQuery(text: string) {
    return (
      text === this.activeCooperText &&
      this.activeCooperText.length > 0 &&
      Date.now() - this.activeCooperStartedAt < COOPER_DEDUPE_MS
    );
  }

  /** Stop Cooper raw stream + cancel current Doubao round. */
  private async stopCooperPlayback(options: { resetDialog?: boolean } = {}) {
    if (!this.isCooperActive()) return;

    this.interruptRequested = true;
    this.playbackSeq += 1;
    this.cooperPlaying = false;
    this.playbackOrchestrator.enterIdle();
    console.log("⏹️  打断 Cooper 播放");

    await this.speaker.stopPlay();
    await this.doubaoManager?.cancelActiveSession();
    if (options.resetDialog) {
      this.doubaoManager?.resetDialog();
    }
  }

  async onMessage(msg: Parameters<MiGPTEngine["onMessage"]>[0]) {
    const routeToCooper = this.shouldRouteToCooper(msg.text);

    if (
      routeToCooper &&
      this.isDoubaoProvider() &&
      this.config.doubao &&
      this.doubaoManager
    ) {
      this.wakeRouter.consumeWake();
      console.log(`🔥 ${msg.text}`);
      this.lastMsg = msg;
      const hookReply = await this.config.onMessage?.(this, msg);
      if (hookReply?.handled) return;
      if (hookReply && !hookReply.default) {
        await (MiGPTEngine.prototype as any)._response.call(this, msg, hookReply);
        return;
      }

      if (this.playbackOrchestrator.isAwaitingFollowup()) {
        this.playbackOrchestrator.enterIdle();
      }
      if (this.isCooperActive()) {
        if (this.isDuplicateCooperQuery(msg.text)) {
          console.log("🔁 忽略重复 Cooper 请求");
          return;
        }
        await this.stopCooperPlayback();
      }
      this.lastAbortAt = Date.now();
      await this.speaker.abortXiaoAI();
      await this.playDoubaoReply(msg);
      return;
    }

    this.wakeRouter.consumeWake();
    if (this.isCooperActive()) {
      await this.stopCooperPlayback({ resetDialog: true });
    }
    return super.onMessage(msg);
  }

  private async playDoubaoReply(msg: Parameters<MiGPTEngine["onMessage"]>[0]) {
    if (this.hasNewerMessage(msg) || this.status !== "running") return;

    const playbackId = ++this.playbackSeq;
    this.activeCooperText = msg.text;
    this.activeCooperStartedAt = Date.now();
    console.log(`🗣️  Cooper: ${msg.text}`);
    this.interruptRequested = false;
    await sleep(2000);
    if (
      this.interruptRequested ||
      this.hasNewerMessage(msg) ||
      playbackId !== this.playbackSeq
    ) {
      return;
    }

    const started = await this.speaker.startPlay(kPlayAudioConfig);
    if (!started) {
      console.error("❌ start_play 失败");
      return;
    }

    this.cooperPlaying = true;
    this.cooperAudioStarted = false;
    this.playbackStartedAt = Date.now();
    this.playbackOrchestrator.enterPlaying();
    let totalBytesSent = 0;
    let audioSendStartAt = 0;
    try {
      const startTime = Date.now();

      await this.doubaoManager!.speak(
        msg.text,
        this.config.prompt?.system ?? "",
        async (chunk) => {
          if (
            this.interruptRequested ||
            this.status !== "running" ||
            playbackId !== this.playbackSeq
          ) {
            throw new Error(DOUBAO_CANCELLED);
          }

          if (audioSendStartAt === 0) {
            audioSendStartAt = Date.now();
            this.cooperAudioStarted = true;
          }

          await this.speaker.play({ bytes: new Uint8Array(chunk) });
          totalBytesSent += chunk.length;

          const expectedDurationMs = (totalBytesSent / 2 / 24000) * 1000;
          const elapsedMs = Date.now() - startTime;
          const sleepMs = Math.max(0, expectedDurationMs - elapsedMs - 50);

          const shouldContinue = () =>
            !this.interruptRequested &&
            this.status === "running" &&
            playbackId === this.playbackSeq;

          if (sleepMs > 0) {
            const completed = await interruptibleSleep(sleepMs, shouldContinue);
            if (!completed || !shouldContinue()) {
              throw new Error(DOUBAO_CANCELLED);
            }
          }
        }
      );
    } catch (err) {
      if ((err as Error).message !== DOUBAO_CANCELLED) {
        console.error("[doubao]", err);
      }
    } finally {
      const interrupted = this.interruptRequested || playbackId !== this.playbackSeq;
      const audioDurationMs = (totalBytesSent / 2 / 24000) * 1000;
      const elapsedPlayMs = audioSendStartAt ? Date.now() - audioSendStartAt : 0;
      const remainingPlayMs = Math.max(300, audioDurationMs - elapsedPlayMs + 200);

      if (playbackId === this.playbackSeq) {
        this.cooperPlaying = false;
      }
      if (interrupted) {
        await this.speaker.stopPlay();
      }
      if (!interrupted && playbackId === this.playbackSeq) {
        this.playbackOrchestrator.enterDraining();
        const drainUntil = Date.now() + remainingPlayMs;
        while (
          Date.now() < drainUntil &&
          !this.interruptRequested &&
          playbackId === this.playbackSeq &&
          this.playbackOrchestrator.isPlayingCooper()
        ) {
          await sleep(100);
        }
        await this.speaker.stopPlay();
        if (
          !this.interruptRequested &&
          playbackId === this.playbackSeq &&
          this.playbackOrchestrator.isPlayingCooper()
        ) {
          this.playbackOrchestrator.enterIdle();
        }
      }
      if (playbackId === this.playbackSeq) {
        this.activeCooperText = "";
        this.activeCooperStartedAt = 0;
      }
    }
  }

  private onAwaitingSilenceTimeout() {
    console.log("⏳ awaiting 沉默超时（#10 将实现追问与清理）");
  }

  private hasNewerMessage(ctx: Parameters<MiGPTEngine["onMessage"]>[0]) {
    return (this.lastMsg?.timestamp ?? 0) > ctx.timestamp;
  }

  private routeFinalAsr(text: string) {
    void this.onMessage({
      text,
      id: randomUUID(),
      sender: "user",
      timestamp: Date.now(),
    });
  }

  onEvent = (event: string) => {
    const e = JSON.parse(event);
    if (e.event === "playing") {
      OpenXiaoAISpeaker.status =
        e.data === "Playing"
          ? "playing"
          : e.data === "Paused"
          ? "paused"
          : "idle";
    } else if (e.event === "instruction" && e.data.NewLine) {
      const line = jsonDecode(e.data.NewLine) as any;
      if (
        line?.header?.namespace === "SpeechRecognizer" &&
        line?.header?.name === "RecognizeResult"
      ) {
        const text = line?.payload?.results?.[0]?.text;
        const isVadBegin = Boolean(line?.payload?.is_vad_begin);
        const isFinal = Boolean(line?.payload?.is_final);

        if (isFinal && text) {
          if (this.isCooperActive() && this.isDuplicateCooperQuery(text)) {
            return;
          }
          if (this.isCooperActive()) {
            void (async () => {
              await this.stopCooperPlayback({
                resetDialog: !this.shouldRouteToCooper(text),
              });
              this.routeFinalAsr(text);
            })();
            return;
          }
          if (this.cooperPlaying && !this.shouldRouteToCooper(text)) {
            return;
          }
          this.routeFinalAsr(text);
          return;
        }

        if (isVadBegin && !text) {
          if (this.shouldIgnoreVadBegin()) {
            return;
          }
          this.wakeRouter.onNativeVadBegin();
          if (this.playbackOrchestrator.isAwaitingFollowup()) {
            this.playbackOrchestrator.onAwaitingVadBegin();
          }
          return;
        }

        if (isVadBegin && text && !isFinal) {
          if (this.playbackOrchestrator.phase === "idle") {
            this.wakeRouter.onNativeVadBegin();
          }
        }
      }
    } else if (e.event === "kws") {
      const keyword = e.data?.Keyword as string | undefined;
      if (keyword) {
        const label =
          keyword === "hicooper"
            ? "hi cooper"
            : keyword === "嗨库珀"
              ? "嗨，库珀"
              : keyword;
        console.log("🔥 唤醒词识别", label);
        this.wakeRouter.onKwsKeyword(keyword);
      }
    }
  };

  onRecord = (data: Uint8Array) => {
    if (this.config.debug) {
      console.log("🔥 收到录音音频流", data.length);
    }
  };
}

export const OpenXiaoAI = new OpenXiaoAIEngine();
