## Parent

#1

## What to build

Deploy Client-side KWS wake word「库珀库珀」on the speaker alongside native「小爱同学」(N4). Keep default KWS reply.txt (「哎」「在」). Extend MiGPT to handle kws events and implement split routing (P1): track lastWakeSource as native or kws; after KWS wake, next ASR final bypasses callAIKeywords and goes directly to Cooper; after native wake, callAIKeywords still apply so Mi Home works.

Reference examples/kws/ deployment. MiGPT onEvent already receives kws events — add routing logic and Wake Router module.

## Acceptance criteria

- [ ]「库珀库珀」on speaker triggers KWS detection (verify via Server log or reply)
- [ ]「库珀库珀，讲个故事」produces Cooper reply without needing「请」prefix
- [ ]「小爱同学，请讲个故事」still works via keywords path
- [ ]「小爱同学，打开客厅灯」still handled by native (MiGPT silent)
- [ ] KWS reply.txt uses default welcome (not custom Cooper greeting)

## Blocked by

- #4 (MiGPT Doubao integration must work first)
