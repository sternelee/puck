"use client";

import type { Data } from "pika-editor-core";
import { Puck } from "pika-editor-core";
import config from "../../../puck.config";

export function Client({ path, data }: { path: string; data: Partial<Data> }) {
  return (
    <Puck
      config={config}
      data={data}
      onPublish={async (data) => {
        await fetch("/puck/api", {
          method: "post",
          body: JSON.stringify({ data, path }),
        });
      }}
    />
  );
}
