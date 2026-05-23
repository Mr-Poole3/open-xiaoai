import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import {
  ClientEvent,
  DOUBAO_APP_KEY,
  DOUBAO_RESOURCE_ID,
  getDoubaoWsUrl,
  ServerEvent,
} from "./events.js";
import { decodeFrame, encodeJsonEvent, type DecodedFrame } from "./protocol.js";
import type { DoubaoConfig, FrameHandler } from "./types.js";

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 8_000;

export class DoubaoClient {
  private ws: WebSocket | null = null;
  private connectId = randomUUID();
  private connected = false;
  private connecting: Promise<void> | null = null;
  private handlers = new Set<FrameHandler>();
  private reconnectAttempt = 0;
  private closedByUser = false;

  constructor(private readonly config: DoubaoConfig) {}

  onFrame(handler: FrameHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async ensureConnection(): Promise<void> {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.connecting) {
      return this.connecting;
    }
    this.connecting = this.connect();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  async sendEvent(
    eventId: number,
    payload: Record<string, unknown> = {},
    sessionId?: string
  ) {
    await this.ensureConnection();
    this.sendFrame(encodeJsonEvent(eventId, payload, sessionId));
  }

  private sendFrame(frame: Buffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not open");
    }
    this.ws.send(frame);
  }

  async close() {
    this.closedByUser = true;
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.sendFrame(encodeJsonEvent(ClientEvent.FinishConnection, {}));
      } catch {
        // ignore close race
      }
    }
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  /** @internal test hook */
  get readyState() {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  private async connect(): Promise<void> {
    this.closedByUser = false;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(getDoubaoWsUrl(), {
        headers: {
          "X-Api-App-ID": this.config.appId,
          "X-Api-Access-Key": this.config.accessKey,
          "X-Api-Resource-Id": DOUBAO_RESOURCE_ID,
          "X-Api-App-Key": DOUBAO_APP_KEY,
          "X-Api-Connect-Id": this.connectId,
        },
      });

      ws.binaryType = "nodebuffer";

      ws.once("open", async () => {
        this.ws = ws;
        try {
          await this.handshake();
          this.connected = true;
          this.reconnectAttempt = 0;
          resolve();
        } catch (err) {
          ws.close();
          reject(err);
        }
      });

      ws.on("message", (data) => this.dispatch(Buffer.from(data as Buffer)));

      ws.on("close", () => {
        const wasConnected = this.connected;
        this.connected = false;
        this.ws = null;
        if (!this.closedByUser && wasConnected) {
          void this.scheduleReconnect();
        }
      });

      ws.once("error", (err) => {
        if (!this.connected) reject(err);
      });
    });
  }

  private async handshake() {
    const started = this.waitForEvent(ServerEvent.ConnectionStarted, 10_000);
    this.sendFrame(encodeJsonEvent(ClientEvent.StartConnection, {}));
    await started;
  }

  private dispatch(buffer: Buffer) {
    let frame: DecodedFrame;
    try {
      frame = decodeFrame(buffer);
    } catch (err) {
      console.error("[doubao] decode error:", err);
      return;
    }
    for (const handler of this.handlers) {
      handler(frame);
    }
  }

  private waitForEvent(eventId: number, timeoutMs: number) {
    return new Promise<DecodedFrame>((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`timeout waiting for event ${eventId}`));
      }, timeoutMs);

      const off = this.onFrame((frame) => {
        if (frame.eventId === eventId) {
          clearTimeout(timer);
          off();
          resolve(frame);
        }
      });
    });
  }

  private scheduleReconnect() {
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt
    );
    this.reconnectAttempt += 1;
    setTimeout(() => {
      if (!this.closedByUser) {
        void this.ensureConnection().catch((err) => {
          console.error("[doubao] reconnect failed:", err);
        });
      }
    }, delay);
  }
}
