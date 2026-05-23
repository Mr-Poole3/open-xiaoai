export type CooperPhase =
  | "idle"
  | "playing"
  | "draining"
  | "playingAck"
  | "awaitingFollowup";

/** Built-in speaker wakeup wav — does not require mico TTS. */
export const kCooperAckWavUrl =
  "file:///usr/share/sound-vendor/AiNiRobot/wakeup_zai_01.wav";

export const AWAITING_SILENCE_MS = 10_000;

export class PlaybackOrchestrator {
  phase: CooperPhase = "idle";
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private onSilenceTimeout: (() => void) | null = null;

  constructor(private readonly silenceMs = AWAITING_SILENCE_MS) {}

  isPlayingCooper() {
    return this.phase === "playing" || this.phase === "draining";
  }

  isPlayingAck() {
    return this.phase === "playingAck";
  }

  isAwaitingFollowup() {
    return this.phase === "awaitingFollowup";
  }

  shouldIgnoreVadBegin() {
    return this.phase === "playingAck";
  }

  enterPlaying() {
    this.clearSilenceTimer();
    this.phase = "playing";
  }

  enterDraining() {
    if (this.phase === "playing") {
      this.phase = "draining";
    }
  }

  enterIdle() {
    this.clearSilenceTimer();
    this.phase = "idle";
  }

  onAwaitingVadBegin() {
    if (this.phase === "awaitingFollowup") {
      this.resetSilenceTimer();
    }
  }

  setSilenceHandler(handler: () => void) {
    this.onSilenceTimeout = handler;
  }

  async onVadInterruptDuringPlay(deps: {
    stopPlay: () => Promise<boolean>;
    cancelActiveSession: () => Promise<void>;
    playAck: () => Promise<boolean>;
  }) {
    if (this.phase !== "playing" && this.phase !== "draining") return;

    this.phase = "playingAck";
    await deps.stopPlay();
    await deps.cancelActiveSession();
    await deps.playAck();
    this.phase = "awaitingFollowup";
    this.resetSilenceTimer();
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private resetSilenceTimer() {
    this.clearSilenceTimer();
    if (this.phase !== "awaitingFollowup") return;
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null;
      this.onSilenceTimeout?.();
    }, this.silenceMs);
  }
}
