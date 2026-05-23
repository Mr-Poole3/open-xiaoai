export interface DoubaoConfig {
  appId: string;
  accessKey: string;
  model: string;
  speaker: string;
  botName: string;
  speakingStyle: string;
  memoryFile?: string;
  enableWebSearch: boolean;
  strictAudit: boolean;
  auditResponse: string;
}

export type FrameHandler = (frame: import("./protocol.js").DecodedFrame) => void;
