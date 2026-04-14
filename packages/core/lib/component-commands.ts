import {
  LoadedPuckCommands,
  PuckCommandSurface,
  PuckComponentCommandContext,
  PuckUiCommand,
} from "../types";

const defaultSurfaces: PuckCommandSurface[] = ["actionBar", "contextMenu"];

export const resolveComponentCommands = ({
  commandResolvers,
  context,
  defaults = [],
}: {
  commandResolvers: LoadedPuckCommands["component"];
  context: PuckComponentCommandContext;
  defaults?: PuckUiCommand[];
}) => {
  const merged = new Map<string, PuckUiCommand>();

  [
    ...defaults,
    ...commandResolvers.flatMap((resolver) => resolver(context) || []),
  ]
    .filter((command) => !command.hidden)
    .forEach((command) => {
      merged.set(command.id, {
        ...command,
        surfaces: command.surfaces?.length ? command.surfaces : defaultSurfaces,
      });
    });

  return Array.from(merged.values()).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
};

export const filterCommandsBySurface = (
  commands: PuckUiCommand[],
  surface: PuckCommandSurface
) => {
  return commands.filter((command) => command.surfaces?.includes(surface));
};

export const groupCommands = (commands: PuckUiCommand[]) => {
  const groups: Array<{ id: string; commands: PuckUiCommand[] }> = [];

  commands.forEach((command) => {
    const groupId = command.group || "default";
    const existingGroup = groups.find((group) => group.id === groupId);

    if (existingGroup) {
      existingGroup.commands.push(command);
      return;
    }

    groups.push({
      id: groupId,
      commands: [command],
    });
  });

  return groups;
};
