/**
 * Client-only Puck editor component.
 * Must be used with client:only="react" in Astro pages.
 */
import type { Data } from "@puckeditor/core";
import { Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import config from "../../puck.config";

interface Props {
  path: string;
  data: Partial<Data>;
}

export function PuckEditor({ path, data }: Props) {
  return (
    <Puck
      config={config}
      data={data}
      onPublish={async (data) => {
        await fetch("/api/puck", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, path }),
        });
      }}
    />
  );
}
