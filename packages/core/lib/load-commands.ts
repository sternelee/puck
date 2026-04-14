import { LoadedPuckCommands, Plugin, PuckCommands } from "../types";

export const loadCommands = <UserConfig extends object = object>({
  commands,
  plugins,
}: {
  commands?: Partial<PuckCommands<any>>;
  plugins?: Plugin<any>[];
}): LoadedPuckCommands<any> => {
  return {
    component: [
      ...(plugins?.flatMap((plugin) => plugin.commands?.component || []) || []),
      ...(commands?.component || []),
    ],
  };
};
