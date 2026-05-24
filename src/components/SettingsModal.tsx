import { useState } from "react";
import { Modal } from "./Modal";
import { Toggle } from "./Toggle";
import type { Settings, WorkflowyConfig, StorageDiagnostics } from "../types";
import { DEFAULT_WORKFLOWY_CONFIG } from "../types";
import { WorkflowyAdapter } from "../adapters/WorkflowyAdapter";

interface SettingsModalProps {
  settings: Settings;
  storageDiagnostics: StorageDiagnostics | null;
  onSave: (settings: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsModal({
  settings,
  storageDiagnostics,
  onSave,
  onClose,
}: SettingsModalProps) {
  const [nudgeMinutes, setNudgeMinutes] = useState(settings.nudgeMinutes);
  const [autoAdvance, setAutoAdvance] = useState(settings.autoAdvance);
  const [showCompleted, setShowCompleted] = useState(settings.showCompleted);
  const [launchOnStartup, setLaunchOnStartup] = useState(
    settings.launchOnStartup
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    settings.notificationsEnabled
  );
  const [maxNotificationFrequency, setMaxNotificationFrequency] = useState(
    settings.maxNotificationFrequency
  );
  const [quietHoursStart, setQuietHoursStart] = useState(
    settings.quietHoursStart
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(settings.quietHoursEnd);
  const [nudgeTone, setNudgeTone] = useState(settings.nudgeTone);

  // Workflowy settings
  const workflowySettings = settings.workflowy || DEFAULT_WORKFLOWY_CONFIG;
  const [wfEnabled, setWfEnabled] = useState(workflowySettings.enabled);
  const [wfApiKey, setWfApiKey] = useState(workflowySettings.apiKey);
  const [wfProjectTag, setWfProjectTag] = useState(workflowySettings.projectTag);
  const [wfSearchPaths, setWfSearchPaths] = useState(workflowySettings.searchPaths || "");
  const [wfTestStatus, setWfTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [wfTestError, setWfTestError] = useState("");

  const handleTestWorkflowy = async () => {
    if (!wfApiKey.trim()) {
      setWfTestStatus("error");
      setWfTestError("Please enter an API key");
      return;
    }

    setWfTestStatus("testing");
    setWfTestError("");

    const result = await WorkflowyAdapter.testApiKey(wfApiKey.trim());

    if (result.success) {
      setWfTestStatus("success");
    } else {
      setWfTestStatus("error");
      setWfTestError(result.error || "Connection failed");
    }
  };

  const handleSave = () => {
    const workflowy: WorkflowyConfig = {
      apiKey: wfApiKey.trim(),
      projectTag: wfProjectTag.trim() || "#nudge",
      enabled: wfEnabled && wfApiKey.trim().length > 0,
      lastSync: workflowySettings.lastSync,
      searchPaths: wfSearchPaths.trim(),
    };

    onSave({
      nudgeMinutes,
      autoAdvance,
      showCompleted,
      launchOnStartup,
      notificationsEnabled,
      maxNotificationFrequency,
      quietHoursStart,
      quietHoursEnd,
      nudgeTone,
      workflowy,
    });
  };

  const inputStyle = {
    width: 60,
    textAlign: "right" as const,
    padding: "6px 8px",
    background: "#0f0f0f",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 8,
    color: "#f0f0f0",
    fontFamily: "monospace",
  };

  const fullWidthInputStyle = {
    width: "100%",
    padding: "8px 12px",
    background: "#0f0f0f",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 8,
    color: "#f0f0f0",
    fontFamily: "monospace",
    fontSize: 13,
  };

  const sectionHeaderStyle = {
    fontSize: 10,
    fontWeight: 500,
    color: "#555",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    padding: "16px 0 8px",
    marginTop: 8,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  };

  return (
    <Modal
      title="Settings"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleSave}>
            Save
          </button>
        </>
      }
    >
      {/* General Settings */}
      <div className="setting-row">
        <div>
          <div className="setting-label">Default nudge interval</div>
          <div className="setting-sub">
            Minutes before a task is flagged as slow
          </div>
        </div>
        <input
          type="number"
          min="5"
          max="120"
          value={nudgeMinutes}
          onChange={(e) =>
            setNudgeMinutes(Math.max(1, parseInt(e.target.value) || 25))
          }
          style={inputStyle}
        />
      </div>

      <div className="setting-row">
        <div>
          <div className="setting-label">Auto-advance on complete</div>
          <div className="setting-sub">Show a toast with the next task name</div>
        </div>
        <Toggle on={autoAdvance} onChange={setAutoAdvance} />
      </div>

      <div className="setting-row">
        <div>
          <div className="setting-label">Show completed tasks</div>
          <div className="setting-sub">
            Display done tasks in the project view
          </div>
        </div>
        <Toggle on={showCompleted} onChange={setShowCompleted} />
      </div>

      <div className="setting-row">
        <div>
          <div className="setting-label">Start automatically on startup</div>
          <div className="setting-sub">Launch Nudge in the tray when you sign in</div>
        </div>
        <Toggle on={launchOnStartup} onChange={setLaunchOnStartup} />
      </div>

      {/* Notification Settings */}
      <div style={sectionHeaderStyle}>Notifications</div>

      <div className="setting-row">
        <div>
          <div className="setting-label">Enable browser notifications</div>
          <div className="setting-sub">Get nudged when tasks need attention</div>
        </div>
        <Toggle on={notificationsEnabled} onChange={setNotificationsEnabled} />
      </div>

      <div className="setting-row">
        <div>
          <div className="setting-label">
            Max notification frequency (minutes)
          </div>
          <div className="setting-sub">
            Minimum time between any notifications
          </div>
        </div>
        <input
          type="number"
          min="1"
          max="60"
          value={maxNotificationFrequency}
          onChange={(e) =>
            setMaxNotificationFrequency(
              Math.max(1, parseInt(e.target.value) || 10)
            )
          }
          style={inputStyle}
        />
      </div>

      <div className="setting-row">
        <div>
          <div className="setting-label">Quiet hours</div>
          <div className="setting-sub">No nudges during these hours</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            min="0"
            max="23"
            value={quietHoursStart}
            onChange={(e) =>
              setQuietHoursStart(
                Math.min(23, Math.max(0, parseInt(e.target.value) || 0))
              )
            }
            style={{ ...inputStyle, width: 45, textAlign: "center" }}
          />
          <span style={{ color: "#555" }}>to</span>
          <input
            type="number"
            min="0"
            max="23"
            value={quietHoursEnd}
            onChange={(e) =>
              setQuietHoursEnd(
                Math.min(23, Math.max(0, parseInt(e.target.value) || 0))
              )
            }
            style={{ ...inputStyle, width: 45, textAlign: "center" }}
          />
        </div>
      </div>

      <div className="setting-row">
        <div>
          <div className="setting-label">Nudge tone</div>
          <div className="setting-sub">How the notifications are phrased</div>
        </div>
        <select
          value={nudgeTone}
          onChange={(e) => setNudgeTone(e.target.value as "gentle" | "firm")}
          style={{
            padding: "6px 10px",
            background: "#0f0f0f",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 8,
            color: "#f0f0f0",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
          }}
        >
          <option value="gentle">Gentle</option>
          <option value="firm">Firm</option>
        </select>
      </div>

      {/* Workflowy Integration */}
      <div style={sectionHeaderStyle}>Workflowy Integration</div>

      <div className="setting-row">
        <div>
          <div className="setting-label">Enable Workflowy sync</div>
          <div className="setting-sub">
            Sync projects and tasks from Workflowy
          </div>
        </div>
        <Toggle on={wfEnabled} onChange={setWfEnabled} />
      </div>

      {wfEnabled && (
        <>
          <div className="setting-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            <div>
              <div className="setting-label">API Key</div>
              <div className="setting-sub">
                Get your key at{" "}
                <a
                  href="https://workflowy.com/api-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#c8f04a" }}
                >
                  workflowy.com/api-key
                </a>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="password"
                value={wfApiKey}
                onChange={(e) => {
                  setWfApiKey(e.target.value);
                  setWfTestStatus("idle");
                }}
                placeholder="Enter your Workflowy API key"
                style={{ ...fullWidthInputStyle, flex: 1 }}
              />
              <button
                className={`btn ${wfTestStatus === "success" ? "primary" : ""}`}
                onClick={handleTestWorkflowy}
                disabled={wfTestStatus === "testing"}
                style={{ flexShrink: 0 }}
              >
                {wfTestStatus === "testing"
                  ? "Testing..."
                  : wfTestStatus === "success"
                  ? "\u2713 Connected"
                  : "Test"}
              </button>
            </div>
            {wfTestStatus === "error" && (
              <div style={{ fontSize: 12, color: "#f05050" }}>{wfTestError}</div>
            )}
          </div>

          <div className="setting-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            <div>
              <div className="setting-label">Project Tag</div>
              <div className="setting-sub">
                Bullets containing this tag become projects (e.g., #nudge, #track)
              </div>
            </div>
            <input
              type="text"
              value={wfProjectTag}
              onChange={(e) => setWfProjectTag(e.target.value)}
              placeholder="#nudge"
              style={fullWidthInputStyle}
            />
          </div>

          <div className="setting-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            <div>
              <div className="setting-label">Search paths <span style={{ color: "#555", fontWeight: 400 }}>(optional)</span></div>
              <div className="setting-sub">
                Comma-separated paths to the folders containing your tagged projects.
                Each level separated by <code style={{ color: "#aaa" }}>&gt;</code>.
                Leave empty to search root level.
              </div>
            </div>
            <input
              type="text"
              value={wfSearchPaths}
              onChange={(e) => setWfSearchPaths(e.target.value)}
              placeholder="e.g. Life > Work, Life > Personal"
              style={fullWidthInputStyle}
            />
          </div>

          <div
            style={{
              padding: 12,
              background: "rgba(200, 240, 74, 0.08)",
              borderRadius: 8,
              fontSize: 12,
              color: "#888",
              lineHeight: 1.5,
              marginTop: 8,
            }}
          >
            <strong style={{ color: "#c8f04a" }}>How it works:</strong>
            <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
              <li>Tag any Workflowy bullet with <code style={{ color: "#c8f04a" }}>{wfProjectTag || "#nudge"}</code> to make it a project</li>
              <li>Its child bullets become tasks</li>
              <li>Completing tasks syncs both ways</li>
            </ul>
          </div>
        </>
      )}

      <div style={sectionHeaderStyle}>Storage Diagnostics</div>
      <div
        style={{
          padding: 12,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 8,
          fontSize: 12,
          color: "#888",
          lineHeight: 1.6,
        }}
      >
        <div><strong style={{ color: "#f0f0f0" }}>State source:</strong> {storageDiagnostics?.stateSource ?? "unknown"}</div>
        <div><strong style={{ color: "#f0f0f0" }}>Storage key:</strong> <code>{storageDiagnostics?.storageKey ?? "unknown"}</code></div>
        <div><strong style={{ color: "#f0f0f0" }}>User data path:</strong> <code>{storageDiagnostics?.appStoragePath ?? "browser localStorage"}</code></div>
        <div><strong style={{ color: "#f0f0f0" }}>Projects loaded:</strong> {storageDiagnostics?.projectCount ?? 0}</div>
        <div><strong style={{ color: "#f0f0f0" }}>Workflowy enabled:</strong> {storageDiagnostics?.workflowyEnabled ? "yes" : "no"}</div>
        {storageDiagnostics?.stateSource === "empty" && (
          <div style={{ color: "#f0b450", marginTop: 8 }}>
            No persisted app state was found. Nudge started from an empty state instead of seeding demo data.
          </div>
        )}
        {storageDiagnostics?.stateSource === "invalid" && (
          <div style={{ color: "#f05050", marginTop: 8 }}>
            Persisted state exists but could not be parsed. Check the storage key and stored payload before changing app identity or storage behavior.
          </div>
        )}
      </div>
    </Modal>
  );
}
