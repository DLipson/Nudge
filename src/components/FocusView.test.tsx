// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FocusView } from "./FocusView";
import { resetNotificationState } from "../lib/notifications";
import { DEFAULT_SETTINGS } from "../types";
import type { Project, Settings } from "../types";

afterEach(cleanup);

const T0 = 1_000_000_000_000;

// Quiet hours disabled (start === end) so the countdown never gets pushed
// forward by wall-clock-dependent quiet-hours logic.
const settings: Settings = {
  ...DEFAULT_SETTINGS,
  quietHoursStart: 0,
  quietHoursEnd: 0,
};

function makeProject(): Project {
  return {
    id: "p1",
    name: "P1",
    color: "#aaa",
    nudgeMinutes: 1, // 60s interval so the countdown renders in seconds
    active: true,
    tasks: [
      {
        id: "t1",
        name: "Task one",
        description: "",
        done: false,
        completedAt: null,
        snoozedUntil: null,
        sourceId: "local-storage",
      },
    ],
    sourceId: "local-storage",
  };
}

describe("FocusView countdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    resetNotificationState();
  });

  afterEach(() => vi.useRealTimers());

  it("counts down in real time as the clock advances", () => {
    // Task started 40s ago → 20s remain until the 60s nudge.
    const taskStartTimes = { "local-storage:t1": T0 - 40_000 };

    render(
      <MemoryRouter>
        <FocusView
          projects={[makeProject()]}
          settings={settings}
          taskStartTimes={taskStartTimes}
          onComplete={() => {}}
          onSnooze={() => {}}
          onSkip={() => {}}
          onTriggerNudge={() => {}}
          showToast={() => {}}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText("nudge in 20s").length).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.queryAllByText("nudge in 20s")).toHaveLength(0);
    expect(screen.getAllByText("nudge in 15s").length).toBeGreaterThan(0);
  });
});
