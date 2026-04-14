import {
  CSSProperties,
  ReactNode,
  Ref,
  SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import styles from "./styles.module.css";
import "./styles.css";
import getClassNameFactory from "../../lib/get-class-name-factory";
import { Copy, CornerLeftUp, Sparkles, Star, Trash } from "lucide-react";
import { useAppStore, useAppStoreApi } from "../../store";
import { Loader } from "../Loader";
import { ActionBar } from "../ActionBar";
import { QuickInsert } from "../QuickInsert";
import { ContextMenu } from "../ContextMenu";

import { createPortal } from "react-dom";

import { dropZoneContext, DropZoneProvider } from "../DropZone";
import { createDynamicCollisionDetector } from "../../lib/dnd/collision/dynamic";
import {
  ComponentData,
  DragAxis,
  PuckInsertTarget,
  PuckUiCommand,
} from "../../types";
import { UniqueIdentifier } from "@dnd-kit/abstract";
import { getDeepScrollPosition } from "../../lib/get-deep-scroll-position";
import { DropZoneContext, ZoneStoreContext } from "../DropZone/context";
import { useShallow } from "zustand/react/shallow";
import { getItem } from "../../lib/data/get-item";
import { useSortable } from "@dnd-kit/react/sortable";
import { useContextStore } from "../../lib/use-context-store";
import { useOnDragFinished } from "../../lib/dnd/use-on-drag-finished";
import { LoadedRichTextMenu } from "../RichTextMenu";
import { usePropsContext } from "../Puck";
import {
  clonePuckFavoriteData,
  createPuckFavoriteId,
  savePuckFavorite,
} from "../../lib/favorites";
import type { NodeHandle } from "../../store/slices/nodes";
import { assignRefs } from "../../lib/assign-refs";
import {
  resolveInsertionTargetForComponentSlot,
  resolveInsertionTargetForZone,
} from "../../lib/insertion-targets";
import {
  filterCommandsBySurface,
  groupCommands,
  resolveComponentCommands,
} from "../../lib/component-commands";

const getClassName = getClassNameFactory("DraggableComponent", styles);

const DEBUG = false;
const MEASURE_EVERY_MS = 100; // 10fps

// Magic numbers are used to position actions overlay 8px from top of component, bottom of component (when sticky scrolling) and side of preview
const space = 8;
const actionsOverlayTop = space * 6.5;
const actionsTop = -(actionsOverlayTop - 8);
const actionsSide = space;

const DefaultActionBar = ({
  label,
  children,
  parentAction,
}: {
  label: string | undefined;
  children: ReactNode;
  parentAction: ReactNode;
}) => (
  <ActionBar>
    <ActionBar.Group>
      {parentAction}
      {label && <ActionBar.Label label={label} />}
    </ActionBar.Group>
    <ActionBar.Group>{children}</ActionBar.Group>
  </ActionBar>
);

const DefaultOverlay = ({
  children,
}: {
  children: ReactNode;
  hover: boolean;
  isSelected: boolean;
  componentId: string;
  componentType: string;
}) => <>{children}</>;

const InsertBeforeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M3 3.5h10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M8 6v6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M5 9h6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const InsertAfterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M3 12.5h10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M8 4v6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M5 7h6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const InsertIntoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <rect
      x="2.75"
      y="2.75"
      width="10.5"
      height="10.5"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M8 5.25v5.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M5.25 8h5.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export type ComponentDndData = {
  areaId?: string;
  zone: string;
  index: number;
  componentType: string;
  insertData?: ComponentData;
  previewData?: { data: ComponentData };
  containsActiveZone: boolean;
  depth: number;
  path: UniqueIdentifier[];
  inDroppableZone: boolean;
};

export const DraggableComponent = ({
  children,
  depth,
  componentType,
  id,
  index,
  zoneCompound,
  isLoading = false,
  isSelected = false,
  debug,
  label,
  autoDragAxis,
  userDragAxis,
  insertData,
  inDroppableZone = true,
  itemRef,
}: {
  children: (ref: Ref<any>) => ReactNode;
  componentType: string;
  depth: number;
  id: string;
  index: number;
  zoneCompound: string;
  isSelected?: boolean;
  debug?: string;
  label?: string;
  isLoading: boolean;
  autoDragAxis: DragAxis;
  userDragAxis?: DragAxis;
  insertData?: ComponentData;
  inDroppableZone: boolean;
  itemRef?: Ref<HTMLElement>;
}) => {
  const zoom = useAppStore((s) =>
    s.selectedItem?.props.id === id ? s.zoomConfig.zoom : 1
  );
  const _experimentalFullScreenCanvas = useAppStore(
    (s) => s._experimentalFullScreenCanvas
  );
  const config = useAppStore((s) => s.config);
  const commandResolvers = useAppStore((s) => s.commands.component);
  const overrides = useAppStore((s) => s.overrides);
  const dispatch = useAppStore((s) => s.dispatch);
  const iframe = useAppStore((s) => s.iframe);
  const selectedItem = useAppStore((s) => s.selectedItem || null);
  const setUi = useAppStore((s) => s.setUi);
  const { favoritesStorageKey, headerPath } = usePropsContext();
  const hasAiPlugin = useAppStore((s) =>
    s.plugins.some((p) => p.name === "ai")
  );
  const lastMeasureRef = useRef(0);

  const ctx = useContext(dropZoneContext);

  const [localZones, setLocalZones] = useState<Record<string, boolean>>({});

  const registerLocalZone = useCallback(
    (zoneCompound: string, active: boolean) => {
      // Propagate local zone
      ctx?.registerLocalZone?.(zoneCompound, active);

      setLocalZones((obj) => ({
        ...obj,
        [zoneCompound]: active,
      }));
    },
    [setLocalZones]
  );

  const unregisterLocalZone = useCallback(
    (zoneCompound: string) => {
      // Propagate local zone
      ctx?.unregisterLocalZone?.(zoneCompound);

      setLocalZones((obj) => {
        const newLocalZones = {
          ...obj,
        };

        delete newLocalZones[zoneCompound];

        return newLocalZones;
      });
    },
    [setLocalZones]
  );

  const containsActiveZone =
    Object.values(localZones).filter(Boolean).length > 0;

  const path = useAppStore(useShallow((s) => s.state.indexes.nodes[id]?.path));
  const permissions = useAppStore(
    useShallow((s) => {
      const item = getItem({ index, zone: zoneCompound }, s.state);

      return s.permissions.getPermissions({ item });
    })
  );

  const zoneStore = useContext(ZoneStoreContext);

  const [dragAxis, setDragAxis] = useState(userDragAxis || autoDragAxis);

  const dynamicCollisionDetector = useMemo(
    () => createDynamicCollisionDetector(dragAxis),
    [dragAxis]
  );

  const {
    ref: sortableRef,
    isDragging: thisIsDragging,
    sortable,
  } = useSortable<ComponentDndData>({
    id,
    index,
    group: zoneCompound,
    type: "component",
    data: {
      areaId: ctx?.areaId,
      zone: zoneCompound,
      index,
      componentType,
      insertData,
      containsActiveZone,
      depth,
      path: path || [],
      inDroppableZone,
    },
    collisionPriority: depth,
    collisionDetector: dynamicCollisionDetector,
    // "Out of the way" transition from react-beautiful-dnd
    transition: {
      duration: 200,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    },
    feedback: "clone",
  });

  useEffect(() => {
    const isEnabled = zoneStore.getState().enabledIndex[zoneCompound];

    sortable.droppable.disabled = !isEnabled;
    sortable.draggable.disabled = !permissions.drag;

    const cleanup = zoneStore.subscribe((s) => {
      sortable.droppable.disabled = !s.enabledIndex[zoneCompound];
    });

    if (ref.current && !permissions.drag) {
      ref.current.setAttribute("data-puck-disabled", "");

      return () => {
        ref.current?.removeAttribute("data-puck-disabled");
        cleanup();
      };
    }

    return cleanup;
  }, [permissions.drag, zoneCompound]);

  const [, setRerender] = useState(0);

  const ref = useRef<HTMLElement>(null);

  const refSetter = useCallback(
    (el: HTMLElement | null) => {
      sortableRef(el);

      if (ref.current !== el) {
        ref.current = el;
        setRerender((update) => update + 1);

        if (itemRef) {
          assignRefs([itemRef], el);
        }
      }
    },
    [itemRef, sortableRef]
  );

  const [portalEl, setPortalEl] = useState<HTMLElement>();

  // useLayoutEffect: ref is set during commit before this runs; useEffect runs after paint
  // and could leave portalEl undefined so createPortal falls back to the host document.body,
  // while getBoundingClientRect() still uses iframe coordinates — misplacing the action bar.
  useLayoutEffect(() => {
    setPortalEl(
      iframe.enabled
        ? ref.current?.ownerDocument.body
        : ref.current?.closest<HTMLElement>("[data-puck-preview]") ??
            document.body
    );
  }, [iframe.enabled]);

  const getStyle = useCallback(() => {
    if (!ref.current) return;

    const el = ref.current!;
    const rect = el.getBoundingClientRect();
    const portalContainerEl = iframe.enabled
      ? null
      : el.closest<HTMLElement>("[data-puck-preview]");

    const targetIsFixed = (() => {
      let node: HTMLElement | null = el;
      const root = el.ownerDocument.documentElement;

      while (node && node !== root) {
        if (getComputedStyle(node).position === "fixed") {
          return true;
        }
        node = node.parentElement;
      }

      return false;
    })();

    const portalContainerRect = portalContainerEl?.getBoundingClientRect();
    const portalScroll = portalContainerEl
      ? getDeepScrollPosition(portalContainerEl)
      : { x: 0, y: 0 };
    const deepScrollPosition = targetIsFixed
      ? { x: 0, y: 0 }
      : getDeepScrollPosition(el);

    const scroll = targetIsFixed
      ? { x: 0, y: 0 }
      : {
          x:
            deepScrollPosition.x -
            portalScroll.x -
            (portalContainerRect?.left ?? 0),
          y:
            deepScrollPosition.y -
            portalScroll.y -
            (portalContainerRect?.top ?? 0),
        };

    const style: CSSProperties = {
      left: `${rect.left + scroll.x}px`,
      top: `${rect.top + scroll.y}px`,
      height: `${rect.height}px`,
      width: `${rect.width}px`,
      position: targetIsFixed ? "fixed" : undefined,
    };

    return style;
  }, [iframe.enabled]);

  const [style, setStyle] = useState<CSSProperties>();
  const lastRectRef = useRef<DOMRectReadOnly | null>(null);

  // PERFORMANCE: coalesce multiple triggers into a single rAF'd sync
  const syncRafRef = useRef<number | null>(null);

  const sync = useCallback(() => {
    setStyle(getStyle());

    if (itemRef) {
      assignRefs([itemRef], ref.current);
    }
  }, [getStyle, itemRef]);

  const scheduleSync = useCallback(() => {
    if (syncRafRef.current != null) return;

    syncRafRef.current = requestAnimationFrame(() => {
      syncRafRef.current = null;
      sync();
    });
  }, [sync]);

  useEffect(() => {
    return () => {
      if (syncRafRef.current != null) {
        cancelAnimationFrame(syncRafRef.current);
        syncRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (ref.current) {
      const observer = new ResizeObserver(() => {
        scheduleSync();
      });

      observer.observe(ref.current);

      return () => {
        observer.disconnect();
      };
    }
  }, [scheduleSync, itemRef]);

  const registerNode = useAppStore((s) => s.nodes.registerNode);
  const unregisterNode = useAppStore((s) => s.nodes.unregisterNode);

  const hideOverlay = useCallback(() => {
    setIsVisible(false);
  }, []);

  const showOverlay = useCallback(() => {
    setIsVisible(true);
  }, []);

  const nodeHandleRef = useRef<NodeHandle>({
    sync: () => null,
    hideOverlay: () => null,
    showOverlay: () => null,
  });

  useLayoutEffect(() => {
    nodeHandleRef.current.sync = sync;
    nodeHandleRef.current.hideOverlay = hideOverlay;
    nodeHandleRef.current.showOverlay = showOverlay;
  }, [hideOverlay, showOverlay, sync]);

  useEffect(() => {
    registerNode(id, nodeHandleRef.current);

    return () => {
      unregisterNode(id);
    };
  }, [id, registerNode, unregisterNode]);

  const CustomActionBar = useMemo(
    () => overrides.actionBar || DefaultActionBar,
    [overrides.actionBar]
  );

  const CustomOverlay = useMemo(
    () => overrides.componentOverlay || DefaultOverlay,
    [overrides.componentOverlay]
  );

  const onClick = useCallback(
    (e: Event | SyntheticEvent) => {
      // Don't change selection during a drag.
      // This avoids mouseup clicks selecting the dragged-over component.
      const userIsDragging = !!zoneStore.getState().draggedItem;
      if (userIsDragging) {
        return;
      }

      const el = e.target as Element;

      if (!el.closest("[data-puck-overlay-portal]")) {
        e.stopPropagation();
      }

      if (_experimentalFullScreenCanvas) {
        dispatch({
          type: "setUi",
          ui: {
            itemSelector: isSelected ? null : { index, zone: zoneCompound },
          },
        });
      } else {
        dispatch({
          type: "setUi",
          ui: {
            itemSelector: { index, zone: zoneCompound },
          },
        });
      }
    },
    [index, zoneCompound, id, isSelected, _experimentalFullScreenCanvas]
  );

  const appStore = useAppStoreApi();
  const [quickInsertTarget, setQuickInsertTarget] = useState<{
    target: PuckInsertTarget;
    title: string;
  } | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const openQuickInsert = useCallback(
    ({ target, title }: { target: PuckInsertTarget; title: string }) => {
      setContextMenuPosition(null);
      setQuickInsertTarget({
        target,
        title,
      });
    },
    []
  );

  const onSelectParent = useCallback(() => {
    const { nodes, zones } = appStore.getState().state.indexes;
    const node = nodes[id];

    const parentNode = node?.parentId ? nodes[node?.parentId] : null;

    if (!parentNode || !node.parentId) {
      return;
    }

    const parentZoneCompound = `${parentNode.parentId}:${parentNode.zone}`;

    const parentIndex = zones[parentZoneCompound].contentIds.indexOf(
      node.parentId
    );

    dispatch({
      type: "setUi",
      ui: {
        itemSelector: {
          zone: parentZoneCompound,
          index: parentIndex,
        },
      },
    });
  }, [ctx, path]);

  const onDuplicate = useCallback(() => {
    dispatch({
      type: "duplicate",
      sourceIndex: index,
      sourceZone: zoneCompound,
    });
  }, [index, zoneCompound]);

  const onDelete = useCallback(() => {
    dispatch({
      type: "remove",
      index: index,
      zone: zoneCompound,
    });
  }, [index, zoneCompound]);

  const beforeTarget = useMemo(
    () =>
      resolveInsertionTargetForZone({
        config,
        destinationIndex: index,
        state: appStore.getState().state,
        zoneCompound,
      }),
    [appStore, config, index, zoneCompound]
  );

  const afterTarget = useMemo(
    () =>
      resolveInsertionTargetForZone({
        config,
        destinationIndex: index + 1,
        state: appStore.getState().state,
        zoneCompound,
      }),
    [appStore, config, index, zoneCompound]
  );

  const intoTarget = useMemo(
    () =>
      resolveInsertionTargetForComponentSlot({
        componentId: id,
        componentType,
        config,
        state: appStore.getState().state,
      }),
    [appStore, componentType, config, id]
  );

  const onAiEdit = useCallback(() => {
    // Select the component and navigate to the AI panel
    dispatch({
      type: "setUi",
      ui: {
        itemSelector: { index, zone: zoneCompound },
        plugin: { current: "ai" },
        leftSideBarVisible: true,
      },
    });

    // Pass the unique component ID + type so the AI can unambiguously
    // target this specific instance even among duplicate block types
    requestAnimationFrame(() => {
      const puckAi = (window as any).__PUCK_AI as
        | {
            setTargetComponent?: (
              t: {
                id: string;
                type: string;
                label?: string;
              } | null
            ) => void;
          }
        | undefined;
      puckAi?.setTargetComponent?.({
        id,
        type: componentType,
        label: label || componentType,
      });
    });
  }, [id, index, zoneCompound, label, componentType]);

  const onFavorite = useCallback(() => {
    if (typeof window === "undefined") return;

    const item = getItem(
      {
        zone: zoneCompound,
        index,
      },
      appStore.getState().state
    );

    if (!item) return;

    const favoriteName = window.prompt(
      "Favorite name",
      label || componentType || item.type
    );

    if (!favoriteName || favoriteName.trim() === "") {
      return;
    }

    savePuckFavorite(
      {
        id: createPuckFavoriteId("favorite-component"),
        kind: "component",
        name: favoriteName.trim(),
        createdAt: new Date().toISOString(),
        sourcePath: headerPath,
        componentType: item.type,
        data: clonePuckFavoriteData(item),
      },
      favoritesStorageKey
    );

    window.alert(`Saved "${favoriteName.trim()}" to favorites.`);
  }, [
    appStore,
    componentType,
    favoritesStorageKey,
    headerPath,
    index,
    label,
    zoneCompound,
  ]);

  const intoLabel =
    intoTarget?.slotFieldName &&
    !["children", "content", "items"].includes(intoTarget.slotFieldName)
      ? `Insert into ${intoTarget.slotFieldName}`
      : "Insert into";

  const defaultCommands = useMemo<PuckUiCommand[]>(() => {
    const commands: PuckUiCommand[] = [];

    if (ctx?.areaId && ctx.areaId !== "root") {
      commands.push({
        id: "select-parent",
        label: "Select parent",
        icon: <CornerLeftUp size={16} />,
        group: "hierarchy",
        order: 10,
        execute: onSelectParent,
      });
    }

    if (permissions.insert) {
      commands.push(
        {
          id: "insert-before",
          label: "Insert before",
          icon: <InsertBeforeIcon />,
          group: "insert",
          order: 20,
          execute: () =>
            openQuickInsert({
              target: beforeTarget,
              title: "Insert block before",
            }),
        },
        {
          id: "insert-after",
          label: "Insert after",
          icon: <InsertAfterIcon />,
          group: "insert",
          order: 21,
          execute: () =>
            openQuickInsert({
              target: afterTarget,
              title: "Insert block after",
            }),
        },
        {
          id: "insert-into",
          label: intoLabel,
          disabled: !intoTarget,
          icon: <InsertIntoIcon />,
          group: "insert",
          order: 22,
          execute: () => {
            if (!intoTarget) return;

            openQuickInsert({
              target: intoTarget,
              title:
                intoLabel === "Insert into" ? "Insert block into" : intoLabel,
            });
          },
        }
      );
    }

    if (hasAiPlugin) {
      commands.push({
        id: "ai-edit",
        label: "Edit with AI",
        icon: <Sparkles size={16} />,
        group: "ai",
        order: 30,
        execute: onAiEdit,
      });
    }

    if (permissions.drag) {
      commands.push({
        id: "favorite",
        label: "Favorite",
        icon: <Star size={16} />,
        group: "library",
        order: 40,
        execute: onFavorite,
      });
    }

    if (permissions.duplicate) {
      commands.push({
        id: "duplicate",
        label: "Duplicate",
        icon: <Copy size={16} />,
        group: "clipboard",
        order: 50,
        execute: onDuplicate,
      });
    }

    if (permissions.delete) {
      commands.push({
        id: "delete",
        label: "Delete",
        icon: <Trash size={16} />,
        group: "destructive",
        order: 60,
        execute: onDelete,
      });
    }

    return commands;
  }, [
    afterTarget,
    beforeTarget,
    ctx?.areaId,
    hasAiPlugin,
    intoLabel,
    intoTarget,
    onAiEdit,
    onDelete,
    onDuplicate,
    onFavorite,
    onSelectParent,
    openQuickInsert,
    permissions.delete,
    permissions.drag,
    permissions.duplicate,
    permissions.insert,
  ]);

  const componentCommandContext = useMemo(
    () => ({
      appState: appStore.getState().state,
      componentId: id,
      componentType,
      config,
      dispatch,
      index,
      insertTargets: {
        after: afterTarget,
        before: beforeTarget,
        into: intoTarget,
      },
      isSelected,
      label,
      openQuickInsert,
      permissions,
      selectedItem,
      setUi,
      zone: zoneCompound,
    }),
    [
      afterTarget,
      appStore,
      beforeTarget,
      componentType,
      config,
      dispatch,
      id,
      index,
      intoTarget,
      isSelected,
      label,
      openQuickInsert,
      permissions,
      selectedItem,
      setUi,
      zoneCompound,
    ]
  );

  const resolvedCommands = useMemo(
    () =>
      resolveComponentCommands({
        commandResolvers,
        context: componentCommandContext,
        defaults: defaultCommands,
      }),
    [commandResolvers, componentCommandContext, defaultCommands]
  );

  const actionBarCommands = useMemo(
    () => filterCommandsBySurface(resolvedCommands, "actionBar"),
    [resolvedCommands]
  );

  const contextMenuCommands = useMemo(
    () => filterCommandsBySurface(resolvedCommands, "contextMenu"),
    [resolvedCommands]
  );

  const [hover, setHover] = useState(false);

  const indicativeHover = useContextStore(
    ZoneStoreContext,
    (s) => s.hoveringComponent === id
  );

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const el = ref.current as HTMLElement;

    const _onMouseOver = (e: Event) => {
      const userIsDragging = !!zoneStore.getState().draggedItem;

      if (userIsDragging) {
        // User is dragging, and dragging this item
        if (thisIsDragging) {
          setHover(true);
        } else {
          setHover(false);
        }
      } else {
        setHover(true);
      }

      e.stopPropagation();
    };

    const _onMouseOut = (e: Event) => {
      e.stopPropagation();

      setHover(false);
    };

    const _onContextMenu = (e: Event) => {
      const userIsDragging = !!zoneStore.getState().draggedItem;

      if (userIsDragging) {
        return;
      }

      const event = e as MouseEvent;
      event.preventDefault();
      event.stopPropagation();

      setUi({
        itemSelector: { index, zone: zoneCompound },
      });
      setContextMenuPosition({
        x: event.clientX,
        y: event.clientY,
      });
    };

    el.setAttribute("data-puck-component", id);
    el.setAttribute("data-puck-dnd", id);
    el.style.position = "relative";
    el.addEventListener("click", onClick);
    el.addEventListener("contextmenu", _onContextMenu);
    el.addEventListener("mouseover", _onMouseOver);
    el.addEventListener("mouseout", _onMouseOut);

    return () => {
      el.removeAttribute("data-puck-component");
      el.removeAttribute("data-puck-dnd");
      el.removeEventListener("click", onClick);
      el.removeEventListener("contextmenu", _onContextMenu);
      el.removeEventListener("mouseover", _onMouseOver);
      el.removeEventListener("mouseout", _onMouseOut);
    };
  }, [
    ref.current, // Remount attributes if the element changes
    onClick,
    containsActiveZone,
    zoneCompound,
    id,
    thisIsDragging,
    inDroppableZone,
    setUi,
  ]);

  const [isVisible, setIsVisible] = useState(false);
  const [dragFinished, setDragFinished] = useState(true);
  const [_, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      if (hover || indicativeHover || isSelected) {
        scheduleSync();
        setIsVisible(true);
        setThisWasDragging(false);
      } else {
        setIsVisible(false);
      }
    });
  }, [hover, indicativeHover, isSelected, iframe]);

  const [thisWasDragging, setThisWasDragging] = useState(false);

  const onDragFinished = useOnDragFinished((finished) => {
    if (finished) {
      startTransition(() => {
        // Sync immediately, to avoid a flash of the overlay in the wrong place.
        sync();
        setDragFinished(true);
      });
    } else {
      setDragFinished(false);
    }
  });

  useEffect(() => {
    if (thisIsDragging) {
      setThisWasDragging(true);
    }
  }, [thisIsDragging]);

  useEffect(() => {
    if (thisWasDragging) return onDragFinished();
  }, [thisWasDragging, onDragFinished]);

  // PERFORMANCE: when visible, respond to scroll/resize + track layout shifts without a global rAF loop
  useEffect(() => {
    if (!dragFinished || !(isSelected || thisIsDragging)) return;

    const el = ref.current;
    if (!el) return;

    const doc = el.ownerDocument;
    const view = doc.defaultView;
    if (!view) return;

    lastMeasureRef.current = 0;
    scheduleSync(); // immediate position on show

    const onScroll = () => scheduleSync();
    const onResize = () => scheduleSync();

    doc.addEventListener("scroll", onScroll, true);
    view.addEventListener("resize", onResize);

    let frame = 0;
    const tick = (t: number) => {
      if (t - lastMeasureRef.current >= MEASURE_EVERY_MS) {
        lastMeasureRef.current = t;

        const node = ref.current;
        if (node) {
          const rect = node.getBoundingClientRect();
          const prev = lastRectRef.current;

          const changed =
            !prev ||
            Math.abs(rect.x - prev.x) > 0.5 ||
            Math.abs(rect.y - prev.y) > 0.5 ||
            Math.abs(rect.width - prev.width) > 0.5 ||
            Math.abs(rect.height - prev.height) > 0.5;

          if (changed) {
            lastRectRef.current = rect;
            scheduleSync();
          }
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      doc.removeEventListener("scroll", onScroll, true);
      view.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
    };
  }, [dragFinished, isSelected, thisIsDragging, scheduleSync]);

  const syncActionsPosition = useCallback(
    (el: HTMLDivElement | null | undefined) => {
      if (el) {
        const view = el.ownerDocument.defaultView;

        if (view) {
          const rect = el.getBoundingClientRect();

          const diffLeft = rect.x;
          const exceedsBoundsLeft = diffLeft < 0;
          const diffTop = rect.y;
          const exceedsBoundsTop = diffTop < 0;

          // Modify position if it spills over frame
          if (exceedsBoundsLeft) {
            el.style.transformOrigin = "left top";
            el.style.left = "0px";
          }

          if (exceedsBoundsTop) {
            el.style.top = "12px";
            if (!exceedsBoundsLeft) {
              el.style.transformOrigin = "right top";
            }
          }
        }
      }
    },
    [zoom]
  );

  useEffect(() => {
    if (userDragAxis) {
      setDragAxis(userDragAxis);
      return;
    }

    if (ref.current) {
      const computedStyle = window.getComputedStyle(ref.current);

      if (
        computedStyle.display === "inline" ||
        computedStyle.display === "inline-block"
      ) {
        setDragAxis("x");

        return;
      }
    }

    setDragAxis(autoDragAxis);
  }, [ref, userDragAxis, autoDragAxis]);

  const nextContextValue = useMemo<DropZoneContext>(
    () => ({
      ...ctx!,
      areaId: id,
      zoneCompound,
      index,
      depth: depth + 1,
      registerLocalZone,
      unregisterLocalZone,
    }),
    [
      ctx,
      id,
      zoneCompound,
      index,
      depth,
      registerLocalZone,
      unregisterLocalZone,
    ]
  );

  const richText = useAppStore((s) =>
    s.currentRichText?.inlineComponentId === id ? s.currentRichText : null
  );

  const actionBarGroups = useMemo(
    () => groupCommands(actionBarCommands),
    [actionBarCommands]
  );
  const hasNormalActions = actionBarCommands.length > 0;

  return (
    <DropZoneProvider value={nextContextValue}>
      {dragFinished &&
        isVisible &&
        createPortal(
          <div
            className={getClassName({
              isSelected,
              isDragging: thisIsDragging,
              hover: hover || indicativeHover,
            })}
            style={{ ...style }}
            data-puck-overlay
          >
            {debug}
            {isLoading && (
              <div className={getClassName("loadingOverlay")}>
                <Loader />
              </div>
            )}
            <div
              className={getClassName("actionsOverlay")}
              style={{
                top: actionsOverlayTop / zoom,
              }}
            >
              <div
                className={getClassName("actions")}
                style={{
                  transform: `scale(${1 / zoom}`,
                  top: actionsTop / zoom,
                  right: 0,
                  paddingLeft: actionsSide,
                  paddingRight: actionsSide,
                }}
                ref={syncActionsPosition}
              >
                <CustomActionBar parentAction={null} label={DEBUG ? id : label}>
                  {richText && (
                    <>
                      <LoadedRichTextMenu
                        editor={richText.editor}
                        field={richText.field}
                        inline
                        readOnly={false}
                      />
                      {hasNormalActions && <ActionBar.Separator />}
                    </>
                  )}
                  {actionBarGroups.map((group) => (
                    <ActionBar.Group key={group.id}>
                      {group.commands.map((command) => (
                        <ActionBar.Action
                          disabled={command.disabled}
                          key={command.id}
                          label={command.label}
                          onClick={command.execute}
                        >
                          {command.icon || command.label}
                        </ActionBar.Action>
                      ))}
                    </ActionBar.Group>
                  ))}
                </CustomActionBar>
              </div>
            </div>
            <div className={getClassName("overlayWrapper")}>
              <CustomOverlay
                componentId={id}
                componentType={componentType}
                hover={hover}
                isSelected={isSelected}
              >
                <div className={getClassName("overlay")}></div>
              </CustomOverlay>
            </div>
          </div>,
          portalEl || document.body
        )}
      {quickInsertTarget && (
        <QuickInsert
          allow={quickInsertTarget.target.allow}
          destinationIndex={quickInsertTarget.target.destinationIndex}
          destinationZone={quickInsertTarget.target.destinationZone}
          disallow={quickInsertTarget.target.disallow}
          isOpen
          onClose={() => setQuickInsertTarget(null)}
          title={quickInsertTarget.title}
        />
      )}
      <ContextMenu
        commands={contextMenuCommands}
        isOpen={!!contextMenuPosition}
        onClose={() => setContextMenuPosition(null)}
        portalEl={ref.current?.ownerDocument.body}
        x={contextMenuPosition?.x ?? 0}
        y={contextMenuPosition?.y ?? 0}
      />
      {children(refSetter)}
    </DropZoneProvider>
  );
};
