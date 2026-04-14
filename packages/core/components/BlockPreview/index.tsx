import {
  Component,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import getClassNameFactory from "../../lib/get-class-name-factory";
import { useAppStore } from "../../store";
import { ComponentData } from "../../types";
import styles from "./styles.module.css";

const getClassName = getClassNameFactory("BlockPreview", styles);

const PREVIEW_WIDTH = 320;
const PREVIEW_GAP = 8;
const PREVIEW_PADDING = 12;
const PREVIEW_MAX_HEIGHT = 320;
const PREVIEW_MIN_HEIGHT = 60;
const PREVIEW_SCALE = 0.5;

const makeSlotRenderFunc = (
  puckConfig: any,
  content: any[]
): ((props?: {
  className?: string;
  style?: React.CSSProperties;
}) => ReactNode) => {
  return ({ className, style } = {}) => (
    <div className={className} style={style}>
      {content.map((item: any, i: number) => {
        if (!item?.type) return null;

        const childDef = puckConfig.components[item.type];

        if (!childDef?.render) return null;

        const childProps = resolveSlotProps(
          puckConfig,
          childDef.fields,
          item.props || {}
        );

        return (
          <childDef.render
            key={i}
            {...childProps}
            puck={{
              isEditing: false,
              dragRef: null,
              renderDropZone: () => null,
            }}
          />
        );
      })}
    </div>
  );
};

const resolveSlotProps = (
  puckConfig: any,
  fields: any,
  props: Record<string, unknown>
): Record<string, unknown> => {
  if (!fields) return props;

  const resolved = { ...props };

  for (const [key, field] of Object.entries(
    fields as Record<string, { type?: string }>
  )) {
    if (field?.type === "slot" && Array.isArray(resolved[key])) {
      resolved[key] = makeSlotRenderFunc(puckConfig, resolved[key] as any[]);
    }
  }

  return resolved;
};

function PreviewErrorBoundary({
  children,
  name,
}: {
  children: ReactNode;
  name?: string;
}) {
  return <PreviewBoundaryInner name={name}>{children}</PreviewBoundaryInner>;
}

class PreviewBoundaryInner extends Component<
  { children: ReactNode; name?: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; name?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn(`[PuckPreview] "${this.props.name}" failed to render:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={getClassName("empty")}>
          <div className={getClassName("emptyTitle")}>Preview unavailable</div>
          <div className={getClassName("emptyText")}>
            This block could not be rendered safely in the catalog preview.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function ScaledPreview({ children }: { children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(PREVIEW_MIN_HEIGHT);

  useEffect(() => {
    const el = innerRef.current;

    if (!el) return;

    const update = () => {
      const visualHeight = el.offsetHeight * PREVIEW_SCALE;

      setContainerHeight(
        Math.min(Math.max(visualHeight, PREVIEW_MIN_HEIGHT), PREVIEW_MAX_HEIGHT)
      );
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={getClassName("viewport")}
      style={{ height: containerHeight }}
    >
      <div className={getClassName("stage")}>
        <div className={getClassName("chrome")}>
          <div className={getClassName("chromeDots")}>
            <span className={getClassName("chromeDot")} />
            <span className={getClassName("chromeDot")} />
            <span className={getClassName("chromeDot")} />
          </div>
          <div className={getClassName("chromeLabel")}>Canvas</div>
        </div>
        <div
          className={getClassName("scale")}
          ref={innerRef}
          style={{
            transform: `scale(${PREVIEW_SCALE})`,
            transformOrigin: "top left",
            width: `${100 / PREVIEW_SCALE}%`,
          }}
        >
          <div className={getClassName("canvas")}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function BlockPreviewContent({
  name,
  label,
  previewData,
}: {
  name: string;
  label?: string;
  previewData?: DrawerPreviewData;
}) {
  const config = useAppStore((s) => s.config);

  const componentConfig = config.components[name] as
    | {
        render?: React.ComponentType<any>;
        defaultProps?: Record<string, unknown>;
        label?: string;
        fields?: Record<string, { type?: string }>;
      }
    | undefined;

  const ComponentRender = componentConfig?.render;

  const previewProps = useMemo(() => {
    const sourceProps =
      previewData?.type === name
        ? previewData.props
        : componentConfig?.defaultProps ?? {};

    return resolveSlotProps(
      config,
      componentConfig?.fields,
      (sourceProps ?? {}) as Record<string, unknown>
    );
  }, [
    componentConfig?.defaultProps,
    componentConfig?.fields,
    config,
    name,
    previewData,
  ]);

  if (!ComponentRender) return null;

  return (
    <div className={getClassName("content")}>
      <div className={getClassName("header")}>
        <div className={getClassName("eyebrow")}>Block preview</div>
        <div className={getClassName("label")}>
          {label ?? componentConfig?.label ?? name}
        </div>
      </div>
      <PreviewErrorBoundary key={name} name={name}>
        <ScaledPreview>
          <ComponentRender
            {...previewProps}
            puck={{
              isEditing: false,
              dragRef: null,
              renderDropZone: () => null,
            }}
          />
        </ScaledPreview>
      </PreviewErrorBoundary>
    </div>
  );
}

type DrawerPreviewData = ComponentData;

export const BlockPreview = ({
  children,
  name,
  label,
  previewData,
}: {
  children: ReactNode;
  name: string;
  label?: string;
  previewData?: DrawerPreviewData;
}) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({
    top: PREVIEW_PADDING,
    left: PREVIEW_PADDING,
  });

  useEffect(() => {
    setRootEl(document.getElementById("puck-portal-root") ?? document.body);
  }, []);

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;

    if (!triggerEl) return;

    const rect = triggerEl.getBoundingClientRect();
    const prefersLeft =
      rect.right + PREVIEW_WIDTH + PREVIEW_GAP + PREVIEW_PADDING >
      window.innerWidth;

    const left = prefersLeft
      ? Math.max(PREVIEW_PADDING, rect.left - PREVIEW_WIDTH - PREVIEW_GAP)
      : Math.min(
          rect.right + PREVIEW_GAP,
          window.innerWidth - PREVIEW_WIDTH - PREVIEW_PADDING
        );

    const top = Math.max(
      PREVIEW_PADDING,
      Math.min(
        rect.top,
        window.innerHeight - PREVIEW_MAX_HEIGHT - PREVIEW_PADDING
      )
    );

    setPosition({ top, left });
  }, []);

  const open = useCallback(() => {
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onClose = () => close();
    const onResize = () => updatePosition();

    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onResize);
    };
  }, [close, isOpen, updatePosition]);

  return (
    <>
      <div
        className={getClassName("trigger")}
        onBlur={close}
        onFocus={open}
        onMouseEnter={open}
        onMouseLeave={close}
        ref={triggerRef}
      >
        {children}
      </div>
      {isOpen && rootEl
        ? createPortal(
            <div
              className={getClassName()}
              style={{
                top: position.top,
                left: position.left,
                width: PREVIEW_WIDTH,
              }}
            >
              <BlockPreviewContent
                label={label}
                name={name}
                previewData={previewData}
              />
            </div>,
            rootEl
          )
        : null}
    </>
  );
};
