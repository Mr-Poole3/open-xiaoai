import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WakeRouter } from "./wake-router.js";

describe("WakeRouter", () => {
  it("routes KWS wake ASR directly to Cooper without keywords", () => {
    const router = new WakeRouter();
    router.onKwsKeyword("库珀库珀");
    assert.equal(router.shouldRouteToCooper("讲个故事", ["请", "你"]), true);
  });

  it("requires callAIKeywords for native wake", () => {
    const router = new WakeRouter();
    router.onNativeVadBegin();
    assert.equal(router.shouldRouteToCooper("请讲个故事", ["请", "你"]), true);
    assert.equal(router.shouldRouteToCooper("打开客厅灯", ["请", "你"]), false);
  });

  it("does not override KWS wake with native VAD in grace window", () => {
    const router = new WakeRouter();
    router.onKwsKeyword("库珀库珀");
    router.onNativeVadBegin();
    assert.equal(router.lastWakeSource, "kws");
    assert.equal(router.shouldRouteToCooper("讲个故事", ["请", "你"]), true);
  });

  it("consumeWake clears routing state", () => {
    const router = new WakeRouter();
    router.onKwsKeyword("库珀库珀");
    router.consumeWake();
    assert.equal(router.lastWakeSource, null);
    assert.equal(router.shouldRouteToCooper("讲个故事", ["请", "你"]), false);
  });
});
