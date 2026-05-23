import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WebSocket, WebSocketServer } from "ws";
import { ClientEvent, ServerEvent } from "./events.js";
import { DoubaoClient } from "./client.js";
import { encodeJsonEvent } from "./protocol.js";
import { DoubaoSession } from "./session.js";
import type { DoubaoConfig } from "./types.js";

const testConfig: DoubaoConfig = {
  appId: "test-app",
  accessKey: "test-key",
  model: "1.2.1.1",
  speaker: "zh_female_xiaohe_jupiter_bigtts",
  botName: "Cooper",
  speakingStyle: "简洁",
  enableWebSearch: false,
  strictAudit: true,
  auditResponse: "不能回答",
};

describe("doubao session (mock ws)", () => {
  it("streams TTSResponse chunks and finishes session", async () => {
    const finishedSessions: string[] = [];
    const server = await startMockServer(async (ws) => {
      ws.on("message", async (raw) => {
        const buf = Buffer.from(raw as Buffer);
        const eventId = buf.readUInt32BE(4);
        const sessionId = readSessionId(buf);

        if (eventId === ClientEvent.StartConnection) {
          ws.send(serverJsonFrame(ServerEvent.ConnectionStarted, {}));
          return;
        }

        if (eventId === ClientEvent.StartSession && sessionId) {
          ws.send(serverJsonFrame(ServerEvent.SessionStarted, {}, sessionId));
          return;
        }

        if (eventId === ClientEvent.ChatTextQuery && sessionId) {
          ws.send(serverAudioFrame(ServerEvent.TTSResponse, sessionId, Buffer.from([9, 8, 7])));
          ws.send(serverJsonFrame(ServerEvent.TTSEnded, {}, sessionId));
          return;
        }

        if (eventId === ClientEvent.FinishSession && sessionId) {
          finishedSessions.push(sessionId);
          ws.send(serverJsonFrame(ServerEvent.SessionFinished, {}, sessionId));
        }
      });
    });

    const client = new DoubaoClient(testConfig);
    const session = new DoubaoSession(client, testConfig);
    const chunks: Buffer[] = [];

    await session.speak({
      text: "你好",
      onAudioChunk: (chunk) => {
        chunks.push(chunk);
      },
    });

    assert.deepEqual(chunks, [Buffer.from([9, 8, 7])]);
    assert.equal(finishedSessions.length, 1);
    await client.close();
    await server.close();
  });

  it("cancelActive rejects current speak and sends FinishSession", async () => {
    const finishedSessions: string[] = [];
    let receivedChunk: (() => void) | undefined;
    const gotChunk = new Promise<void>((resolve) => {
      receivedChunk = resolve;
    });

    const server = await startMockServer(async (ws) => {
      ws.on("message", async (raw) => {
        const buf = Buffer.from(raw as Buffer);
        const eventId = buf.readUInt32BE(4);
        const sessionId = readSessionId(buf);

        if (eventId === ClientEvent.StartConnection) {
          ws.send(serverJsonFrame(ServerEvent.ConnectionStarted, {}));
          return;
        }

        if (eventId === ClientEvent.StartSession && sessionId) {
          ws.send(serverJsonFrame(ServerEvent.SessionStarted, {}, sessionId));
          return;
        }

        if (eventId === ClientEvent.ChatTextQuery && sessionId) {
          ws.send(
            serverAudioFrame(
              ServerEvent.TTSResponse,
              sessionId,
              Buffer.from([1, 2, 3])
            )
          );
          return;
        }

        if (eventId === ClientEvent.FinishSession && sessionId) {
          finishedSessions.push(sessionId);
          ws.send(serverJsonFrame(ServerEvent.SessionFinished, {}, sessionId));
        }
      });
    });

    const client = new DoubaoClient(testConfig);
    const session = new DoubaoSession(client, testConfig);

    try {
      const speaking = session.speak({
        text: "讲个长故事",
        onAudioChunk: () => {
          receivedChunk?.();
        },
        timeoutMs: 5_000,
      });
      const rejected = assert.rejects(speaking, /cancelled/);

      await gotChunk;
      await session.cancelActive();
      await rejected;

      assert.equal(finishedSessions.length, 1);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("reconnects after simulated disconnect", async () => {
    let connections = 0;
    const server = await startMockServer(async (ws) => {
      connections += 1;
      ws.on("message", (raw) => {
        const buf = Buffer.from(raw as Buffer);
        const eventId = buf.readUInt32BE(4);
        if (eventId === ClientEvent.StartConnection) {
          ws.send(serverJsonFrame(ServerEvent.ConnectionStarted, {}));
          if (connections === 1) {
            ws.close();
          }
        }
      });
    });

    const client = new DoubaoClient(testConfig);
    await client.ensureConnection();
    assert.equal(connections, 1);

    await new Promise((r) => setTimeout(r, 700));
    await client.ensureConnection();
    assert.ok(connections >= 2);

    await client.close();
    await server.close();
  });
});

async function startMockServer(
  onConnection: (ws: WebSocket) => void | Promise<void>
) {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss.once("listening", resolve));
  const port = (wss.address() as { port: number }).port;
  process.env.DOUBAO_WS_URL_OVERRIDE = `ws://127.0.0.1:${port}`;

  wss.on("connection", (ws) => {
    void onConnection(ws);
  });

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        delete process.env.DOUBAO_WS_URL_OVERRIDE;
        wss.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function readSessionId(buf: Buffer): string | undefined {
  const eventId = buf.readUInt32BE(4);
  if (eventId < 100) return undefined;
  const sidLen = buf.readUInt32BE(8);
  return buf.subarray(12, 12 + sidLen).toString("utf8");
}

function serverJsonFrame(
  eventId: number,
  payload: Record<string, unknown>,
  sessionId?: string
) {
  const json = Buffer.from(JSON.stringify(payload));
  const chunks: Buffer[] = [Buffer.from([0x11, 0x94, 0x10, 0x00]), u32(eventId)];
  if (sessionId) {
    const sid = Buffer.from(sessionId, "utf8");
    chunks.push(u32(sid.length), sid);
  }
  chunks.push(u32(json.length), json);
  return Buffer.concat(chunks);
}

function serverAudioFrame(eventId: number, sessionId: string, audio: Buffer) {
  const sid = Buffer.from(sessionId, "utf8");
  return Buffer.concat([
    Buffer.from([0x11, 0xb4, 0x00, 0x00]),
    u32(eventId),
    u32(sid.length),
    sid,
    u32(audio.length),
    audio,
  ]);
}

function u32(value: number) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value, 0);
  return buf;
}
