interface ToggleProps {
  on: boolean;
  onChange: (value: boolean) => void;
}

export function Toggle({ on, onChange }: ToggleProps) {
  return (
    <button
      className={`toggle-btn ${on ? "on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <div className="toggle-knob" />
    </button>
  );
}
