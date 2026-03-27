"use client";

import type { Data } from "pika-editor-core";
import { Render } from "pika-editor-core";
import config from "../../puck.config";

export function Client({ data }: { data: Data }) {
  return <Render config={config} data={data} />;
}
