import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PlaybackOrchestrator,
} from "./playback-orchestrator.js";

describe("PlaybackOrchestrator", () => {
  it("ignores VAD during playingAck", () => {
    const orchestrator = new PlaybackOrchestrator();
    orchestrator.phase = "playingAck";
    assert.equal(orchestrator.shouldIgnoreVadBegin(), true);
  });

  it("runs synchronous vad interrupt pipeline", async () => {
    const orchestrator = new PlaybackOrchestrator();
    orchestrator.enterPlaying();
    const steps: string[] = [];

    await orchestrator.onVadInterruptDuringPlay({
      stopPlay: async () => {
        steps.push("stopPlay");
        return true;
      },
      cancelActiveSession: async () => {
        steps.push("cancelActive");
      },
      playAck: async () => {
        steps.push("playAck");
        return true;
      },
    });

    assert.deepEqual(steps, ["stopPlay", "cancelActive", "playAck"]);
    assert.equal(orchestrator.phase, "awaitingFollowup");
  });

  it("resets silence timer on VAD during awaiting", async () => {
    const orchestrator = new PlaybackOrchestrator(50);
    let timeouts = 0;
    orchestrator.setSilenceHandler(() => {
      timeouts += 1;
    });
    orchestrator.phase = "awaitingFollowup";
    orchestrator.onAwaitingVadBegin();
    orchestrator.onAwaitingVadBegin();

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(timeouts, 1);
  });
});
