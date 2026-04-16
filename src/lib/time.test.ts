import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDuration, taskAge, isQuietHours } from "./time";

describe("formatDuration", () => {
  it("formats sub-minute durations as seconds", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(59_999)).toBe("59s");
  });

  it("formats minute-range durations", () => {
    expect(formatDuration(60_000)).toBe("1m");
    expect(formatDuration(90_000)).toBe("1m");
    expect(formatDuration(2 * 60_000)).toBe("2m");
    expect(formatDuration(25 * 60_000)).toBe("25m");
  });

  it("formats hour-range durations", () => {
    expect(formatDuration(60 * 60_000)).toBe("1h 0m");
    expect(formatDuration(61 * 60_000)).toBe("1h 1m");
    expect(formatDuration(90 * 60_000)).toBe("1h 30m");
  });

  it("handles negative values using absolute value", () => {
    expect(formatDuration(-2 * 60_000)).toBe("2m");
  });
});

describe("taskAge", () => {
  it("returns near-zero when task has no recorded start time", () => {
    const age = taskAge("unknown-id", {});
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(50);
  });

  it("returns elapsed milliseconds for a tracked task", () => {
    const start = Date.now() - 5_000;
    const age = taskAge("t1", { t1: start });
    expect(age).toBeGreaterThanOrEqual(5_000);
    expect(age).toBeLessThan(5_300);
  });

  it("returns 0 for a task started right now", () => {
    const start = Date.now();
    const age = taskAge("t1", { t1: start });
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(50);
  });
});

describe("isQuietHours", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe("overnight quiet hours (22–8)", () => {
    it("is quiet at 23:00", () => {
      vi.setSystemTime(new Date("2024-01-01T23:00:00"));
      expect(isQuietHours(22, 8)).toBe(true);
    });

    it("is quiet at 03:00", () => {
      vi.setSystemTime(new Date("2024-01-01T03:00:00"));
      expect(isQuietHours(22, 8)).toBe(true);
    });

    it("is quiet at exactly 22:00", () => {
      vi.setSystemTime(new Date("2024-01-01T22:00:00"));
      expect(isQuietHours(22, 8)).toBe(true);
    });

    it("is not quiet at 12:00", () => {
      vi.setSystemTime(new Date("2024-01-01T12:00:00"));
      expect(isQuietHours(22, 8)).toBe(false);
    });

    it("is not quiet at exactly 08:00 (end boundary is exclusive)", () => {
      vi.setSystemTime(new Date("2024-01-01T08:00:00"));
      expect(isQuietHours(22, 8)).toBe(false);
    });
  });

  describe("same-day quiet hours (13–16)", () => {
    it("is quiet at 14:00", () => {
      vi.setSystemTime(new Date("2024-01-01T14:00:00"));
      expect(isQuietHours(13, 16)).toBe(true);
    });

    it("is not quiet at 12:00", () => {
      vi.setSystemTime(new Date("2024-01-01T12:00:00"));
      expect(isQuietHours(13, 16)).toBe(false);
    });

    it("is not quiet at 17:00", () => {
      vi.setSystemTime(new Date("2024-01-01T17:00:00"));
      expect(isQuietHours(13, 16)).toBe(false);
    });
  });
});
