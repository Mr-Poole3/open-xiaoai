/**
 * Stop custom KWS on the connected speaker and restore native 小爱同学 wake only.
 *
 * Usage: pnpm build && tsx scripts/disable-kws.ts
 */
import { sleep } from "@mi-gpt/utils";
import { RustServer } from "../migpt/open-xiaoai.js";
import { OpenXiaoAISpeaker } from "../migpt/speaker.js";

const WAIT_FOR_CLIENT_MS = Number(process.env.WAIT_MS ?? 12_000);

(global as any).RUST_CALLBACKS = {
  on_event: () => {},
  on_input_data: () => {},
};

async function run(cmd: string) {
  const res = await OpenXiaoAISpeaker.runShell(cmd, { timeout: 15_000 });
  console.log(`$ ${cmd}`);
  console.log(res?.stdout?.trim() || res?.stderr?.trim() || "(no output)");
  return res;
}

async function main() {
  console.log("✅ 启动 Server，等待音箱 Client 连接...");
  await RustServer.start();
  await sleep(WAIT_FOR_CLIENT_MS);

  await run("killall kws 2>/dev/null; killall monitor 2>/dev/null; true");
  await run(
    "if grep -q open-xiaoai-kws /data/init.sh 2>/dev/null; then curl -L -o /data/init.sh https://gitee.com/idootop/artifacts/releases/download/open-xiaoai-client/boot.sh && echo RESTORED_CLIENT_BOOT; else echo CLIENT_BOOT_OK; fi"
  );
  await run(
    "ps | grep -E 'kws/(kws|monitor)' | grep -v grep || echo KWS_STOPPED"
  );
  await run("test -f /data/open-xiaoai/server.txt && cat /data/open-xiaoai/server.txt");

  console.log("\n✅ 自定义 KWS 已关闭。请使用「小爱同学 + 请/你…」唤醒 Cooper。");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
