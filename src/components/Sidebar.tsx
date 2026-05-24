import { NavLink } from "react-router-dom";
import type { Project, NudgeLevel } from "../types";
import { taskAge } from "../lib/time";

interface SidebarProps {
  projects: Project[];
  taskStartTimes: Record<string, number>;
  totalDone: number;
  totalTasks: number;
  workflowyEnabled?: boolean;
  workflowySyncing?: boolean;
  workflowyError?: string | null;
  workflowyLastSync?: number | null;
  onNewProject: () => void;
  onOpenSettings: () => void;
  onSyncWorkflowy?: () => void;
}

function nextTask(project: Project) {
  return project.tasks.find((t) => !t.done) ?? null;
}

function getNudgeLevel(ageMs: number, nudgeMinutes: number): NudgeLevel {
  const r = ageMs / (nudgeMinutes * 60_000);
  return r < 0.7 ? "ok" : r < 1.0 ? "warn" : "attention";
}

function formatSyncAge(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1m ago";
  return `${mins}m ago`;
}

function WorkflowyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function Sidebar({
  projects,
  taskStartTimes,
  totalDone,
  totalTasks,
  workflowyEnabled,
  workflowySyncing,
  workflowyError,
  workflowyLastSync,
  onNewProject,
  onOpenSettings,
  onSyncWorkflowy,
}: SidebarProps) {
  const localProjects = projects.filter((p) => p.sourceId !== "workflowy");
  const workflowyProjects = projects.filter((p) => p.sourceId === "workflowy");

  return (
    <div className="nudge-sidebar">
      <div className="sb-logo">
        <div className="sb-logo-name">Nudge</div>
        <div className="sb-logo-sub">
          {totalDone}/{totalTasks} tasks done
        </div>
      </div>
      <nav className="sb-nav">
        <div className="sb-section">Views</div>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}
        >
          &#9678; Focus
        </NavLink>
        <NavLink
          to="/projects"
          className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}
        >
          &#8862; All projects
        </NavLink>

        <div className="sb-section">Projects</div>
        {localProjects.map((p) => {
          const next = nextTask(p);
          const level =
            next && p.active
              ? getNudgeLevel(taskAge(next, taskStartTimes), p.nudgeMinutes)
              : null;

          return (
            <NavLink
              key={p.id}
              to={`/project/${p.id}`}
              className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}
            >
              <span className="sb-dot" style={{ background: p.color }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name}
              </span>
              {level && level !== "ok" && (
                <span className={`sb-badge ${level === "warn" ? "warn" : ""}`}>
                  {level === "warn" ? "!" : "!!"}
                </span>
              )}
            </NavLink>
          );
        })}
        <div className="sb-add" onClick={onNewProject}>
          + New project
        </div>

        {/* Workflowy section */}
        {workflowyEnabled && (
          <>
            <div className="sb-section" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <WorkflowyIcon />
              <span>Workflowy</span>
              {workflowySyncing ? (
                <span style={{ marginLeft: "auto", fontSize: 9, color: "#888" }}>syncing…</span>
              ) : (
                onSyncWorkflowy && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSyncWorkflowy(); }}
                    style={{
                      marginLeft: "auto",
                      background: "none",
                      border: "none",
                      color: workflowyError ? "#f05050" : "#555",
                      cursor: "pointer",
                      fontSize: 12,
                      padding: "2px 4px",
                    }}
                    title="Sync now"
                  >
                    &#8635;
                  </button>
                )
              )}
            </div>

            {/* Sync status line */}
            {!workflowySyncing && (workflowyError || workflowyLastSync) && (
              <div style={{ padding: "3px 10px 6px", fontSize: 10 }}>
                {workflowyError ? (
                  <span style={{ color: "#f05050" }} title={workflowyError}>
                    ⚠ {workflowyError.length > 48 ? workflowyError.slice(0, 48) + "…" : workflowyError}
                  </span>
                ) : workflowyLastSync ? (
                  <span style={{ color: "#555" }}>✓ synced {formatSyncAge(workflowyLastSync)}</span>
                ) : null}
              </div>
            )}

            {workflowySyncing && (
              <div style={{ padding: "3px 10px 6px", fontSize: 10, color: "#555" }}>
                Fetching projects…
              </div>
            )}

            {workflowyProjects.length === 0 && !workflowySyncing && !workflowyError && (
              <div style={{ padding: "4px 10px 8px", fontSize: 11, color: "#555" }}>
                No projects found. Tag bullets with your project tag.
              </div>
            )}

            {workflowyProjects.map((p) => {
              const next = nextTask(p);
              const level =
                next && p.active
                  ? getNudgeLevel(taskAge(next, taskStartTimes), p.nudgeMinutes)
                  : null;

              return (
                <NavLink
                  key={p.id}
                  to={`/project/${p.id}`}
                  className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}
                >
                  <span className="sb-dot" style={{ background: p.color }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </span>
                  {level && level !== "ok" && (
                    <span className={`sb-badge ${level === "warn" ? "warn" : ""}`}>
                      {level === "warn" ? "!" : "!!"}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </>
        )}
      </nav>
      <div className="sb-footer">
        <div className="sb-item" onClick={onOpenSettings}>
          &#9881; Settings
        </div>
      </div>
    </div>
  );
}
