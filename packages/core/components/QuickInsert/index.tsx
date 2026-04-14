import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAppStore, useAppStoreApi } from "../../store";
import { Modal } from "../Modal";
import { Heading } from "../Heading";
import styles from "./styles.module.css";
import getClassNameFactory from "../../lib/get-class-name-factory";
import { Search, Star } from "lucide-react";
import { usePropsContext } from "../Puck";
import {
  PuckFavoriteComponent,
  PUCK_FAVORITES_UPDATED_EVENT,
} from "../../lib/favorites";
import {
  buildBlockCatalogSections,
  readFavoriteComponents,
} from "../../lib/block-catalog";
import { generateId } from "../../lib/generate-id";
import { getSelectorForId } from "../../lib/get-selector-for-id";
import { BlockPreview } from "../BlockPreview";

const getClassName = getClassNameFactory("QuickInsert", styles);

type QuickInsertProps = {
  allow?: string[];
  destinationIndex?: number;
  destinationZone: string;
  disallow?: string[];
  isOpen: boolean;
  onClose: () => void;
  title?: string;
};

export const QuickInsert = ({
  allow,
  destinationIndex = 0,
  destinationZone,
  disallow,
  isOpen,
  onClose,
  title = "Quick insert",
}: QuickInsertProps) => {
  const config = useAppStore((s) => s.config);
  const dispatch = useAppStore((s) => s.dispatch);
  const overrides = useAppStore((s) => s.overrides);
  const setUi = useAppStore((s) => s.setUi);
  const uiComponentList = useAppStore((s) => s.state.ui.componentList);
  const appStore = useAppStoreApi();
  const { favoritesStorageKey } = usePropsContext();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [favorites, setFavorites] = useState<PuckFavoriteComponent[]>(() =>
    readFavoriteComponents({
      allow,
      components: config.components,
      disallow,
      favoritesStorageKey,
    })
  );

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    const syncFavorites = () => {
      setFavorites(
        readFavoriteComponents({
          allow,
          components: config.components,
          disallow,
          favoritesStorageKey,
        })
      );
    };

    syncFavorites();

    window.addEventListener(
      PUCK_FAVORITES_UPDATED_EVENT,
      syncFavorites as EventListener
    );
    window.addEventListener("storage", syncFavorites);

    return () => {
      window.removeEventListener(
        PUCK_FAVORITES_UPDATED_EVENT,
        syncFavorites as EventListener
      );
      window.removeEventListener("storage", syncFavorites);
    };
  }, [allow, config.components, disallow, favoritesStorageKey, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [isOpen, destinationZone]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const { resultCount, sections } = useMemo(
    () =>
      buildBlockCatalogSections({
        allow,
        components: config.components,
        disallow,
        favorites,
        query,
        uiComponentList,
      }),
    [allow, config.components, disallow, favorites, query, uiComponentList]
  );

  const flatItems = useMemo(
    () =>
      sections.flatMap((section) =>
        section.items.map((item) => ({
          item,
          key: item.key,
          sectionId: section.id,
        }))
      ),
    [sections]
  );

  const itemIndexByKey = useMemo(
    () =>
      flatItems.reduce<Record<string, number>>((acc, entry, index) => {
        acc[entry.key] = index;
        return acc;
      }, {}),
    [flatItems]
  );
  const DrawerItemOverride = overrides.componentItem ?? overrides.drawerItem;

  useEffect(() => {
    if (flatItems.length === 0) {
      setActiveIndex(0);
      itemRefs.current = [];
      return;
    }

    setActiveIndex((current) => Math.min(current, flatItems.length - 1));
    itemRefs.current = itemRefs.current.slice(0, flatItems.length);
  }, [flatItems]);

  useEffect(() => {
    if (!isOpen || flatItems.length === 0) return;

    itemRefs.current[activeIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex, flatItems, isOpen]);

  const insertItem = (item: (typeof flatItems)[number]["item"]) => {
    const id = generateId(item.name);

    dispatch({
      type: "insert",
      componentType: item.name,
      data: item.data,
      destinationIndex,
      destinationZone,
      id,
    });

    const latestSelector = getSelectorForId(appStore.getState().state, id);

    setUi({
      itemSelector: latestSelector ?? null,
      rightSideBarVisible: true,
    });
    onClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (flatItems.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % flatItems.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + flatItems.length) % flatItems.length
      );
    }

    if (event.key === "Enter") {
      event.preventDefault();
      insertItem(flatItems[activeIndex].item);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className={getClassName()}>
        <div className={getClassName("header")}>
          <Heading rank="2" size="s">
            {title}
          </Heading>
          <div className={getClassName("summary")}>
            {resultCount} result{resultCount === 1 ? "" : "s"}
          </div>
        </div>
        <div className={getClassName("searchRow")}>
          <label
            className={getClassName("search")}
            htmlFor="puck-quick-insert-search"
          >
            <span className={getClassName("searchLabel")}>
              Search blocks to insert
            </span>
            <div className={getClassName("searchIcon")}>
              <Search size={16} />
            </div>
            <input
              autoComplete="off"
              autoFocus
              aria-activedescendant={
                flatItems[activeIndex]
                  ? `puck-quick-insert-item-${activeIndex}`
                  : undefined
              }
              aria-label="Search blocks to insert"
              aria-controls="puck-quick-insert-results"
              className={getClassName("searchInput")}
              id="puck-quick-insert-search"
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setQuery(event.currentTarget.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="Search blocks"
              role="combobox"
              aria-expanded={flatItems.length > 0}
              aria-autocomplete="list"
              type="search"
              value={query}
            />
          </label>
        </div>
        {sections.length > 0 ? (
          <div
            className={getClassName("body")}
            id="puck-quick-insert-results"
            role="listbox"
          >
            {sections.map((section) => (
              <section className={getClassName("section")} key={section.id}>
                {section.title && (
                  <div className={getClassName("sectionTitle")}>
                    {section.title}
                  </div>
                )}
                <div className={getClassName("items")}>
                  {section.items.map((item) => {
                    const itemIndex = itemIndexByKey[item.key];
                    const isActive = itemIndex === activeIndex;

                    return (
                      <button
                        aria-selected={isActive}
                        className={getClassName({ item: true, isActive })}
                        id={`puck-quick-insert-item-${itemIndex}`}
                        key={item.key}
                        onClick={() => insertItem(item)}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        ref={(node) => {
                          itemRefs.current[itemIndex] = node;
                        }}
                        role="option"
                        type="button"
                      >
                        {DrawerItemOverride ? (
                          <DrawerItemOverride name={item.name}>
                            <>
                              <div className={getClassName("itemTitle")}>
                                {item.label}
                              </div>
                              <div className={getClassName("itemMeta")}>
                                {item.data ? "Favorite" : "Block"} · {item.name}
                              </div>
                            </>
                          </DrawerItemOverride>
                        ) : (
                          <BlockPreview
                            label={item.label}
                            name={item.name}
                            previewData={item.data}
                          >
                            <>
                              <div className={getClassName("itemTitle")}>
                                {item.label}
                              </div>
                              <div className={getClassName("itemMeta")}>
                                {item.data ? "Favorite" : "Block"} · {item.name}
                              </div>
                            </>
                          </BlockPreview>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className={getClassName("empty")}>
            <div className={getClassName("emptyIcon")}>
              <Star size={16} />
            </div>
            <div className={getClassName("emptyTitle")}>No matching blocks</div>
            <div className={getClassName("emptyText")}>
              Try a different keyword or adjust the allowed blocks for this
              area.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
