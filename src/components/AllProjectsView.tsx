import { useNavigate } from "react-router-dom";
import type { Project } from "../types";

interface AllProjectsViewProps {
  projects: Project[];
  onNewProject: () => void;
}

function nextTask(project: Project) {
  return project.tasks.find((t) => !t.done) ?? null;
}

export function AllProjectsView({
  projects,
  onNewProject,
}: AllProjectsViewProps) {
  const navigate = useNavigate();

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">All projects</div>
        <button className="btn primary" onClick={onNewProject}>
          + New project
        </button>
      </div>
      <div className="nudge-content">
        {projects.length === 0 ? (
          <div className="empty-state">
            <h3>No projects yet</h3>
            <p>Create your first project.</p>
          </div>
        ) : (
          <div className="card-grid">
            {projects.map((p) => {
              const done = p.tasks.filter((t) => t.done).length;
              const total = p.tasks.length;
              const next = nextTask(p);

              return (
                <div
                  key={p.id}
                  className="focus-card clickable"
                  onClick={() => navigate(`/project/${p.id}`)}
                >
                  <div className="card-header">
                    <span className="sb-dot" style={{ background: p.color }} />
                    <span className="card-project-name">{p.name}</span>
                    {!p.active && (
                      <span
                        style={{ fontSize: 10, color: "#555", marginLeft: 4 }}
                      >
                        paused
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, color: "#888", marginBottom: 10 }}>
                    {done}/{total} tasks complete
                  </div>
                  <div className="timer-bar">
                    <div
                      className="timer-bar-fill"
                      style={{
                        width: `${total > 0 ? Math.round((done / total) * 100) : 0}%`,
                        background: p.color,
                      }}
                    />
                  </div>
                  {next ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#555",
                        marginTop: 8,
                        fontFamily: "monospace",
                      }}
                    >
                      Next: {next.name}
                    </div>
                  ) : total > 0 ? (
                    <div style={{ fontSize: 12, color: "#40c080", marginTop: 8 }}>
                      All done
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#555", marginTop: 8 }}>
                      No tasks yet
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
