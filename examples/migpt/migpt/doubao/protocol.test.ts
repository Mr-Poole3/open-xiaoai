import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ClientEvent, ServerEvent } from "./events.js";
import {
  decodeFrame,
  encodeJsonEvent,
  parseJsonPayload,
} from "./protocol.js";

describe("doubao protocol", () => {
  it("encodes StartConnection matching official byte example", () => {
    const frame = encodeJsonEvent(ClientEvent.StartConnection, {});
    assert.deepEqual([...frame], [
      17, 20, 16, 0, 0, 0, 0, 1, 0, 0, 0, 2, 123, 125,
    ]);
  });

  it("round-trips StartSession client frame structure", () => {
    const sessionId = "75a6126e-427f-49a1-a2c1-621143cb9db3";
    const payload = {
      dialog: { bot_name: "豆包", dialog_id: "", extra: null },
    };
    const frame = encodeJsonEvent(ClientEvent.StartSession, payload, sessionId);
    assert.equal(frame[0], 0x11);
    assert.equal((frame[1]! >> 4) & 0xf, 0x1);
    assert.equal(frame[1]! & 0xf, 0x4);
    assert.equal(frame.readUInt32BE(4), ClientEvent.StartSession);
    const sidLen = frame.readUInt32BE(8);
    assert.equal(frame.subarray(12, 12 + sidLen).toString("utf8"), sessionId);
  });

  it("decodes ConnectionStarted server JSON frame", () => {
    const json = Buffer.from("{}");
    const frame = Buffer.alloc(12 + json.length);
    frame[0] = 0x11;
    frame[1] = 0x94;
    frame[2] = 0x10;
    frame[3] = 0;
    frame.writeUInt32BE(ServerEvent.ConnectionStarted, 4);
    frame.writeUInt32BE(json.length, 8);
    json.copy(frame, 12);

    const decoded = decodeFrame(frame);
    assert.equal(decoded.eventId, ServerEvent.ConnectionStarted);
    assert.equal(decoded.isAudio, false);
    assert.deepEqual(parseJsonPayload(decoded.payload), {});
  });

  it("decodes TTSResponse audio-only server frame", () => {
    const sessionId = "3c791a7d-227a-4446-993b-24f9e302cc98";
    const audio = Buffer.from([1, 2, 3, 4]);
    const sidBuf = Buffer.from(sessionId, "utf8");
    const frame = Buffer.concat([
      Buffer.from([0x11, 0xb4, 0x00, 0x00]),
      u32(ServerEvent.TTSResponse),
      u32(sidBuf.length),
      sidBuf,
      u32(audio.length),
      audio,
    ]);

    const decoded = decodeFrame(frame);
    assert.equal(decoded.eventId, ServerEvent.TTSResponse);
    assert.equal(decoded.sessionId, sessionId);
    assert.equal(decoded.isAudio, true);
    assert.deepEqual(decoded.payload, audio);
  });
});

function u32(value: number) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value, 0);
  return buf;
}
