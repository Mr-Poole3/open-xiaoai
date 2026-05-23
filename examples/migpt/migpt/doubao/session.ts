import { randomUUID } from "node:crypto";
import { ClientEvent, ServerEvent } from "./events.js";
import { DoubaoClient } from "./client.js";
import { buildStartSessionPayload, buildSystemRole } from "./payload.js";
import { parseJsonPayload } from "./protocol.js";
import type { DoubaoConfig } from "./types.js";

export const DOUBAO_CANCELLED = "cancelled";

export function isDoubaoCancelled(err: unknown) {
  return err instanceof Error && err.message === DOUBAO_CANCELLED;
}

export interface SpeakOptions {
  text: string;
  systemPrompt?: string;
  dialogId?: string;
  onAudioChunk: (chunk: Buffer) => void | Promise<void>;
  timeoutMs?: number;
}

export class DoubaoSession {
  constructor(
    private readonly client: DoubaoClient,
    private readonly config: DoubaoConfig
  ) {}

  private activeSessionId: string | null = null;
  private rejectActive: ((err: Error) => void) | null = null;

  async cancelActive() {
    const sessionId = this.activeSessionId;
    this.activeSessionId = null;
    if (this.rejectActive) {
      this.rejectActive(new Error(DOUBAO_CANCELLED));
      this.rejectActive = null;
    }
    if (sessionId) {
      try {
        await this.finish(sessionId, 3_000);
      } catch {
        // session may already be finished
      }
    }
  }

  async speak({
    text,
    systemPrompt = "",
    dialogId,
    onAudioChunk,
    timeoutMs = 300_000,
  }: SpeakOptions): Promise<void> {
    const sessionId = randomUUID();
    this.activeSessionId = sessionId;
    try {
      const systemRole = buildSystemRole(systemPrompt, this.config.memoryFile);
      const startPayload = buildStartSessionPayload(
        this.config,
        systemRole,
        dialogId
      );

      await this.client.ensureConnection();

      const sessionReady = this.waitFor(
        (f) =>
          f.eventId === ServerEvent.SessionStarted && f.sessionId === sessionId,
        timeoutMs,
        `SessionStarted(${sessionId})`
      );

      await this.client.sendEvent(
        ClientEvent.StartSession,
        startPayload,
        sessionId
      );
      await sessionReady;

      await this.client.sendEvent(
        ClientEvent.ChatTextQuery,
        { content: text },
        sessionId
      );

      await this.collectTts(sessionId, onAudioChunk, timeoutMs);
      await this.finish(sessionId, timeoutMs);
    } finally {
      if (this.activeSessionId === sessionId) {
        this.activeSessionId = null;
      }
    }
  }

  private async collectTts(
    sessionId: string,
    onAudioChunk: (chunk: Buffer) => void | Promise<void>,
    timeoutMs: number
  ) {
    let settled = false;
    let chain: Promise<void> = Promise.resolve();

    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        off();
        this.rejectActive = null;
        fn();
      };

      const armTimer = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          settle(() => reject(new Error("timeout waiting for TTSEnded")));
        }, timeoutMs);
      };

      armTimer();

      this.rejectActive = (err) => {
        chain = chain.finally(() => {
          settle(() => reject(err));
        });
      };

      const off = this.client.onFrame((frame) => {
        if (frame.sessionId && frame.sessionId !== sessionId) return;

        if (frame.eventId === ServerEvent.TTSResponse && frame.isAudio) {
          const payload = frame.payload;
          chain = chain
            .then(async () => {
              if (settled) return;
              await onAudioChunk(payload);
              armTimer();
            })
            .catch((err) => {
              if (isDoubaoCancelled(err)) {
                settle(() =>
                  reject(
                    err instanceof Error ? err : new Error(DOUBAO_CANCELLED)
                  )
                );
                return;
              }
              settle(() =>
                reject(err instanceof Error ? err : new Error(String(err)))
              );
            });
          return;
        }

        if (frame.eventId === ServerEvent.SessionFailed) {
          const body = parseJsonPayload<{ message?: string }>(frame.payload);
          chain = chain.finally(() => {
            settle(() => reject(new Error(body.message ?? "SessionFailed")));
          });
          return;
        }

        if (frame.eventId === ServerEvent.DialogCommonError) {
          const body = parseJsonPayload<{ message?: string }>(frame.payload);
          chain = chain.finally(() => {
            settle(() => reject(new Error(body.message ?? "DialogCommonError")));
          });
          return;
        }

        if (frame.eventId === ServerEvent.TTSEnded && frame.sessionId === sessionId) {
          chain = chain.finally(() => {
            settle(() => resolve());
          });
        }
      });
    });
  }

  private async finish(sessionId: string, timeoutMs: number) {
    const finished = this.waitFor(
      (f) => f.eventId === ServerEvent.SessionFinished && f.sessionId === sessionId,
      timeoutMs,
      `SessionFinished(${sessionId})`
    );
    await this.client.sendEvent(ClientEvent.FinishSession, {}, sessionId);
    await finished;
  }

  private waitFor(
    predicate: (frame: import("./protocol.js").DecodedFrame) => boolean,
    timeoutMs: number,
    label: string
  ) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`timeout waiting for ${label}`));
      }, timeoutMs);

      const off = this.client.onFrame((frame) => {
        if (predicate(frame)) {
          clearTimeout(timer);
          off();
          resolve();
        }
      });
    });
  }
}
