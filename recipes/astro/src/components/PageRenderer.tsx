import { Render } from "@puckeditor/core";
import puckConfig from "../../puck.config";
import type { PageData } from "../lib/get-page";

type Props = {
  data: PageData;
  path: string;
};

export default function PageRenderer({ data }: Props) {
  return (
    <>
      <link rel="stylesheet" href="/_astro/puck.css" />
      <Render config={puckConfig} data={data} />
    </>
  );
}
