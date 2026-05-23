## Implementation started

P1 Wake Router + MiGPT routing wired:

- `migpt/wake-router.ts`: tracks `lastWakeSource` (`native` | `kws`), KWS grace window for ubus VAD
- `migpt/xiaoai.ts`: kws event → `onKwsKeyword`; `is_vad_begin` → `onNativeVadBegin`; ASR routing via `shouldRouteToCooper`
- `migpt/wake-router.test.ts`: unit tests for both paths
- `examples/kws/keywords-cooper.example.txt`: ready-to-deploy token line for「库珀库珀」

### Speaker deploy (do not create reply.txt)

```bash
mkdir -p /data/open-xiaoai/kws
# append or replace keywords.txt with the Cooper line from keywords-cooper.example.txt
curl -sSfL https://gitee.com/idootop/artifacts/releases/download/open-xiaoai-kws/init.sh | sh
```

### E2E to confirm

- [ ]「库珀库珀」→ log shows kws + default 哎/在
- [ ]「库珀库珀，讲个故事」→ Cooper without「请」
- [ ]「小爱同学，请讲个故事」→ Cooper via keywords
- [ ]「小爱同学，打开客厅灯」→ native only (MiGPT silent)
