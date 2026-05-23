/** Doubao Realtime API event IDs (volc.speech.dialog). */

export const ClientEvent = {
  StartConnection: 1,
  FinishConnection: 2,
  StartSession: 100,
  FinishSession: 102,
  TaskRequest: 200,
  ChatTextQuery: 501,
} as const;

export const ServerEvent = {
  ConnectionStarted: 50,
  ConnectionFailed: 51,
  ConnectionFinished: 52,
  SessionStarted: 150,
  SessionFinished: 152,
  SessionFailed: 153,
  TTSResponse: 352,
  TTSEnded: 359,
  ChatTextQueryConfirmed: 553,
  DialogCommonError: 599,
} as const;

export const DOUBAO_WS_URL_DEFAULT =
  "wss://openspeech.bytedance.com/api/v3/realtime/dialogue";

export function getDoubaoWsUrl() {
  return process.env.DOUBAO_WS_URL_OVERRIDE ?? DOUBAO_WS_URL_DEFAULT;
}

export const DOUBAO_RESOURCE_ID = "volc.speech.dialog";

/** Fixed app key from official Realtime API docs. */
export const DOUBAO_APP_KEY = "PlgvMymc7f3tQnJ6";

export function isConnectEvent(eventId: number) {
  return (
    eventId === ClientEvent.StartConnection ||
    eventId === ClientEvent.FinishConnection ||
    eventId === ServerEvent.ConnectionStarted ||
    eventId === ServerEvent.ConnectionFailed ||
    eventId === ServerEvent.ConnectionFinished
  );
}

export function isSessionEvent(eventId: number) {
  return eventId >= 100 && eventId < 600;
}
