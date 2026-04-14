import styles from "./styles.module.css";
import getClassNameFactory from "../../lib/get-class-name-factory";
import { ReactNode, useEffect } from "react";
import { useAppStore } from "../../store";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Drawer } from "../Drawer";
import { DrawerItemData } from "../Drawer";

const getClassName = getClassNameFactory("ComponentList", styles);

const ComponentListItem = ({
  name,
  label,
  data,
  isDragDisabled,
}: {
  name: string;
  label?: string;
  data?: DrawerItemData;
  index?: number; // TODO deprecate
  isDragDisabled?: boolean;
}) => {
  const overrides = useAppStore((s) => s.overrides);
  const canInsert = useAppStore(
    (s) =>
      s.permissions.getPermissions({
        type: name,
      }).insert
  );

  // DEPRECATED
  useEffect(() => {
    if (overrides.componentItem) {
      console.warn(
        "The `componentItem` override has been deprecated and renamed to `drawerItem`"
      );
    }
  }, [overrides]);

  return (
    <Drawer.Item
      label={label}
      name={name}
      data={data}
      isDragDisabled={isDragDisabled ?? !canInsert}
    >
      {overrides.componentItem ?? overrides.drawerItem}
    </Drawer.Item>
  );
};

const ComponentList = ({
  children,
  title,
  id,
  forceExpanded = false,
}: {
  id: string;
  children?: ReactNode;
  title?: string;
  forceExpanded?: boolean;
}) => {
  const config = useAppStore((s) => s.config);
  const setUi = useAppStore((s) => s.setUi);
  const componentList = useAppStore((s) => s.state.ui.componentList);

  const { expanded = true } = componentList[id] || {};
  const isExpanded = forceExpanded || expanded;

  return (
    <div className={getClassName({ isExpanded })}>
      {title && (
        <button
          type="button"
          className={getClassName("title")}
          onClick={() =>
            setUi({
              componentList: {
                ...componentList,
                [id]: {
                  ...componentList[id],
                  expanded: !expanded,
                },
              },
            })
          }
          title={
            isExpanded
              ? `Collapse${title ? ` ${title}` : ""}`
              : `Expand${title ? ` ${title}` : ""}`
          }
        >
          <div>{title}</div>
          <div className={getClassName("titleIcon")}>
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        </button>
      )}
      <div className={getClassName("content")}>
        <Drawer>
          {children ||
            Object.keys(config.components).map((componentKey) => {
              return (
                <ComponentListItem
                  key={componentKey}
                  label={
                    config.components[componentKey]["label"] ?? componentKey
                  }
                  name={componentKey}
                />
              );
            })}
        </Drawer>
      </div>
    </div>
  );
};

ComponentList.Item = ComponentListItem;

export { ComponentList };
