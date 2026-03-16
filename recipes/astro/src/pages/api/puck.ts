import type { APIRoute } from "astro";
import type { Data } from "@puckeditor/core";
import { savePage } from "../../lib/get-page";

export const POST: APIRoute = async ({ request }) => {
  const { data, path } = (await request.json()) as {
    data: Data;
    path: string;
  };

  if (!path || !data) {
    return new Response(JSON.stringify({ error: "Missing path or data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  savePage(path, data);

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
