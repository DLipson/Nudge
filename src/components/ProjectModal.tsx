import { useState } from "react";
import { Modal } from "./Modal";
import { COLORS } from "../types";

interface ProjectModalProps {
  initialData?: {
    id?: string;
    name: string;
    color: string;
    nudgeMinutes: number;
  };
  defaultNudgeMinutes: number;
  onSave: (name: string, color: string, nudgeMinutes: number) => void;
  onClose: () => void;
}

export function ProjectModal({
  initialData,
  defaultNudgeMinutes,
  onSave,
  onClose,
}: ProjectModalProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [color, setColor] = useState(initialData?.color || COLORS[0]);
  const [nudgeMinutes, setNudgeMinutes] = useState(
    initialData?.nudgeMinutes || defaultNudgeMinutes
  );
  const [nameErr, setNameErr] = useState(false);

  const isEdit = !!initialData?.id;

  const handleSave = () => {
    if (!name.trim()) {
      setNameErr(true);
      return;
    }
    onSave(name.trim(), color, nudgeMinutes);
  };

  return (
    <Modal
      title={isEdit ? "Edit project" : "New project"}
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
      <div className="field">
        <label>Name</label>
        <input
          className={nameErr ? "err" : ""}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameErr(false);
          }}
          placeholder="e.g. Q3 Marketing"
          autoFocus
        />
        {nameErr && (
          <div className="field-error">Please enter a project name.</div>
        )}
      </div>
      <div className="field">
        <label>Color</label>
        <div className="color-picker">
          {COLORS.map((c) => (
            <div
              key={c}
              className={`color-swatch ${color === c ? "selected" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <div className="field">
        <label>Nudge interval (minutes)</label>
        <input
          type="number"
          min="5"
          max="120"
          value={nudgeMinutes}
          onChange={(e) =>
            setNudgeMinutes(Math.max(1, parseInt(e.target.value) || 25))
          }
        />
        <div className="field-hint">
          Reminder at {nudgeMinutes}m, needs attention at ~
          {Math.round(nudgeMinutes * 1.4)}m
        </div>
      </div>
    </Modal>
  );
}
