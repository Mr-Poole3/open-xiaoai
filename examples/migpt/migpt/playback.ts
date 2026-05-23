import { OpenXiaoAISpeaker } from "./speaker.js";
import type { DoubaoManager } from "./doubao/manager.js";

/** VAD interrupt: stop raw stream + finish current Doubao round (keep dialog_id). */
export async function pauseCooperPlayback(
  speaker: typeof OpenXiaoAISpeaker,
  doubaoManager: DoubaoManager | null
) {
  await speaker.stopPlay();
  await doubaoManager?.cancelActiveSession();
}

/** Preempt for a new Cooper query or native handoff: pause + restart native stack. */
export async function interruptPlayback(
  speaker: typeof OpenXiaoAISpeaker,
  doubaoManager: DoubaoManager | null
) {
  await pauseCooperPlayback(speaker, doubaoManager);
  await speaker.abortXiaoAI();
}
