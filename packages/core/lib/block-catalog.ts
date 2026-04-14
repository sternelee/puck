import { Config, UiState } from "../types";
import { PuckFavoriteComponent, readPuckFavorites } from "./favorites";

export type BlockCatalogItem = {
  data?: PuckFavoriteComponent["data"];
  key: string;
  label: string;
  name: string;
  searchText: string;
};

export type BlockCatalogSection = {
  id: string;
  items: BlockCatalogItem[];
  title?: string;
};

export const isComponentAllowed = (
  componentType: string,
  allow?: string[],
  disallow?: string[]
) => {
  if (disallow) {
    const defaultedAllow = allow || [];
    const filteredDisallow = disallow.filter(
      (item) => defaultedAllow.indexOf(item) === -1
    );

    if (filteredDisallow.includes(componentType)) {
      return false;
    }
  } else if (allow) {
    if (!allow.includes(componentType)) {
      return false;
    }
  }

  return true;
};

export const readFavoriteComponents = ({
  allow,
  components,
  disallow,
  favoritesStorageKey,
}: {
  allow?: string[];
  components: Config["components"];
  disallow?: string[];
  favoritesStorageKey?: string;
}) => {
  return readPuckFavorites(favoritesStorageKey).filter(
    (favorite): favorite is PuckFavoriteComponent =>
      favorite.kind === "component" &&
      !!components[favorite.componentType] &&
      isComponentAllowed(favorite.componentType, allow, disallow)
  );
};

export const buildBlockCatalogSections = ({
  allow,
  components,
  disallow,
  favorites,
  query,
  uiComponentList,
}: {
  allow?: string[];
  components: Config["components"];
  disallow?: string[];
  favorites: PuckFavoriteComponent[];
  query: string;
  uiComponentList: UiState["componentList"];
}) => {
  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (entry: BlockCatalogItem) =>
    !normalizedQuery || entry.searchText.includes(normalizedQuery);

  const matchedComponents = new Set<string>();
  const nextSections: BlockCatalogSection[] = [];

  const favoriteItems = favorites
    .map<BlockCatalogItem>((favorite) => ({
      data: favorite.data,
      key: favorite.id,
      label: favorite.name,
      name: favorite.componentType,
      searchText: `${favorite.name} ${favorite.componentType}`.toLowerCase(),
    }))
    .filter(matchesQuery);

  if (favoriteItems.length > 0) {
    nextSections.push({
      id: "favorites",
      items: favoriteItems,
      title: "Favorites",
    });
  }

  Object.entries(uiComponentList).forEach(([categoryKey, category]) => {
    if (!category.components || category.visible === false) {
      return;
    }

    category.components.forEach((componentName) => {
      matchedComponents.add(componentName as string);
    });

    const items = category.components
      .filter((componentName) =>
        isComponentAllowed(componentName as string, allow, disallow)
      )
      .map((componentName) => {
        const componentConf = components[componentName];
        const label = (componentConf?.label ?? componentName) as string;

        return {
          key: componentName as string,
          label,
          name: componentName as string,
          searchText: `${label} ${componentName}`.toLowerCase(),
        };
      })
      .filter(matchesQuery);

    if (items.length > 0) {
      nextSections.push({
        id: categoryKey,
        items,
        title: category.title || categoryKey,
      });
    }
  });

  const remainingItems = Object.keys(components)
    .filter(
      (componentName) =>
        !matchedComponents.has(componentName) &&
        isComponentAllowed(componentName, allow, disallow)
    )
    .map((componentName) => {
      const componentConf = components[componentName];
      const label = (componentConf?.label ?? componentName) as string;

      return {
        key: componentName,
        label,
        name: componentName,
        searchText: `${label} ${componentName}`.toLowerCase(),
      };
    })
    .filter(matchesQuery);

  if (
    remainingItems.length > 0 &&
    (!uiComponentList.other?.components || normalizedQuery) &&
    uiComponentList.other?.visible !== false
  ) {
    nextSections.push({
      id: "other",
      items: remainingItems,
      title: uiComponentList.other?.title || "Other",
    });
  }

  if (nextSections.length === 0 && Object.keys(uiComponentList).length === 0) {
    const allItems = Object.keys(components)
      .filter((componentName) =>
        isComponentAllowed(componentName, allow, disallow)
      )
      .map((componentName) => {
        const componentConf = components[componentName];
        const label = (componentConf?.label ?? componentName) as string;

        return {
          key: componentName,
          label,
          name: componentName,
          searchText: `${label} ${componentName}`.toLowerCase(),
        };
      })
      .filter(matchesQuery);

    if (allItems.length > 0) {
      nextSections.push({
        id: "all",
        items: allItems,
      });
    }
  }

  return {
    resultCount: nextSections.reduce((count, section) => {
      return count + section.items.length;
    }, 0),
    sections: nextSections,
  };
};
