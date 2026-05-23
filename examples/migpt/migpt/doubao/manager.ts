import { randomUUID } from "node:crypto";
import { DoubaoClient } from "./client.js";
import { DoubaoSession } from "./session.js";
import type { DoubaoConfig } from "./types.js";

/** G1 long-lived client + K2 dialog_id per wake cycle. */
export class DoubaoManager {
  private client: DoubaoClient | null = null;
  private session: DoubaoSession | null = null;
  private dialogId: string | null = null;

  constructor(private readonly config: DoubaoConfig) {}

  resetDialog() {
    this.dialogId = null;
  }

  private getDialogId() {
    if (!this.dialogId) {
      this.dialogId = randomUUID();
    }
    return this.dialogId;
  }

  private ensureSession() {
    if (!this.client) {
      this.client = new DoubaoClient(this.config);
      this.session = new DoubaoSession(this.client, this.config);
    }
    return this.session!;
  }

  async speak(
    text: string,
    systemPrompt: string,
    onAudioChunk: (chunk: Buffer) => void | Promise<void>
  ) {
    const session = this.ensureSession();
    await session.cancelActive();
    await session.speak({
      text,
      systemPrompt,
      dialogId: this.getDialogId(),
      onAudioChunk,
    });
  }

  async cancelActiveSession() {
    await this.ensureSession().cancelActive();
  }

  async close() {
    await this.client?.close();
    this.client = null;
    this.session = null;
  }
}
