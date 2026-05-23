import { isConnectEvent, isSessionEvent } from "./events.js";

const HEADER_SIZE = 4;
const MSG_FULL_CLIENT = 0x1;
const MSG_FULL_SERVER = 0x9;
const MSG_AUDIO_SERVER = 0xb;
const MSG_ERROR = 0xf;
const FLAG_HAS_EVENT = 0x4;
const SERIAL_JSON = 0x1;
const SERIAL_RAW = 0x0;

export interface DecodedFrame {
  messageType: number;
  eventId?: number;
  sessionId?: string;
  payload: Buffer;
  isAudio: boolean;
}

function writeHeader(messageType: number, flags: number, serialization: number) {
  const header = Buffer.alloc(HEADER_SIZE);
  header[0] = 0x11;
  header[1] = (messageType << 4) | (flags & 0xf);
  header[2] = (serialization << 4) & 0xf0;
  header[3] = 0;
  return header;
}

/** Encode a JSON client event frame. */
export function encodeJsonEvent(
  eventId: number,
  payload: Record<string, unknown> = {},
  sessionId?: string
): Buffer {
  const payloadBuf = Buffer.from(JSON.stringify(payload), "utf8");
  const chunks: Buffer[] = [
    writeHeader(MSG_FULL_CLIENT, FLAG_HAS_EVENT, SERIAL_JSON),
    u32(eventId),
  ];

  if (sessionId !== undefined) {
    const sid = Buffer.from(sessionId, "utf8");
    chunks.push(u32(sid.length), sid);
  }

  chunks.push(u32(payloadBuf.length), payloadBuf);
  return Buffer.concat(chunks);
}

export function decodeFrame(buffer: Buffer): DecodedFrame {
  if (buffer.length < HEADER_SIZE + 4) {
    throw new Error("frame too short");
  }

  const messageType = (buffer[1]! >> 4) & 0xf;
  const flags = buffer[1]! & 0xf;
  const serialization = (buffer[2]! >> 4) & 0xf;

  let offset = HEADER_SIZE;
  let eventId: number | undefined;

  if (flags & FLAG_HAS_EVENT) {
    eventId = buffer.readUInt32BE(offset);
    offset += 4;

    if (eventId !== undefined && isSessionEvent(eventId) && !isConnectEvent(eventId)) {
      const sessionLen = buffer.readUInt32BE(offset);
      offset += 4;
      if (sessionLen > 0) {
        const sessionId = buffer.subarray(offset, offset + sessionLen).toString("utf8");
        offset += sessionLen;
        return finishDecode(messageType, serialization, eventId, sessionId, buffer, offset);
      }
    }
  }

  return finishDecode(messageType, serialization, eventId, undefined, buffer, offset);
}

function finishDecode(
  messageType: number,
  serialization: number,
  eventId: number | undefined,
  sessionId: string | undefined,
  buffer: Buffer,
  offset: number
): DecodedFrame {
  if (offset + 4 > buffer.length) {
    throw new Error("missing payload size");
  }
  const payloadSize = buffer.readUInt32BE(offset);
  offset += 4;
  const payload = buffer.subarray(offset, offset + payloadSize);

  const isAudio =
    messageType === MSG_AUDIO_SERVER ||
    (messageType === MSG_FULL_SERVER && serialization === SERIAL_RAW);

  if (messageType === MSG_ERROR) {
    throw new Error(`doubao error frame: ${payload.toString("utf8")}`);
  }

  return { messageType, eventId, sessionId, payload, isAudio };
}

export function parseJsonPayload<T = Record<string, unknown>>(payload: Buffer): T {
  if (payload.length === 0) return {} as T;
  return JSON.parse(payload.toString("utf8")) as T;
}

function u32(value: number) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value, 0);
  return buf;
}

export const ProtocolConstants = {
  MSG_FULL_SERVER,
  MSG_AUDIO_SERVER,
};
