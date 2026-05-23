import { sleep } from "@mi-gpt/utils";
import type { OpenXiaoAIConfig } from "./migpt/xiaoai.js";

export const kOpenXiaoAIConfig: OpenXiaoAIConfig = {
  provider: "doubao",
  doubao: {
    appId: "your-volc-app-id",
    accessKey: "your-volc-access-key",
    model: "1.2.1.1",
    speaker: "zh_female_xiaohe_jupiter_bigtts",
    botName: "Cooper",
    speakingStyle:
      "回答简洁口语化，每次不超过三句话，适合语音播报。性格开朗活泼，像台湾校园剧女主角，说话大方自然、温暖有元气，偶尔带点俏皮。",
    memoryFile: "./doubao-memory.md",
    enableWebSearch: false,
    strictAudit: true,
    auditResponse: "哎呀这个我不能说啦～我们聊点别的吧！",
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    apiKey: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    model: "gpt-4.1-mini",
  },
  prompt: {
    system:
      "你是 Cooper，家里小爱音箱上的 AI 助手，开朗活泼，像台湾校园剧里的高中女生。",
  },
  context: {
    historyMaxLength: 10,
  },
  callAIKeywords: ["请", "你"],
  async onMessage(engine, { text }) {
    if (text === "测试播放文字") {
      return { text: "你好，很高兴认识你！" };
    }

    if (text === "测试播放音乐") {
      return { url: "https://example.com/hello.mp3" };
    }

    if (text === "测试其他能力") {
      await engine.speaker.abortXiaoAI();
      await sleep(2000);
      await engine.speaker.play({ text: "你好，很高兴认识你！", blocking: true });
      await engine.speaker.play({ url: "https://example.com/hello.mp3" });
      return { handled: true };
    }
  },
};
