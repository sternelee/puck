import { ZoneType } from "../Internal";

export type PuckInsertTargetKind = "root" | "slot" | "dropzone";

export type PuckInsertTarget = {
  allow?: string[];
  destinationIndex: number;
  destinationZone: string;
  disallow?: string[];
  kind: PuckInsertTargetKind;
  parentId: string;
  slotFieldName?: string;
  zoneName: string;
  zoneType: ZoneType;
};
