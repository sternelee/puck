import { ReactNode } from "react";
import type { AppState, UiState } from "../AppState";
import type { Config } from "../Config";
import type { ComponentData, Data } from "../Data";
import type { PuckAction } from "../../reducer";
import type { PuckInsertTarget } from "./InsertionTarget";

type CommandPermissions = {
  drag: boolean;
  duplicate: boolean;
  delete: boolean;
  edit: boolean;
  insert: boolean;
} & Record<string, boolean>;

export type PuckCommandSurface = "actionBar" | "contextMenu";

export type PuckUiCommand = {
  disabled?: boolean;
  group?: string;
  hidden?: boolean;
  icon?: ReactNode;
  id: string;
  label: string;
  order?: number;
  surfaces?: PuckCommandSurface[];
  execute: () => void;
};

export type PuckComponentCommandContext<
  UserConfig extends Config = Config,
  UserData extends Data = Data
> = {
  appState: AppState<UserData>;
  componentId: string;
  componentType: string;
  config: UserConfig;
  dispatch: (action: PuckAction) => void;
  index: number;
  insertTargets: {
    after: PuckInsertTarget;
    before: PuckInsertTarget;
    into: PuckInsertTarget | null;
  };
  isSelected: boolean;
  label?: string;
  openQuickInsert: (options: {
    target: PuckInsertTarget;
    title: string;
  }) => void;
  permissions: CommandPermissions;
  selectedItem: ComponentData | null;
  setUi: (ui: Partial<UiState>) => void;
  zone: string;
};

export type PuckComponentCommandResolver<UserConfig extends Config = Config> = (
  context: PuckComponentCommandContext<UserConfig>
) => PuckUiCommand[] | null | undefined;

export type PuckCommands<UserConfig extends Config = Config> = {
  component?: PuckComponentCommandResolver<UserConfig>[];
};

export type LoadedPuckCommands<UserConfig extends Config = Config> = {
  component: PuckComponentCommandResolver<UserConfig>[];
};
