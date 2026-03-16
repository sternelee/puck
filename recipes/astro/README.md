# `astro` recipe

The `astro` recipe demonstrates using Puck with Astro, enabling server-side rendering of Puck pages without shipping any React runtime to the client.

## Demonstrates

- Astro SSR implementation using `@puckeditor/core/server`
- Zero client JS for rendered pages (pure HTML from the server)
- Catch-all routes for any path in your Astro app
- Client-only Puck editor via `client:only="react"`
- JSON database with Astro API endpoints

## Vite SSR configuration

`astro.config.mjs` includes a critical Vite SSR setting:

```mjs
vite: {
  ssr: {
    noExternal: [/^@puckeditor\//, /^@tiptap\//],
  },
},
```

Without this, Vite's SSR module runner loads `@puckeditor/core` and its
`@tiptap/*` dependencies as external CJS Node modules. Vite then analyses
their named imports against CJS `module.exports` and throws:

```
Named export 'ReactNode' not found. The requested module 'react' is a
CommonJS module, which may not support all module.exports as named exports.
```

`noExternal` tells Vite to bundle these packages for SSR (ESM path), which
resolves the interop issue entirely.

## How it works

### Rendering pages (SSR, no client JS)

Puck pages are rendered entirely on the server using the `/server` export:

```tsx
import { Render } from "@puckeditor/core/server";
import "@puckeditor/core/puck.css";
```

This uses `ServerRender` under the hood — a React component that works in
Astro's SSR context without needing the React client runtime.

### Editing pages (client-only)

The Puck editor requires browser APIs and is loaded with `client:only="react"`:

```astro
<PuckEditor path={path} data={data} client:only="react" />
```

## Usage

Run the generator and enter `astro` when prompted:

```
npx create-puck-app my-app
```

Start the dev server:

```
pnpm dev
```

Navigate to the homepage at http://localhost:4321. To edit the homepage, visit http://localhost:4321/edit.

For any route (e.g. `/about`), visit `/edit/about` to create and publish that page.

## Using this recipe

To adopt this recipe you will need to:

- **IMPORTANT** Add authentication to `/edit` routes. Without authentication, Puck will be completely public.
- Integrate your database by replacing the `fs`-based implementation in `src/lib/get-page.ts`
- Implement your Puck configuration in `puck.config.tsx`
