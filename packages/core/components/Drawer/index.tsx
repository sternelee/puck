import styles from "./styles.module.css";
import getClassNameFactory from "../../lib/get-class-name-factory";
import { DragIcon } from "../DragIcon";
import { ReactElement, ReactNode, Ref, useMemo, useState } from "react";
import { generateId } from "../../lib/generate-id";
import { useDragListener } from "../DragDropContext";
import { useSafeId } from "../../lib/use-safe-id";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import { ComponentData } from "../../types";
import { useAppStore } from "../../store";
import { populateIds } from "../../lib/data/populate-ids";
import { BlockPreview } from "../BlockPreview";

const getClassName = getClassNameFactory("Drawer", styles);
const getClassNameItem = getClassNameFactory("DrawerItem", styles);

export type DrawerItemData = ComponentData;

export const DrawerItemInner = ({
  children,
  name,
  label,
  data,
  dragRef,
  isDragDisabled,
}: {
  children?: (props: { children: ReactNode; name: string }) => ReactElement;
  name: string;
  label?: string;
  data?: DrawerItemData;
  dragRef?: Ref<HTMLDivElement>;
  isDragDisabled?: boolean;
}) => {
  const CustomInner = useMemo(
    () =>
      children ||
      (({ children }: { children: ReactNode; name: string }) => (
        <BlockPreview label={label} name={name} previewData={data}>
          <div className={getClassNameItem("default")}>{children}</div>
        </BlockPreview>
      )),
    [children, data, label, name]
  );

  return (
    <div
      className={getClassNameItem({ disabled: isDragDisabled })}
      ref={dragRef}
      onMouseDown={(e) => e.preventDefault()}
      data-testid={dragRef ? `drawer-item:${name}` : ""}
      data-puck-drawer-item
    >
      <CustomInner name={name}>
        <div className={getClassNameItem("draggableWrapper")}>
          <div className={getClassNameItem("draggable")}>
            <div className={getClassNameItem("name")}>{label ?? name}</div>
            <div className={getClassNameItem("icon")}>
              <DragIcon />
            </div>
          </div>
        </div>
      </CustomInner>
    </div>
  );
};

/**
 * Wrap `useDraggable`, remounting it when the `id` changes.
 *
 * Could be removed by remounting `useDraggable` upstream in dndkit on `id` changes.
 */
const DrawerItemDraggable = ({
  children,
  name,
  label,
  id,
  data,
  isDragDisabled,
}: {
  children?: (props: { children: ReactNode; name: string }) => ReactElement;
  name: string;
  label?: string;
  id: string;
  data?: DrawerItemData;
  isDragDisabled?: boolean;
}) => {
  const config = useAppStore((s) => s.config);
  const previewData = useMemo(() => {
    if (!data) return undefined;

    const populatedData = populateIds(data, config, true);

    return {
      data: {
        type: populatedData.type,
        props: {
          id: populatedData.props.id,
        },
      } as ComponentData,
    };
  }, [config, data]);

  const { ref } = useDraggable({
    id,
    data: { componentType: name, insertData: data, previewData },
    disabled: isDragDisabled,
    type: "drawer",
  });

  return (
    <div className={getClassName("draggable")}>
      <div className={getClassName("draggableBg")}>
        <DrawerItemInner name={name} label={label}>
          {children}
        </DrawerItemInner>
      </div>
      <div className={getClassName("draggableFg")}>
        <DrawerItemInner
          data={data}
          name={name}
          label={label}
          dragRef={ref}
          isDragDisabled={isDragDisabled}
        >
          {children}
        </DrawerItemInner>
      </div>
    </div>
  );
};

const DrawerItem = ({
  name,
  children,
  id,
  label,
  data,
  index,
  isDragDisabled,
}: {
  name: string;
  children?: (props: { children: ReactNode; name: string }) => ReactElement;
  id?: string;
  label?: string;
  data?: DrawerItemData;
  index?: number; // TODO deprecate
  isDragDisabled?: boolean;
}) => {
  const resolvedId = id || name;
  const [dynamicId, setDynamicId] = useState(generateId(resolvedId));

  if (typeof index !== "undefined") {
    console.error(
      "Warning: The `index` prop on Drawer.Item is deprecated and no longer required."
    );
  }

  useDragListener(
    "dragend",
    () => {
      setDynamicId(generateId(resolvedId));
    },
    [resolvedId]
  );

  return (
    <div key={dynamicId}>
      <DrawerItemDraggable
        name={name}
        label={label}
        id={dynamicId}
        data={data}
        isDragDisabled={isDragDisabled}
      >
        {children}
      </DrawerItemDraggable>
    </div>
  );
};

export const Drawer = ({
  children,
  droppableId,
  direction,
}: {
  children: ReactNode;
  droppableId?: string; // TODO deprecate
  direction?: "vertical" | "horizontal"; // TODO deprecate
}) => {
  if (droppableId) {
    console.error(
      "Warning: The `droppableId` prop on Drawer is deprecated and no longer required."
    );
  }

  if (direction) {
    console.error(
      "Warning: The `direction` prop on Drawer is deprecated and no longer required to achieve multi-directional dragging."
    );
  }

  const id = useSafeId();

  const { ref } = useDroppable({
    id,
    type: "void",
    collisionPriority: 0, // Never collide with this, but we use it so NestedDroppablePlugin respects the Drawer
  });

  return (
    <div
      className={getClassName()}
      ref={ref}
      data-puck-dnd={id}
      data-puck-drawer
      data-puck-dnd-void
    >
      {children}
    </div>
  );
};

Drawer.Item = DrawerItem;
