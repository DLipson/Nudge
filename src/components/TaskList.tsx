import { useState } from "react";
import type { Project, Task } from "../types";
import { formatDate, formatDuration } from "../lib/time";

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

function isSnoozed(task: Task): boolean {
  return task.snoozedUntil !== null && task.snoozedUntil > Date.now();
}

function nextTask(project: Project): Task | null {
  return project.tasks.find((t) => !t.done) ?? null;
}

// Pencil/Edit icon SVG
function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
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
  const activeTask = nextTask(project);
  const visible = project.tasks.filter((t) => !t.done || showCompleted);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
    // Add a slight delay to allow the drag image to be captured
    requestAnimationFrame(() => {
      const el = e.currentTarget as HTMLElement;
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
      // Find the new index (where the target task is)
      const targetIndex = visible.findIndex((t) => t.id === targetTaskId);
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
                  className={`task-step ${
                    isDone ? "done" : isActive ? "active" : ""
                  }`}
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
                  {isActive && !snoozed && (
                    <span className="task-tag active">Current focus</span>
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
                      className="task-btn"
                      onClick={() => onComplete(task.id)}
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
                  <button
                    className="task-btn icon-only"
                    onClick={() => onEdit(task)}
                    title="Edit task"
                  >
                    <EditIcon />
                  </button>
                  <button
                    className="task-btn danger"
                    onClick={() => onDelete(task.id)}
                    title="Delete task"
                  >
                    &times;
                  </button>
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
