import { useState } from "react";
import { Modal } from "./Modal";
import type { Task } from "../types";

interface TaskModalProps {
  task?: Task;
  onSave: (name: string, description: string) => void;
  onClose: () => void;
}

export function TaskModal({ task, onSave, onClose }: TaskModalProps) {
  const [name, setName] = useState(task?.name || "");
  const [description, setDescription] = useState(task?.description || "");
  const [nameErr, setNameErr] = useState(false);

  const isEdit = !!task?.id;

  const handleSave = () => {
    if (!name.trim()) {
      setNameErr(true);
      return;
    }
    onSave(name.trim(), description.trim());
  };

  return (
    <Modal
      title={isEdit ? "Edit task" : "Add task"}
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
        <label>Task name</label>
        <input
          className={nameErr ? "err" : ""}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameErr(false);
          }}
          placeholder="What needs to be done?"
          autoFocus
        />
        {nameErr && <div className="field-error">Please enter a task name.</div>}
      </div>
      <div className="field">
        <label>Details</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Context, links, notes..."
        />
      </div>
    </Modal>
  );
}
