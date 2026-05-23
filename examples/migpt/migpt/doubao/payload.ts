import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DoubaoConfig } from "./types.js";

export function buildSystemRole(
  basePrompt: string,
  memoryFile?: string
): string {
  if (!memoryFile) return basePrompt;
  try {
    const memory = readFileSync(resolve(memoryFile), "utf8").trim();
    if (!memory) return basePrompt;
    return `${basePrompt}\n\n${memory}`;
  } catch {
    return basePrompt;
  }
}

export function buildStartSessionPayload(
  config: DoubaoConfig,
  systemRole: string,
  dialogId?: string
): Record<string, unknown> {
  return {
    tts: {
      speaker: config.speaker,
      audio_config: {
        channel: 1,
        format: "pcm_s16le",
        sample_rate: 24000,
      },
      extra: {},
    },
    asr: {
      extra: {},
    },
    dialog: {
      bot_name: config.botName,
      system_role: systemRole,
      speaking_style: config.speakingStyle,
      ...(dialogId ? { dialog_id: dialogId } : {}),
      extra: {
        input_mod: "text",
        model: config.model,
        strict_audit: config.strictAudit,
        audit_response: config.auditResponse,
        enable_volc_websearch: config.enableWebSearch,
      },
    },
  };
}
