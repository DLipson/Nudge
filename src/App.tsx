import { useState, useCallback, useRef } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { useAppState } from "./hooks/useAppState";
import { useNotifications } from "./hooks/useNotifications";
import { useNudgeTimer } from "./hooks/useNudgeTimer";
import {
  Sidebar,
  FocusView,
  AllProjectsView,
  ProjectView,
  ProjectNotFound,
  ProjectModal,
  TaskModal,
  SettingsModal,
  Toast,
} from "./components";
import type { Task } from "./types";

type ModalState =
  | null
  | { type: "project"; data?: { id: string; name: string; color: string; nudgeMinutes: number } }
  | { type: "task"; projectId: string; task?: Task }
  | { type: "settings" };

function App() {
  const navigate = useNavigate();
  const {
    projects,
    settings,
    taskStartTimes,
    isLoading,
    addProject,
    updateProject,
    deleteProject,
    toggleProjectActive,
    getProject,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    snoozeTask,
    unsnoozeTask,
    skipTask,
    reorderTask,
    updateSettings,
    syncWorkflowy,
    workflowySyncing,
    workflowyError,
    workflowyLastSync,
    storageDiagnostics,
    getNextTask,
    isSnoozed,
    activeProjects,
  } = useAppState();

  const { permission, canNotify, requestPermission } = useNotifications();
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  // Set up nudge timer for background notifications
  useNudgeTimer({
    projects,
    settings,
    taskStartTimes,
    getNextTask,
    isSnoozed,
    enabled: canNotify && settings.notificationsEnabled,
  });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2400);
  }, []);

  // Computed totals for sidebar
  const totalDone = activeProjects.reduce(
    (s, p) => s + p.tasks.filter((t) => t.done).length,
    0
  );
  const totalTasks = activeProjects.reduce((s, p) => s + p.tasks.length, 0);

  // ── Modal handlers ────────────────────────────────────────────────────────

  const handleNewProject = () => {
    setModal({ type: "project" });
  };

  const handleEditProject = (projectId: string) => {
    const project = getProject(projectId);
    if (project) {
      setModal({
        type: "project",
        data: {
          id: project.id,
          name: project.name,
          color: project.color,
          nudgeMinutes: project.nudgeMinutes,
        },
      });
    }
  };

  const handleSaveProject = async (
    name: string,
    color: string,
    nudgeMinutes: number
  ) => {
    if (modal?.type === "project" && modal.data?.id) {
      await updateProject(modal.data.id, name, color, nudgeMinutes);
    } else {
      const project = await addProject(name, color, nudgeMinutes);
      navigate(`/project/${project.id}`);
    }
    setModal(null);
  };

  const handleNewTask = (projectId: string) => {
    setModal({ type: "task", projectId });
  };

  const handleEditTask = (projectId: string, task: Task) => {
    setModal({ type: "task", projectId, task });
  };

  const handleSaveTask = async (name: string, description: string) => {
    if (modal?.type === "task") {
      if (modal.task?.id) {
        await updateTask(modal.task.id, name, description);
      } else {
        await addTask(modal.projectId, name, description);
      }
      setModal(null);
    }
  };

  const handleSaveSettings = (newSettings: Partial<typeof settings>) => {
    updateSettings(newSettings);
    showToast("Settings saved");
    setModal(null);
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return <div className="loading-wrap">Loading...</div>;
  }

  // ── Project detail page wrapper ───────────────────────────────────────────

  function ProjectDetailWrapper() {
    const { id } = useParams<{ id: string }>();
    const project = id ? getProject(id) : undefined;

    if (!project) {
      return <ProjectNotFound />;
    }

    return (
      <ProjectView
        project={project}
        showCompleted={settings.showCompleted}
        onToggleActive={() => toggleProjectActive(project.id)}
        onEdit={() => handleEditProject(project.id)}
        onDelete={() => deleteProject(project.id)}
        onCompleteTask={completeTask}
        onUncompleteTask={uncompleteTask}
        onUnsnoozeTask={unsnoozeTask}
        onEditTask={(task) => handleEditTask(project.id, task)}
        onDeleteTask={deleteTask}
        onReorderTask={(taskId, newIndex) => reorderTask(project.id, taskId, newIndex)}
        onAddTask={() => handleNewTask(project.id)}
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="nudge-wrap">
      <Sidebar
        projects={projects}
        taskStartTimes={taskStartTimes}
        totalDone={totalDone}
        totalTasks={totalTasks}
        workflowyEnabled={settings.workflowy?.enabled}
        workflowySyncing={workflowySyncing}
        workflowyError={workflowyError}
        workflowyLastSync={workflowyLastSync}
        onNewProject={handleNewProject}
        onOpenSettings={() => setModal({ type: "settings" })}
        onSyncWorkflowy={syncWorkflowy}
      />
      <div className="nudge-main">
        {/* Notification permission banner */}
        {permission === "default" && settings.notificationsEnabled && (
          <div className="notification-banner">
            <p>
              Enable browser notifications to get gentle nudges when tasks need
              attention.
            </p>
            <button className="btn primary" onClick={requestPermission}>
              Enable notifications
            </button>
            <button
              className="btn"
              onClick={() => updateSettings({ notificationsEnabled: false })}
            >
              No thanks
            </button>
          </div>
        )}

        <Routes>
          <Route
            path="/"
            element={
              <FocusView
                projects={activeProjects}
                taskStartTimes={taskStartTimes}
                autoAdvance={settings.autoAdvance}
                onComplete={completeTask}
                onSnooze={snoozeTask}
                onSkip={skipTask}
                showToast={showToast}
              />
            }
          />
          <Route
            path="/projects"
            element={
              <AllProjectsView
                projects={projects}
                onNewProject={handleNewProject}
              />
            }
          />
          <Route path="/project/:id" element={<ProjectDetailWrapper />} />
        </Routes>
      </div>

      {/* Modals */}
      {modal?.type === "project" && (
        <ProjectModal
          initialData={modal.data}
          defaultNudgeMinutes={settings.nudgeMinutes}
          onSave={handleSaveProject}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "task" && (
        <TaskModal
          task={modal.task}
          onSave={handleSaveTask}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "settings" && (
        <SettingsModal
          settings={settings}
          storageDiagnostics={storageDiagnostics}
          onSave={handleSaveSettings}
          onClose={() => setModal(null)}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}

export default App;
