import styles from "./styles.module.css";
import getClassNameFactory from "../../lib/get-class-name-factory";
import { ReactNode, useEffect } from "react";
import { useAppStore } from "../../store";
import { useMessage } from "../../lib/use-message";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Drawer } from "../Drawer";
import { DrawerItemData } from "../Drawer";

const getClassName = getClassNameFactory("ComponentList", styles);

const ComponentListItem = ({
  name,
  label,
  data,
  isDragDisabled,
  onRemoveFavorite,
}: {
  name: string;
  label?: string;
  data?: DrawerItemData;
  index?: number; // TODO deprecate
  isDragDisabled?: boolean;
  onRemoveFavorite?: () => void;
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
      onRemove={onRemoveFavorite}
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

  const contentId = `puck-drawer-category-${id}`;

  const collapseTitle = useMessage("drawer-category-collapse", {
    title: title ?? "",
  });
  const expandTitle = useMessage("drawer-category-expand", {
    title: title ?? "",
  });

  return (
    <div className={getClassName({ isExpanded })}>
      {title && (
        <button
          type="button"
          className={getClassName("title")}
          aria-expanded={expanded}
          aria-controls={contentId}
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
          title={isExpanded ? collapseTitle : expandTitle}
        >
          <div>{title}</div>
          <div className={getClassName("titleIcon")}>
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        </button>
      )}
      <div className={getClassName("content")} id={contentId}>
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
