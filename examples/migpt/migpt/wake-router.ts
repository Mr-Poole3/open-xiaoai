export type WakeSource = "native" | "kws" | null;

/** KWS monitor triggers ubus wake right after keyword; ignore native VAD in this window. */
const KWS_NATIVE_GRACE_MS = 4_000;

export class WakeRouter {
  lastWakeSource: WakeSource = null;
  private kwsWakeAt = 0;

  onKwsKeyword(_keyword: string) {
    this.lastWakeSource = "kws";
    this.kwsWakeAt = Date.now();
  }

  onNativeVadBegin() {
    if (Date.now() - this.kwsWakeAt < KWS_NATIVE_GRACE_MS) {
      return;
    }
    this.lastWakeSource = "native";
  }

  shouldRouteToCooper(text: string, keywords: string[] = []) {
    if (this.lastWakeSource === "kws") {
      return true;
    }
    return keywords.some((k) => text.startsWith(k));
  }

  consumeWake() {
    this.lastWakeSource = null;
    this.kwsWakeAt = 0;
  }
}
