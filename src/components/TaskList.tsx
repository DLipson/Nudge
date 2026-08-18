import { useState } from "react";
import type { Project, Task } from "../types";
import { formatDate, formatDuration } from "../lib/time";
import { nextIncompleteTask, isSnoozed } from "../lib/nudge";

interface TaskListProps {
  project: Project;
  showCompleted: boolean;
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
  onUnsnooze: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onReorder: (taskId: string, newIndex: number) => void;
  onAddTask: () => void;
}

// Drag handle icon SVG
function DragHandleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ opacity: 0.4 }}
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

// ⋮ overflow menu with task edit/delete actions
function OverflowMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="task-menu">
      <button
        className="task-btn icon-only"
        onClick={() => setOpen((o) => !o)}
        title="More actions"
      >
        &middot;&middot;&middot;
      </button>
      {open && (
        <div className="task-menu-dropdown">
          <button
            className="task-menu-item"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit
          </button>
          <button
            className="task-menu-item danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function TaskList({
  project,
  showCompleted,
  onComplete,
  onUncomplete,
  onUnsnooze,
  onEdit,
  onDelete,
  onReorder,
  onAddTask,
}: TaskListProps) {
  const activeTask = nextIncompleteTask(project);
  const visible = project.tasks.filter((t) => !t.done || showCompleted);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
    // Capture the element synchronously: React nulls out e.currentTarget after
    // the handler returns, so reading it inside the rAF callback throws.
    const el = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      el.style.opacity = "0.5";
    });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = "1";
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e: React.DragEvent, taskId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (taskId !== draggedId) {
      setDragOverId(taskId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    const sourceTaskId = e.dataTransfer.getData("text/plain");

    if (sourceTaskId && sourceTaskId !== targetTaskId) {
      // Reorder operates on the full task array, so map the drop target back to
      // its index there — not its index in the (completed-filtered) visible list.
      const targetIndex = project.tasks.findIndex((t) => t.id === targetTaskId);
      if (targetIndex >= 0) {
        onReorder(sourceTaskId, targetIndex);
      }
    }

    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <>
      <ul className="task-list">
        {visible.length === 0 ? (
          <div className="empty-state" style={{ padding: "30px 0" }}>
            <p>No tasks yet - add one below.</p>
          </div>
        ) : (
          visible.map((task, i) => {
            const isDone = task.done;
            const isActive = task === activeTask;
            const snoozed = !isDone && isSnoozed(task);
            const isDragging = draggedId === task.id;
            const isDragOver = dragOverId === task.id;

            return (
              <li
                key={task.id}
                className={`task-row ${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""}`}
                draggable
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, task.id)}
              >
                <div className="drag-handle" title="Drag to reorder">
                  <DragHandleIcon />
                </div>
                <div
                  className={`task-step ${isDone ? "done" : isActive ? "active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (isActive && !isDone) onComplete(task.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (isActive && !isDone) onComplete(task.id);
                    }
                  }}
                  title={isActive && !isDone ? "Mark done" : undefined}
                >
                  {isDone ? "\u2713" : i + 1}
                </div>
                <div className="task-body">
                  <div
                    className={`task-name ${
                      isDone ? "done" : !isActive ? "pending" : ""
                    }`}
                  >
                    {task.name}
                  </div>
                  {task.description && (
                    <div className="task-detail">{task.description}</div>
                  )}
                  {isDone && task.completedAt && (
                    <div className="task-done-on">
                      Done {formatDate(task.completedAt)}
                    </div>
                  )}
                  {snoozed && (
                    <span className="task-tag snoozed">
                      Snoozed - {formatDuration(task.snoozedUntil! - Date.now())}{" "}
                      left
                    </span>
                  )}
                </div>
                <div className="task-actions">
                  {isDone && (
                    <button
                      className="task-btn"
                      onClick={() => onUncomplete(task.id)}
                    >
                      Undo
                    </button>
                  )}
                  {!isDone && isActive && (
                    <button
                      className="task-btn primary"
                      onClick={() => onComplete(task.id)}
                      title="Mark done"
                    >
                      Done
                    </button>
                  )}
                  {snoozed && (
                    <button
                      className="task-btn"
                      onClick={() => onUnsnooze(task.id)}
                    >
                      Wake
                    </button>
                  )}
                  <OverflowMenu
                    onEdit={() => onEdit(task)}
                    onDelete={() => onDelete(task.id)}
                  />
                </div>
              </li>
            );
          })
        )}
      </ul>
      <div className="add-task-trigger" onClick={onAddTask}>
        + Add task
      </div>
    </>
  );
}
