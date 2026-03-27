import { ComponentData, Data } from "../types";
import { generateId } from "./generate-id";

export const DEFAULT_PUCK_FAVORITES_STORAGE_KEY = "puck-favorites";
export const PUCK_FAVORITES_UPDATED_EVENT = "puck:favorites-updated";

export type PuckFavoritePage = {
  id: string;
  kind: "page";
  name: string;
  createdAt: string;
  sourcePath?: string;
  data: Data;
};

export type PuckFavoriteComponent = {
  id: string;
  kind: "component";
  name: string;
  createdAt: string;
  sourcePath?: string;
  componentType: string;
  data: ComponentData;
};

export type PuckFavoriteItem = PuckFavoritePage | PuckFavoriteComponent;

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const getPuckFavoritesStorageKey = (storageKey?: string) =>
  storageKey?.trim() || DEFAULT_PUCK_FAVORITES_STORAGE_KEY;

export const clonePuckFavoriteData = <T>(data: T): T =>
  JSON.parse(JSON.stringify(data)) as T;

export const createPuckFavoriteId = (prefix = "favorite") => generateId(prefix);

export const readPuckFavorites = (
  storageKey?: string
): PuckFavoriteItem[] => {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(
      getPuckFavoritesStorageKey(storageKey)
    );

    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;

    return Array.isArray(parsed) ? (parsed as PuckFavoriteItem[]) : [];
  } catch {
    return [];
  }
};

export const writePuckFavorites = (
  favorites: PuckFavoriteItem[],
  storageKey?: string
) => {
  if (!canUseStorage()) return favorites;

  const nextFavorites = favorites.map((favorite) => ({
    ...favorite,
    data: clonePuckFavoriteData(favorite.data),
  }));

  window.localStorage.setItem(
    getPuckFavoritesStorageKey(storageKey),
    JSON.stringify(nextFavorites)
  );

  window.dispatchEvent(
    new CustomEvent(PUCK_FAVORITES_UPDATED_EVENT, {
      detail: nextFavorites,
    })
  );

  return nextFavorites;
};

export const savePuckFavorite = (
  favorite: PuckFavoriteItem,
  storageKey?: string
) => {
  const favorites = readPuckFavorites(storageKey);
  const deduped = favorites.filter((item) => item.id !== favorite.id);

  return writePuckFavorites([favorite, ...deduped], storageKey);
};

export const removePuckFavorite = (favoriteId: string, storageKey?: string) => {
  const favorites = readPuckFavorites(storageKey);

  return writePuckFavorites(
    favorites.filter((favorite) => favorite.id !== favoriteId),
    storageKey
  );
};
