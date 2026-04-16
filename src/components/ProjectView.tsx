import { useNavigate } from "react-router-dom";
import type { Project, Task } from "../types";
import { TaskList } from "./TaskList";

interface ProjectViewProps {
  project: Project;
  showCompleted: boolean;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCompleteTask: (taskId: string) => void;
  onUncompleteTask: (taskId: string) => void;
  onUnsnoozeTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderTask: (taskId: string, newIndex: number) => void;
  onAddTask: () => void;
}

export function ProjectView({
  project,
  showCompleted,
  onToggleActive,
  onEdit,
  onDelete,
  onCompleteTask,
  onUncompleteTask,
  onUnsnoozeTask,
  onEditTask,
  onDeleteTask,
  onReorderTask,
  onAddTask,
}: ProjectViewProps) {
  const navigate = useNavigate();
  const done = project.tasks.filter((t) => t.done).length;

  const handleDelete = () => {
    if (!confirm(`Delete "${project.name}"?`)) return;
    onDelete();
    navigate("/");
  };

  return (
    <>
      <div className="topbar">
        <span
          className="sb-dot"
          style={{
            background: project.color,
            width: 10,
            height: 10,
            borderRadius: "50%",
            flexShrink: 0,
          }}
        />
        <div className="topbar-title">{project.name}</div>
        <button className="btn" onClick={onToggleActive}>
          {project.active ? "Pause" : "Resume"}
        </button>
        <button className="btn" onClick={onEdit}>
          Edit
        </button>
        <button className="btn danger" onClick={handleDelete}>
          Delete
        </button>
      </div>
      <div className="nudge-content">
        <div className="proj-meta">
          <div className="proj-meta-item">
            <strong>
              {done}/{project.tasks.length}
            </strong>{" "}
            tasks done
          </div>
          <div className="proj-meta-item">
            Nudge every <strong>{project.nudgeMinutes}m</strong>
          </div>
          {!project.active && (
            <div className="proj-meta-item" style={{ color: "#f0a030" }}>
              Paused
            </div>
          )}
        </div>
        <TaskList
          project={project}
          showCompleted={showCompleted}
          onComplete={onCompleteTask}
          onUncomplete={onUncompleteTask}
          onUnsnooze={onUnsnoozeTask}
          onEdit={onEditTask}
          onDelete={onDeleteTask}
          onReorder={onReorderTask}
          onAddTask={onAddTask}
        />
      </div>
    </>
  );
}

export function ProjectNotFound() {
  const navigate = useNavigate();

  return (
    <div className="error-view">
      <h3>Project not found</h3>
      <p>This project may have been deleted.</p>
      <button className="btn primary" onClick={() => navigate("/")}>
        Back to Focus
      </button>
    </div>
  );
}
