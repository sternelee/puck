import { Config, PuckInsertTarget } from "../types";
import { SlotField } from "../types/Fields";
import { PrivateAppState } from "../types/Internal";
import { rootDroppableId, rootAreaId, rootZone } from "./root-droppable-id";

const preferredSlotNames = ["children", "content", "items"];

const isSlotField = (field: unknown): field is SlotField =>
  !!field && typeof field === "object" && (field as SlotField).type === "slot";

const getSlotFieldForZone = (
  config: Config,
  state: PrivateAppState,
  zoneCompound: string
) => {
  if (zoneCompound === rootDroppableId) {
    return null;
  }

  const [parentId, zoneName] = zoneCompound.split(":");
  const parentNode = state.indexes.nodes[parentId];

  if (!parentNode) {
    return null;
  }

  if (parentNode.data.type === "root") {
    const field = config.root?.fields?.[zoneName];
    return isSlotField(field) ? field : null;
  }

  const field = config.components[parentNode.data.type]?.fields?.[zoneName];
  return isSlotField(field) ? field : null;
};

export const resolveInsertionTargetForZone = ({
  config,
  destinationIndex,
  state,
  zoneCompound,
}: {
  config: Config;
  destinationIndex: number;
  state: PrivateAppState;
  zoneCompound: string;
}): PuckInsertTarget => {
  const slotField = getSlotFieldForZone(config, state, zoneCompound);

  if (zoneCompound === rootDroppableId) {
    return {
      destinationIndex,
      destinationZone: zoneCompound,
      kind: "root",
      parentId: rootAreaId,
      zoneName: rootZone,
      zoneType: "root",
    };
  }

  const [parentId, zoneName] = zoneCompound.split(":");

  return {
    allow: slotField?.allow,
    destinationIndex,
    destinationZone: zoneCompound,
    disallow: slotField?.disallow,
    kind: slotField ? "slot" : "dropzone",
    parentId,
    slotFieldName: slotField ? zoneName : undefined,
    zoneName,
    zoneType: state.indexes.zones[zoneCompound]?.type ?? "dropzone",
  };
};

export const resolveInsertionTargetForComponentSlot = ({
  componentId,
  componentType,
  config,
  state,
}: {
  componentId: string;
  componentType: string;
  config: Config;
  state: PrivateAppState;
}): PuckInsertTarget | null => {
  const fields = config.components[componentType]?.fields;

  if (!fields) {
    return null;
  }

  const slotEntries = Object.entries(fields).filter(([, field]) =>
    isSlotField(field)
  ) as [string, SlotField][];

  if (slotEntries.length === 0) {
    return null;
  }

  const preferredSlot =
    slotEntries.find(([fieldName]) => preferredSlotNames.includes(fieldName)) ??
    (slotEntries.length === 1 ? slotEntries[0] : null);

  if (!preferredSlot) {
    return null;
  }

  const [slotFieldName, slotField] = preferredSlot;
  const destinationZone = `${componentId}:${slotFieldName}`;
  const destinationIndex =
    state.indexes.zones[destinationZone]?.contentIds.length ?? 0;

  return {
    allow: slotField.allow,
    destinationIndex,
    destinationZone,
    disallow: slotField.disallow,
    kind: "slot",
    parentId: componentId,
    slotFieldName,
    zoneName: slotFieldName,
    zoneType: state.indexes.zones[destinationZone]?.type ?? "slot",
  };
};
