import { useMemo } from "react";
import {
  BaseField,
  Fields,
  RichtextField,
  WithPuckProps,
} from "../../../types";
import { RichTextRender } from "../components/Render";
import { mapDeep } from "./mapDeep";

type RichtextPath = {
  path: string[];
  field: RichtextField;
};

export function useRichtextProps(
  fields:
    | Fields<any, {}>
    | Fields<any, { type: string } & BaseField>
    | undefined,
  props: WithPuckProps<{
    [x: string]: any;
  }>
) {
  const findAllRichtextKeys = (
    fields:
      | Fields<any, {}>
      | Fields<any, { type: string } & BaseField>
      | undefined,
    path: string[] = []
  ): RichtextPath[] => {
    if (!fields) return [];

    const result: RichtextPath[] = [];

    for (const [key, field] of Object.entries(fields)) {
      const currentPath = [...path, key];

      if (field.type === "richtext") {
        result.push({
          path: currentPath,
          field: field as RichtextField,
        });
      }

      if (field.type === "array" && "arrayFields" in field) {
        result.push(...findAllRichtextKeys(field.arrayFields, currentPath));
      }

      if (field.type === "object" && "objectFields" in field) {
        result.push(...findAllRichtextKeys(field.objectFields, currentPath));
      }
    }

    return result;
  };

  const richtextKeys = useMemo(() => findAllRichtextKeys(fields), [fields]);

  const richtextProps = useMemo(() => {
    if (!richtextKeys?.length) return {};

    let result = { ...props };

    for (const { path, field } of richtextKeys) {
      result = mapDeep(result, path, (content) => (
        <RichTextRender key={String(content)} content={content} field={field} />
      ));
    }

    return result;
  }, [richtextKeys, props, fields]);

  return richtextProps;
}
