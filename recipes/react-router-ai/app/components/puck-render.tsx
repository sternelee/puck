import type { Data } from "pika-editor-core";
import { Render } from "pika-editor-core";

import { config } from "../../puck.config";

export function PuckRender({ data }: { data: Data }) {
  return <Render config={config} data={data} />;
}
