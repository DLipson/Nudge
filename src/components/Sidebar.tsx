import { NavLink } from "react-router-dom";
import type { Project } from "../types";

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

function hasIncompleteTasks(project: Project) {
  return project.tasks.some((t) => !t.done);
}

function formatSyncAge(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1m ago";
  return `${mins}m ago`;
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
  const localProjects = projects.filter((p) => p.sourceId !== "workflowy" && hasIncompleteTasks(p));
  const workflowyProjects = projects.filter((p) => p.sourceId === "workflowy" && hasIncompleteTasks(p));

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

        <div className="sb-section">Projects</div>

        {/* Combined project list: local first, then Workflowy */}
        {[...localProjects, ...workflowyProjects].map((p) => {
          const next = nextTask(p);

          return (
            <NavLink
              key={p.id}
              to={`/project/${p.id}`}
              title={next?.name ? `Next: ${next.name}` : undefined}
              className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}
            >
              <span className="sb-dot" style={{ background: p.color }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name}
              </span>
            </NavLink>
          );
        })}

        {/* Sync button & status — only shown when Workflowy is enabled */}
        {workflowyEnabled && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              fontSize: 11,
              color: "#555",
            }}
          >
            {workflowySyncing ? (
              <span>syncing…</span>
            ) : workflowyError ? (
              <>
                <span style={{ color: "#f05050", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={workflowyError}>
                  ⚠ {workflowyError.length > 48 ? workflowyError.slice(0, 48) + "…" : workflowyError}
                </span>
                {onSyncWorkflowy && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSyncWorkflowy(); }}
                    style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 12, padding: "2px 4px" }}
                    title="Retry sync"
                  >
                    &#8635;
                  </button>
                )}
              </>
            ) : workflowyLastSync ? (
              <>
                <span>✓ synced {formatSyncAge(workflowyLastSync)}</span>
                {onSyncWorkflowy && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSyncWorkflowy(); }}
                    style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 12, padding: "2px 4px", marginLeft: "auto" }}
                    title="Sync now"
                  >
                    &#8635;
                  </button>
                )}
              </>
            ) : (
              <span>No projects found. Tag bullets with your project tag.</span>
            )}
          </div>
        )}

        <div className="sb-add" onClick={onNewProject}>
          + New project
        </div>
      </nav>
      <div className="sb-footer">
        <div className="sb-item" onClick={onOpenSettings}>
          &#9881; Settings
        </div>
      </div>
    </div>
  );
}
