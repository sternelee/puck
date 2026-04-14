import { createPortal } from "react-dom";
import { useEffect } from "react";
import getClassNameFactory from "../../lib/get-class-name-factory";
import { groupCommands } from "../../lib/component-commands";
import { PuckUiCommand } from "../../types";
import styles from "./styles.module.css";

const getClassName = getClassNameFactory("ContextMenu", styles);

export const ContextMenu = ({
  commands,
  isOpen,
  onClose,
  portalEl,
  x,
  y,
}: {
  commands: PuckUiCommand[];
  isOpen: boolean;
  onClose: () => void;
  portalEl?: Element | null;
  x: number;
  y: number;
}) => {
  useEffect(() => {
    if (!isOpen || !portalEl) return;

    const view = portalEl.ownerDocument.defaultView;

    if (!view) return;

    const onPointerDown = () => onClose();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    view.addEventListener("pointerdown", onPointerDown);
    view.addEventListener("keydown", onKeyDown);
    view.addEventListener("resize", onClose);
    view.addEventListener("scroll", onClose, true);

    return () => {
      view.removeEventListener("pointerdown", onPointerDown);
      view.removeEventListener("keydown", onKeyDown);
      view.removeEventListener("resize", onClose);
      view.removeEventListener("scroll", onClose, true);
    };
  }, [isOpen, onClose, portalEl]);

  if (!isOpen || !portalEl || commands.length === 0) {
    return null;
  }

  return createPortal(
    <div
      className={getClassName()}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        left: x,
        top: y,
      }}
    >
      {groupCommands(commands).map((group) => (
        <div className={getClassName("group")} key={group.id}>
          {group.commands.map((command) => (
            <button
              aria-label={command.label}
              className={getClassName({
                item: true,
                disabled: !!command.disabled,
              })}
              disabled={command.disabled}
              key={command.id}
              onClick={() => {
                command.execute();
                onClose();
              }}
              type="button"
            >
              {command.icon && (
                <span className={getClassName("icon")}>{command.icon}</span>
              )}
              <span className={getClassName("label")}>{command.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>,
    portalEl
  );
};
