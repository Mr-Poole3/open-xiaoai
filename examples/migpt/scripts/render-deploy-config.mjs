/**
 * Render config.ts on VPS (no tsx required).
 * Usage: DOUBAO_APP_ID=... DOUBAO_ACCESS_KEY=... node scripts/render-deploy-config.mjs
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const required = ["DOUBAO_APP_ID", "DOUBAO_ACCESS_KEY"];

for (const key of required) {
  if (!process.env[key]?.trim()) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
}

const keywords = (process.env.MIGPT_CALL_AI_KEYWORDS ?? "请,你")
  .split(",")
  .map((s) => s.trim());

const config = `import type { OpenXiaoAIConfig } from "./migpt/xiaoai.js";

export const kOpenXiaoAIConfig: OpenXiaoAIConfig = {
  provider: "doubao",
  doubao: {
    appId: ${JSON.stringify(process.env.DOUBAO_APP_ID)},
    accessKey: ${JSON.stringify(process.env.DOUBAO_ACCESS_KEY)},
    model: ${JSON.stringify(process.env.DOUBAO_MODEL ?? "1.2.1.1")},
    speaker: ${JSON.stringify(process.env.DOUBAO_SPEAKER ?? "zh_female_xiaohe_jupiter_bigtts")},
    botName: ${JSON.stringify(process.env.DOUBAO_BOT_NAME ?? "Cooper")},
    speakingStyle: ${JSON.stringify(
      process.env.DOUBAO_SPEAKING_STYLE ??
        "回答简洁口语化，每次不超过三句话，适合语音播报。性格开朗活泼，像台湾校园剧女主角，说话大方自然、温暖有元气，偶尔带点俏皮。"
    )},
    memoryFile: ${JSON.stringify(process.env.DOUBAO_MEMORY_FILE ?? "./doubao-memory.md")},
    enableWebSearch: false,
    strictAudit: true,
    auditResponse: ${JSON.stringify(process.env.DOUBAO_AUDIT_RESPONSE ?? "哎呀这个我不能说啦～我们聊点别的吧！")},
  },
  prompt: {
    system: ${JSON.stringify(
      process.env.MIGPT_SYSTEM_PROMPT ??
        "你是 Cooper，家里小爱音箱上的 AI 助手，开朗活泼，像台湾校园剧里的高中女生。"
    )},
  },
  context: {
    historyMaxLength: Number(process.env.MIGPT_HISTORY_MAX ?? "10"),
  },
  callAIKeywords: ${JSON.stringify(keywords)},
};
`;

writeFileSync(resolve(process.cwd(), "config.ts"), config, "utf8");
console.log("Wrote config.ts");
