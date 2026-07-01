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

export const getPuckFavoritesStorageKey = (storageKey?: string) =>
  storageKey?.trim() || DEFAULT_PUCK_FAVORITES_STORAGE_KEY;

export const clonePuckFavoriteData = <T>(data: T): T =>
  JSON.parse(JSON.stringify(data)) as T;

export const createPuckFavoriteId = (prefix = "favorite") => generateId(prefix);

/** Always returns an empty list — localStorage saving has been removed. */
export const readPuckFavorites = (
  _storageKey?: string
): PuckFavoriteItem[] => [];

/**
 * No-op: dispatches the update event so UI stays consistent,
 * but does not write to localStorage.
 */
export const removePuckFavorite = (_favoriteId: string, _storageKey?: string) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PUCK_FAVORITES_UPDATED_EVENT, { detail: [] })
    );
  }
  return [];
};
