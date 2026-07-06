import { describe, expect, it } from "vitest";
import { getNotificationOptions } from "./notificationOptions";

describe("getNotificationOptions", () => {
  it("uses a persistent native timeout so app duration controls auto-dismiss", () => {
    expect(getNotificationOptions({ autoDismiss: true, durationMs: 45_000 })).toEqual({
      autoDismiss: true,
      durationMs: 45_000,
      timeoutType: "never",
    });
  });

  it("keeps notifications visible until dismissed when auto-dismiss is off", () => {
    expect(getNotificationOptions({ autoDismiss: false, durationMs: 45_000 })).toEqual({
      autoDismiss: false,
      durationMs: 45_000,
      timeoutType: "never",
    });
  });

  it("clamps configured durations to supported bounds", () => {
    expect(getNotificationOptions({ durationMs: 100 }).durationMs).toBe(1_000);
    expect(getNotificationOptions({ durationMs: 500_000 }).durationMs).toBe(300_000);
  });
});