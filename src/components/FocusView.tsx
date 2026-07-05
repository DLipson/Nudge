import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Project, Settings } from "../types";
import { calculateNudgeSchedule, taskAge } from "../lib/time";
import { getNotificationState } from "../lib/notifications";

interface FocusViewProps {
  projects: Project[];
  settings: Settings;
  taskStartTimes: Record<string, number>;
  onComplete: (taskId: string) => void;
  onSnooze: (taskId: string, minutes: number) => void;
  onSkip: (projectId: string, taskId: string) => void;
  onTriggerNudge: () => void;
  showToast: (message: string) => void;
}

function nextTask(project: Project) {
  return project.tasks.find((t) => !t.done) ?? null;
}

function isSnoozed(task: { snoozedUntil: number | null }) {
  return task.snoozedUntil !== null && task.snoozedUntil > Date.now();
}

function formatNudgeTime(ms: number): string {
  if (ms === 0) return "nudge ready";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const m = minutes % 60;
    return m > 0 ? `nudge in ${hours}h ${m}m` : `nudge in ${hours}h`;
  }
  if (minutes > 0 && seconds > 0) {
    return `nudge in ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `nudge in ${minutes}m`;
  }
  return `nudge in ${seconds}s`;
}

export function FocusView({
  projects,
  settings,
  taskStartTimes,
  onComplete,
  onSnooze,
  onSkip,
  onTriggerNudge,
  showToast,
}: FocusViewProps) {
  const navigate = useNavigate();
  const activeProjects = useMemo(
    () => projects.filter((p) => p.active && nextTask(p)),
    [projects]
  );

  const needsAttention = useMemo(
    () =>
      activeProjects.filter((p) => {
        const n = nextTask(p);
        if (!n || isSnoozed(n)) return false;
        const age = taskAge(n, taskStartTimes);
        return age / (p.nudgeMinutes * 60_000) >= 0.7;
      }).length,
    [activeProjects, taskStartTimes]
  );

  const notifState = useMemo(() => getNotificationState(), [activeProjects, taskStartTimes]);

  const nudgeSchedule = useMemo(
    () =>
      calculateNudgeSchedule({
        projects: activeProjects,
        taskStartTimes,
        settings,
        isSnoozed,
        getNextTask: nextTask,
        lastNotificationTime: notifState.lastNotificationTime,
        projectLastNotified: notifState.projectLastNotified,
      }),
    [activeProjects, taskStartTimes, settings, notifState]
  );

  const sortedProjects = useMemo(() => {
    return [...activeProjects].sort((a, b) => {
      const ma = nudgeSchedule.result.get(a.id) ?? null;
      const mb = nudgeSchedule.result.get(b.id) ?? null;
      if (ma === null && mb === null) return 0;
      if (ma === null) return 1;
      if (mb === null) return -1;
      return ma - mb;
    });
  }, [activeProjects, nudgeSchedule]);

  const soonestNudge = useMemo(() => {
    let min: number | null = null;
    for (const p of activeProjects) {
      const ms = nudgeSchedule.result.get(p.id) ?? null;
      if (ms === null) continue;
      if (min === null || ms < min) min = ms;
    }
    return min;
  }, [activeProjects, nudgeSchedule]);

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Focus</div>
        <div className="topbar-meta">
          {activeProjects.length} active
          {needsAttention > 0
            ? ` \u00B7 ${needsAttention} need attention`
            : " \u00B7 all on track"}
          {soonestNudge !== null && ` \u00B7 ${formatNudgeTime(soonestNudge)}`}
          <span
            onClick={onTriggerNudge}
            style={{
              marginLeft: 8,
              fontSize: 10,
              color: "#555",
              cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 4,
              padding: "1px 6px",
            }}
            title="Trigger next nudge (testing)"
          >
            trigger
          </span>
        </div>
      </div>
      <div className="nudge-content">
        {activeProjects.length === 0 ? (
          <div className="empty-state">
            <h3>No active projects</h3>
            <p>Create a project to get started.</p>
          </div>
        ) : (
          <div className="focus-list">
            {sortedProjects.map((p) => {
              const n = nextTask(p);
              const snoozed = n ? isSnoozed(n) : false;
              const nudgeMs = n ? (nudgeSchedule.result.get(p.id) ?? null) : null;

              return (
                <div
                  key={p.id}
                  className="focus-list-row"
                  onClick={() => navigate(`/project/${p.id}`)}
                >
                  <span className="sb-dot" style={{ background: p.color, flexShrink: 0 }} />
                  <span className="focus-list-project" style={{ color: p.color }}>
                    {p.name}
                  </span>
                  <span className="focus-list-sep">:</span>
                  <span
                    className="focus-list-task"
                    style={{ color: snoozed ? "#666" : undefined }}
                  >
                    {snoozed ? `${n!.name} (snoozed)` : n!.name}
                  </span>
                  <div className="focus-list-tail">
                    {nudgeMs !== null && (
                      <span className="focus-list-nudge">{formatNudgeTime(nudgeMs)}</span>
                    )}
                    {n && !snoozed && (
                      <div className="focus-list-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="mark-done-btn"
                          onClick={() => {
                            onComplete(n.id);
                            const nextNext = p.tasks.find((t) => !t.done && t.id !== n.id);
                            showToast(nextNext ? `Done! Next: ${nextNext.name}` : "All tasks complete!");
                          }}
                        >
                          Done
                        </button>
                        <button
                          className="snooze-btn"
                          onClick={() => {
                            onSnooze(n.id, 15);
                            showToast("Snoozed 15 min");
                          }}
                        >
                          +15m
                        </button>
                        <button
                          className="skip-btn"
                          onClick={() => {
                            onSkip(p.id, n.id);
                            showToast("Task moved to end of queue");
                          }}
                        >
                          Skip
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
