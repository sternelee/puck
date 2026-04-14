import { useAppStore } from "../../../../store";
import { ComponentList } from "../../../ComponentList";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { PUCK_FAVORITES_UPDATED_EVENT } from "../../../../lib/favorites";
import {
  focusBlocksSearch,
  getBlocksShortcutLabel,
  PUCK_BLOCK_SEARCH_ID,
  PUCK_FOCUS_BLOCKS_EVENT,
} from "../../../../lib/blocks";
import {
  buildBlockCatalogSections,
  readFavoriteComponents,
} from "../../../../lib/block-catalog";
import { usePropsContext } from "../../index";
import styles from "./styles.module.css";
import getClassNameFactory from "../../../../lib/get-class-name-factory";
import { Search, Star } from "lucide-react";

const getClassName = getClassNameFactory("PuckComponents", styles);

export const Components = () => {
  const overrides = useAppStore((s) => s.overrides);
  const config = useAppStore((s) => s.config);
  const uiComponentList = useAppStore((s) => s.state.ui.componentList);
  const { favoritesStorageKey } = usePropsContext();
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(
    readFavoriteComponents({
      components: config.components,
      favoritesStorageKey,
    })
  );
  const normalizedQuery = query.trim().toLowerCase();
  const shortcutLabel = useMemo(() => getBlocksShortcutLabel(), []);

  const Wrapper = useMemo(() => {
    // DEPRECATED
    if (overrides.components) {
      console.warn(
        "The `components` override has been deprecated and renamed to `drawer`"
      );
    }
    return overrides.components || overrides.drawer || "div";
  }, [overrides]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFavorites = () => {
      const nextFavorites = readFavoriteComponents({
        components: config.components,
        favoritesStorageKey,
      });

      setFavorites(nextFavorites);
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
  }, [config.components, favoritesStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleFocus = () => {
      requestAnimationFrame(() => {
        const input = document.getElementById(
          PUCK_BLOCK_SEARCH_ID
        ) as HTMLInputElement | null;

        input?.focus();
        input?.select();
      });
    };

    window.addEventListener(
      PUCK_FOCUS_BLOCKS_EVENT,
      handleFocus as EventListener
    );

    return () => {
      window.removeEventListener(
        PUCK_FOCUS_BLOCKS_EVENT,
        handleFocus as EventListener
      );
    };
  }, []);

  const { resultCount, sections } = useMemo(
    () =>
      buildBlockCatalogSections({
        components: config.components,
        favorites,
        query,
        uiComponentList,
      }),
    [config.components, favorites, query, uiComponentList]
  );

  return (
    <Wrapper>
      <div className={getClassName()}>
        <label className={getClassName("search")} htmlFor="puck-block-search">
          <span className={getClassName("searchLabel")}>Search blocks</span>
          <div className={getClassName("searchIcon")}>
            <Search size={16} />
          </div>
          <input
            id={PUCK_BLOCK_SEARCH_ID}
            aria-label="Search blocks"
            autoComplete="off"
            className={getClassName("searchInput")}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setQuery(event.currentTarget.value)
            }
            placeholder="Search blocks"
            type="search"
            value={query}
          />
        </label>
        <div className={getClassName("summary")}>
          {normalizedQuery ? (
            <span>
              {resultCount} result{resultCount === 1 ? "" : "s"}
            </span>
          ) : favorites.length > 0 ? (
            <span>
              {favorites.length} favorite blocks ready to reuse. Press{" "}
              {shortcutLabel}.
            </span>
          ) : (
            <span>Drag blocks onto the canvas or press {shortcutLabel}.</span>
          )}
        </div>
        {sections.length > 0 ? (
          <div className={getClassName("lists")}>
            {sections.map((section) => (
              <ComponentList
                forceExpanded={!!normalizedQuery}
                id={section.id}
                key={section.id}
                title={section.title}
              >
                {section.items.map((item) => (
                  <ComponentList.Item
                    data={item.data}
                    key={item.key}
                    label={item.label}
                    name={item.name}
                  />
                ))}
              </ComponentList>
            ))}
          </div>
        ) : (
          <div className={getClassName("empty")}>
            <div className={getClassName("emptyIcon")}>
              <Star size={16} />
            </div>
            <div className={getClassName("emptyTitle")}>No matching blocks</div>
            <div className={getClassName("emptyText")}>
              Try a different keyword or save a favorite from the canvas for
              faster reuse.
            </div>
            <button
              className={getClassName("emptyAction")}
              onClick={() => {
                setQuery("");
                focusBlocksSearch();
              }}
              type="button"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </Wrapper>
  );
};
