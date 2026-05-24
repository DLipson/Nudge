import { useNavigate } from "react-router-dom";
import type { Project } from "../types";
import { taskAge } from "../lib/time";

interface FocusViewProps {
  projects: Project[];
  taskStartTimes: Record<string, number>;
  autoAdvance: boolean;
  onComplete: (taskId: string) => void;
  onSnooze: (taskId: string, minutes: number) => void;
  onSkip: (projectId: string, taskId: string) => void;
  showToast: (message: string) => void;
}

function nextTask(project: Project) {
  return project.tasks.find((t) => !t.done) ?? null;
}

function isSnoozed(task: { snoozedUntil: number | null }) {
  return task.snoozedUntil !== null && task.snoozedUntil > Date.now();
}

export function FocusView({
  projects,
  taskStartTimes,
  autoAdvance,
  onComplete,
  onSnooze,
  onSkip,
  showToast,
}: FocusViewProps) {
  const navigate = useNavigate();
  const activeProjects = projects.filter((p) => p.active);

  const needsAttention = activeProjects.filter((p) => {
    const n = nextTask(p);
    if (!n || isSnoozed(n)) return false;
    const age = taskAge(n, taskStartTimes);
    return age / (p.nudgeMinutes * 60_000) >= 0.7;
  }).length;

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Focus</div>
        <div className="topbar-meta">
          {activeProjects.length} active
          {needsAttention > 0
            ? ` \u00B7 ${needsAttention} need attention`
            : " \u00B7 all on track"}
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
            {activeProjects.map((p) => {
              const n = nextTask(p);
              const snoozed = n ? isSnoozed(n) : false;
              const taskText = !n
                ? "All tasks complete"
                : snoozed
                ? `${n.name} (snoozed)`
                : n.name;

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
                    style={{ color: !n ? "#40c080" : snoozed ? "#666" : undefined }}
                  >
                    {taskText}
                  </span>
                  {n && !snoozed && (
                    <div className="focus-list-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="mark-done-btn"
                        onClick={() => {
                          onComplete(n.id);
                          const nextNext = p.tasks.find((t) => !t.done && t.id !== n.id);
                          if (autoAdvance) {
                            showToast(nextNext ? `Done! Next: ${nextNext.name}` : "All tasks complete!");
                          }
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
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
