import type { APIRoute } from 'astro';
import { savePage } from '../../../lib/save-page';
import type { PageData } from '../../../lib/get-page';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { path, data } = body as { path: string; data: PageData };

    if (!path || !data) {
      return new Response(
        JSON.stringify({ error: 'Missing path or data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = savePage(path, data);

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
