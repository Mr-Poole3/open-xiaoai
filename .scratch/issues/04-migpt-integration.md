## Parent

#1

## What to build

Wire Doubao into MiGPT end-to-end. Extend OpenXiaoAIEngine to override askAI and _response when provider is doubao (default). On native wake + callAIKeywords match, abort native service, query Doubao via ChatTextQuery, and play response through raw audio at 24 kHz.

Configure Cooper persona in config.ts: botName Cooper, speakingStyle (cheerful Taiwanese-drama high school girl, max 3 sentences), system_role from prompt.system + manually-edited MD memory file (L1), strict audit with custom audit_response. K2 session: new dialog/session per wake-up, multi-turn within one wake.

Keep OpenAI path via provider switch. Provide config.example.ts without secrets. Mi Home commands via native wake without keyword match remain untouched.

## Acceptance criteria

- [ ] Saying「小爱同学，请讲个故事」on speaker produces Cooper xiaohe voice reply via Doubao, not native TTS
- [ ] Saying「小爱同学，打开客厅灯」still handled by native XiaoAI (MiGPT silent)
- [ ] provider: 'openai' still works with existing OpenAI path
- [ ] config.ts doubao section includes botName, speakingStyle, memoryFile, enableWebSearch (false)
- [ ] MD memory file content appears in Cooper's knowledge (verify with a fact only in MD)
- [ ] Within one wake-up, follow-up question references prior turn (K2)

## Blocked by

- #3 (Doubao CLI voice path must work first)
