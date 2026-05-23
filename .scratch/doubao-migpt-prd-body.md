## Problem Statement

MiGPT 集成在小爱音箱上运行时，LLM 回复通过小爱原生 TTS 服务（`mibrain text_to_speech`）播放。原生唤醒词检测系统（`mico_aivs_lab`）与 TTS 服务相互独立、互不协调。当 LLM 正在播放长回复时，用户再次说「小爱同学」，原生系统会立即响应「哎」，与 LLM 音频同时输出，造成严重的音频冲突。

此外，MiGPT 示例虽已具备裸音频播放通道（`on_output_data` → WebSocket `play` stream → Client 端 `AudioPlayer`），但当前引擎的 `_response` 路径仍走原生 TTS，该通道未被使用。Client 端 `AudioPlayer` 还依赖先调用 `start_play` RPC 才能接收音频流，MiGPT Server 端未暴露此能力。

## Solution

在 MiGPT 示例中接入豆包 Realtime API（O2.0 + xiaohe 音色），AI 助手名为 **Cooper**，人设为**开朗活泼的台剧高中女生**（大方、自然、有元气）。

采用「保留原生 ASR + 豆包 ChatTextQuery 文本输入 + 裸音频流输出」架构（路径 B + B1）。LLM 回复音频通过 24 kHz PCM 裸流直接写入音箱 ALSA 设备，完全绕过原生 TTS，从根上消除音频通道冲突。

**双唤醒并存（N4）**：保留原生「小爱同学」唤醒（米家控制等），同时部署 KWS 自定义唤醒词「库珀库珀」触发 Cooper 对话。KWS 欢迎语保持默认（「哎」「在」）。

**分路径路由（P1）**：KWS「库珀库珀」唤醒后的下一条 ASR 跳过 `callAIKeywords`，直接进入 Cooper；原生「小爱同学」唤醒仍走 keywords 过滤，米家命令不受影响。

**记忆策略（K2 + L1）**：每次唤醒新建豆包 session（K2，同一次唤醒内可追问）；用户手动维护 MD 文件作为长久记忆，启动 session 时拼入 `system_role`（L1）。

同时实现应用层打断机制（D1）：播放期间监听 `is_vad_begin` 唤醒事件，触发 `stop_play`、豆包 `FinishSession` 和 `abortXiaoAI`。

保留 OpenAI 配置，通过 `config.ts` 的 `provider` 开关（`'doubao' | 'openai'`）切换，默认 `'doubao'`。

## User Stories

1. As a 小爱音箱用户, I want Cooper 用豆包 xiaohe 音色回复, so that 语音自然且不走原生 TTS 冲突路径。
2. As a 小爱音箱用户, I want 说「小爱同学，请讲个故事」触发 Cooper 对话, so that 我能在保留米家的同时使用自定义 AI。
3. As a 小爱音箱用户, I want 说「库珀库珀」也能唤醒 Cooper, so that 我有专属唤醒词。
4. As a 小爱音箱用户, I want 说「库珀库珀，讲个故事」无需加「请」字, so that 对 Cooper 说话更自然。
5. As a 小爱音箱用户, I want 说「打开客厅灯」仍由原生小爱处理, so that 米家设备控制不受影响。
6. As a 小爱音箱用户, I want Cooper 说话风格像台剧开朗高中女生, so that 互动有角色感。
7. As a 小爱音箱用户, I want Cooper 回复简洁（不超过三句话）, so that 适合音箱语音播报。
8. As a 小爱音箱用户, I want LLM 播放期间再说唤醒词能立即打断, so that 不会出现「哎」和 LLM 音频同时播放。
9. As a 小爱音箱用户, I want 同一次唤醒内可以追问, so that Cooper 记得刚才聊的内容。
10. As a 开发者, I want 手动维护 MD 文件作为 Cooper 的长久记忆, so that 跨 session 的背景知识可控。
11. As a 开发者, I want 豆包 WebSocket 长连接复用（G1）, so that 连续对话延迟更低。
12. As a 开发者, I want 每次唤醒新建 dialog_id/session（K2）, so that 不同唤醒之间上下文不污染。
13. As a 开发者, I want 豆包凭证和 Cooper 人设集中在 config.ts, so that 部署简单。
14. As a 开发者, I want provider 开关保留 OpenAI 路径, so that 未来可切回纯文字 LLM。
15. As a 开发者, I want 24 kHz PCM 直送 AudioPlayer（E1）, so that 无需重采样。
16. As a 开发者, I want Server 暴露 start_play/stop_play RPC, so that 播放生命周期可控。
17. As a 开发者, I want 豆包协议封装为独立可测模块, so that 编解码稳定。
18. As a 开发者, I want WebSocket 断线自动重连, so that 长时间运行可靠。
19. As a 开发者, I want OpenXiaoAIEngine 子类 override askAI/_response（F1）, so that 不改 node_modules。
20. As a 开发者, I want lastWakeSource 分路径路由（P1）, so that KWS 和原生唤醒行为不同。
21. As a 开发者, I want KWS 部署在音箱 Client 端（库珀库珀）, so that 无需 Server 端大模型 KWS。
22. As a 开发者, I want v1 关闭豆包联网（S3）但 config 预留开关, so that 后续可开 weather 等能力。
23. As a 开发者, I want 严格内容审核 + Cooper 风格拒答话术（T3）, so that 安全且符合人设。
24. As a 小爱音箱用户, I want 音箱开机 Client 自启动连 Server, so that 无需手动 SSH。
25. As a 开发者, I want 不修改 packages/client-rust Client 二进制, so that 音箱无需重编译。

## Implementation Decisions

### Architecture

- **路径 B + B1**：保留原生 ASR，豆包 `ChatTextQuery` + 裸流播放。
- **路径 D1**：应用层打断（`is_vad_begin` → stop_play + FinishSession + abortXiaoAI）。
- **路径 E1**：pcm_s16le 24 kHz，不重采样。
- **路径 F1**：OpenXiaoAIEngine 子类 override + `migpt/doubao/` 模块。
- **路径 G1**：WebSocket 长连接复用。
- **路径 I1**：provider 开关，默认 doubao，OpenAI 保留。
- **K2 + L1**：单次唤醒 session 记忆 + MD 长久记忆注入 system_role。
- **N4 + P1**：双唤醒 + 分路径 keywords 路由。
- **分阶段**：Phase 1 豆包播放；Phase 2 D1 打断；Phase 3 KWS 库珀库珀 + P1 路由。

### Cooper Persona（M2 三字段）

| 字段 | 值 |
|---|---|
| `botName` | `"Cooper"` |
| `speakingStyle` | 回答简洁口语化，每次不超过三句话，适合语音播报。性格开朗活泼，像台湾校园剧女主角，说话大方自然、温暖有元气，偶尔带点俏皮。 |
| `system_role` | `config.prompt.system` + `\n\n` + `read(config.doubao.memoryFile)` |
| `strict_audit` | `true` |
| `audit_response` | `"哎呀这个我不能说啦～我们聊点别的吧！"` |
| `enableWebSearch` | `false`（v1 关闭，config 预留） |

### Deep Modules

1. **Doubao Protocol Module** — 二进制 WebSocket 帧编解码。
2. **Doubao Client Module** — 连接生命周期、重连、StartConnection/FinishConnection。
3. **Doubao Session Module** — StartSession（O2.0, xiaohe, 24kHz）→ ChatTextQuery → TTSResponse 音频流 → FinishSession；K2 每次唤醒新 session/dialog_id。
4. **Playback Controller Module** — startPlay(24000) → on_output_data → stopPlay；D1 加 interrupt()。
5. **Wake Router Module** — 维护 `lastWakeSource: 'native' | 'kws'`；决定 ASR 是否跳过 callAIKeywords。

### Engine Integration

- `askAI()`：provider=doubao 时走 Doubao Session。
- `_response()`：bytes stream → startPlay → play({bytes}) → stopPlay。
- `onEvent()`：kws 事件 → lastWakeSource='kws'；is_vad_begin → lastWakeSource='native'；D1 阶段 is_vad_begin 触发 interrupt()。
- `onMessage()` 路由：lastWakeSource='kws' 时跳过 callAIKeywords；'native' 时仍检查 keywords。

### Config Schema

```
provider: 'doubao' | 'openai'  (default: 'doubao')

doubao: {
  appId, accessKey,
  model: '1.2.1.1',
  speaker: 'zh_female_xiaohe_jupiter_bigtts',
  botName: 'Cooper',
  speakingStyle: '...',
  memoryFile: './doubao-memory.md',
  enableWebSearch: false,
  strictAudit: true,
  auditResponse: '哎呀这个我不能说啦～我们聊点别的吧！',
}

prompt: { system: '...' }
openai: { ... }  (保留)
callAIKeywords: ['请', '你']  (仅 native 唤醒路径生效)
```

凭证存于 config.ts。MD 记忆文件由用户手动编辑。system_role + speakingStyle 总长不超过 4000 字符。

### Message Flow — 原生唤醒（小爱同学）

```
「小爱同学」→ is_vad_begin → lastWakeSource='native'
→ ASR "请讲个故事" → callAIKeywords 匹配
→ abortXiaoAI() → StartSession → ChatTextQuery
→ start_play(24000) → TTSResponse → on_output_data → stop_play → FinishSession
```

### Message Flow — KWS 唤醒（库珀库珀）

```
「库珀库珀」→ KWS 事件 → lastWakeSource='kws' → 默认欢迎语（哎/在）
→ ASR "讲个故事" → 跳过 callAIKeywords
→ abortXiaoAI() → StartSession → ChatTextQuery → 裸流播放 → FinishSession
```

### Interrupt Flow（Phase 2）

```
播放中 → is_vad_begin（无 text）
→ stop_play() → FinishSession() → abortXiaoAI()
```

### KWS Deployment

- 音箱路径：`/data/open-xiaoai/kws/keywords.txt` 含「库珀库珀」
- `reply.txt` 保持默认（「哎」「在」），不自定义 Cooper 问候
- MiGPT 监听 Client 端 `kws` 事件（已有 onEvent 钩子，需扩展业务逻辑）
- 参考 `examples/kws/` 部署流程；OH2P 支持 Client 端 KWS

### Mi Home Preservation

- 「小爱同学 + 打开客厅灯」→ callAIKeywords 不匹配 → MiGPT 静默 → 原生 NLP 处理。
- 「库珀库珀 + 打开客厅灯」→ 走 Cooper（v1 可接受；后续可加 blocklist）。

### Planned Issue Slices

1. Speaker 裸流播放 RPC
2. 豆包 CLI 语音输出
3. MiGPT 引擎接入豆包（含 Cooper 人设 config）
4. D1 播放中打断
5. 连续对话与会话健壮性
6. KWS 库珀库珀 + P1 分路径路由

## Testing Decisions

**原则**：只测外部行为，不测实现细节。

### 要测的模块

1. Doubao Protocol — 帧编解码 round-trip
2. Doubao Session — mock WebSocket，TTSResponse 流，K2 session 生命周期
3. Playback Controller — startPlay/stopPlay/interrupt 调用顺序
4. Wake Router — kws/native 来源决定是否跳过 keywords

### 手动集成测试

- 「小爱同学，请XXX」→ Cooper xiaohe 音色
- 「库珀库珀，XXX」→ 无需「请」字
- 「小爱同学，打开客厅灯」→ 米家正常
- 长回复中唤醒 → 立即打断

## Out of Scope

- 豆包全音频管道（TaskRequest）
- Realtime ASRInfo 服务端 VAD 打断
- 音频重采样 / OGG Opus 解码
- 英文唤醒词 "Cooper"（Client KWS 仅支持中文，使用「库珀库珀」）
- 替换/禁用原生「小爱同学」唤醒
- Server 端 KWS（xiaozhi 路线）
- packages/client-rust Client 重编译
- v1 豆包内置联网（config 已预留）
- Docker 镜像更新

## Further Notes

- 音箱：OH2P，IP 192.168.1.2；Mac Server：192.168.1.23:4399；Client 已配置 boot.sh 自启动。
- 豆包 API 文档：仓库根目录 `豆包 realtime 模型接入文档.md`。
- config.ts 含 API 密钥，勿提交 git；提供 config.example.ts。
- MD 记忆文件示例：`doubao-memory.md`，用户手动维护 Cooper 的长久背景知识。
- bot_name（Cooper）≠ 唤醒词（库珀库珀）；两者独立配置。
