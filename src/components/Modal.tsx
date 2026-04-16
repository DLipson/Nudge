import type { ReactNode, MouseEvent } from "react";

interface ModalProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

export function Modal({ title, children, footer, onClose }: ModalProps) {
  const handleBackdropClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).className === "backdrop") {
      onClose();
    }
  };

  return (
    <div className="backdrop" onClick={handleBackdropClick}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
