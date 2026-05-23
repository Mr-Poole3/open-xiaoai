## V1 Status — Shipped (2026-05-23)

**V1 is complete and verified on OH2P (192.168.1.2).** Cooper 可通过原生「小爱同学 + 请/你…」稳定对话；打断后可 handoff 到小爱路线且不崩溃、不叠播。

### Delivered in V1

| Issue | Scope | Status |
|---|---|---|
| #2 | Speaker 裸流 RPC + `start_play`/`stop_play` | ✅ Shipped |
| #3 | 豆包 Realtime CLI / 协议模块 | ✅ Shipped |
| #4 | MiGPT 引擎接入 Cooper（人设 + MD 记忆 + K2 dialog_id） | ✅ Shipped |
| #5 | 应用层打断（stopPlay + cancelActive） | ✅ Shipped（简化版） |
| #6 | 会话健壮性（cancelActive、playbackSeq、重连） | ✅ Shipped |
| #7 | WakeRouter + P1 分路径（代码就绪） | ✅ Shipped（KWS 未部署，生产用原生唤醒） |

### V1 behavior (as built)

- **Cooper 入口**：「小爱同学，请/你 + …」→ `callAIKeywords` 匹配 → 豆包 xiaohe 裸流播放
- **米家保留**：无「请/你」前缀 → `super.onMessage` → 原生小爱
- **播放完整**：按已发送 PCM 字节数 drain，避免过早 `stopPlay` 截断
- **打断 + handoff**：Cooper 播放/drain 中收到 ASR final → `stopCooperPlayback`（含 `resetDialog` 当走小爱）→ 路由下一条；`cancelled` 不再导致进程崩溃
- **配置**：`provider: 'doubao'`，`config.example.ts` + 本地 `config.ts`

### Explicitly deferred to V2

| Issue | Original scope | V1 decision |
|---|---|---|
| #8 | 同步打断 + blocking「我在」wav + `awaitingFollowup` | 不做了；V1 仅 stop + route |
| #9 | awaiting 双路径（Cooper 续聊 / 小爱 silent handoff） | 部分：小爱 handoff 已通；Cooper 续聊同 dialog 未做 |
| #10 | 10s 沉默 + 追问 wav + 全量清理 | 未实现 |
| #7 KWS | 「库珀库珀」/ hi cooper 音箱端 KWS | 代码在，用户选择关闭，继续用「小爱同学」 |

---

## Problem Statement

MiGPT 集成在小爱音箱上运行时，LLM 回复通过小爱原生 TTS 服务（`mibrain text_to_speech`）播放。原生唤醒词检测系统（`mico_aivs_lab`）与 TTS 服务相互独立、互不协调。当 LLM 正在播放长回复时，用户再次说「小爱同学」，原生系统会立即响应「哎」，与 LLM 音频同时输出，造成严重的音频冲突。

此外，MiGPT 示例虽已具备裸音频播放通道（`on_output_data` → WebSocket `play` stream → Client 端 `AudioPlayer`），但当前引擎的 `_response` 路径仍走原生 TTS，该通道未被使用。Client 端 `AudioPlayer` 还依赖先调用 `start_play` RPC 才能接收音频流，MiGPT Server 端未暴露此能力。

## Solution

在 MiGPT 示例中接入豆包 Realtime API（O2.0 + xiaohe 音色），AI 助手名为 **Cooper**，人设为**开朗活泼的台剧高中女生**（大方、自然、有元气）。

采用「保留原生 ASR + 豆包 ChatTextQuery 文本输入 + 裸音频流输出」架构（路径 B + B1）。LLM 回复音频通过 24 kHz PCM 裸流直接写入音箱 ALSA 设备，完全绕过原生 TTS，从根上消除音频通道冲突。

**V1 唤醒**：生产使用原生「小爱同学」+ `callAIKeywords`（「请」「你」）。KWS「库珀库珀」代码已实现（#7），可选部署，V1 未启用。

**分路径路由（P1）**：KWS 唤醒后跳过 keywords；原生唤醒仍走 keywords，米家命令不受影响。

**记忆策略（K2 + L1）**：同一次唤醒周期内复用 `dialog_id`；MD 文件注入 `system_role`。

**V1 打断**：Cooper 播放中用户说话 → `stopPlay` + `cancelActiveSession`；走小爱时 `resetDialog` + 原生路由。不含「我在」应答状态机。

保留 OpenAI 配置，`provider: 'doubao' | 'openai'`，默认 `'doubao'`。

## User Stories

### V1 — Done

1. As a 小爱音箱用户, I want Cooper 用豆包 xiaohe 音色回复, so that 语音自然且不走原生 TTS 冲突路径。 ✅
2. As a 小爱音箱用户, I want 说「小爱同学，请讲个故事」触发 Cooper 对话, so that 我能在保留米家的同时使用自定义 AI。 ✅
5. As a 小爱音箱用户, I want 说「打开客厅灯」仍由原生小爱处理, so that 米家设备控制不受影响。 ✅
6. As a 小爱音箱用户, I want Cooper 说话风格像台剧开朗高中女生, so that 互动有角色感。 ✅
7. As a 小爱音箱用户, I want Cooper 回复简洁（不超过三句话）, so that 适合音箱语音播报。 ✅
8. As a 小爱音箱用户, I want LLM 播放期间打断后能切换路线, so that 不会叠播或崩溃。 ✅（简化）
10–25. 开发者故事（协议模块、RPC、重连、config、provider 等）— ✅ 见 #2–#6

### V2 — Backlog

3. As a 小爱音箱用户, I want 说「库珀库珀」也能唤醒 Cooper (#7 KWS 部署)
4. As a 小爱音箱用户, I want KWS 唤醒后无需加「请」字
9. As a 小爱音箱用户, I want 同一次唤醒内追问且 Cooper 记得上下文 (#9 awaiting 续聊)
8. As a 小爱音箱用户, I want 打断后听到「我在」并进入 awaiting (#8)
10. As a 小爱音箱用户, I want 沉默超时追问「还有什么事吗？」(#10)

## Implementation Decisions

### Architecture (V1 shipped)

- **路径 B + B1**：原生 ASR + ChatTextQuery + 24 kHz 裸流
- **路径 D1（V1）**：`stopCooperPlayback` — stopPlay + cancelActive；小爱 handoff 时 resetDialog
- **路径 E1 / F1 / G1 / I1 / K2 + L1 / P1**：均已落地
- **PlaybackOrchestrator**：`playing` / `draining` / `idle`；`playingAck` / `awaitingFollowup` 预留给 V2

### V1 modules

1. **Doubao Protocol / Client / Session** — 编解码、长连接、K2 session、cancelActive
2. **OpenXiaoAIEngine** — Cooper 路由、playDoubaoReply、handoff 到小爱
3. **WakeRouter** — native vs kws 来源（KWS 可选）
4. **PlaybackOrchestrator** — 播放阶段跟踪（V2 扩展 awaiting）

### Interrupt / handoff (V1)

```
Cooper 播放或 drain 中 → ASR is_final
  → stopCooperPlayback({ resetDialog: !routeToCooper })
  → onMessage → Cooper 或 super.onMessage(小爱)
```

小爱路线前必须 `stopPlay`，避免裸流叠播。`DOUBAO_CANCELLED` 在 session 层捕获，避免未处理异常退出。

### Config Schema

不变 — 见原文；`callAIKeywords: ['请', '你']` 仅 native 路径生效。

## Testing Decisions

**V1 已验证（手动 E2E）**

- 「小爱同学，请讲解黑洞」→ Cooper 完整播放
- 「小爱同学，打开卧室灯」→ 原生小爱
- Cooper 播放中打断 → 小爱命令不崩溃、Cooper 音频停止

**自动化**：14 项单元测试（protocol、session、wake-router、orchestrator）

## Out of Scope

V1 不变；另 V2 才做：awaiting 状态机、沉默追问 wav、KWS 生产部署、Cooper 打断后「我在」。

## Further Notes

- 音箱 OH2P `192.168.1.2`；MiGPT `pnpm start` @ `examples/migpt`
- 子 issue #2–#7 已关闭；#8–#10 原规格降级为 V2 backlog（issue 已关闭，以本 PRD 为准）
- API 密钥仅本地 `config.ts`，勿提交
