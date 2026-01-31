# Puck + Astro Recipe

This recipe demonstrates how to integrate [Puck](https://puckeditor.com) with [Astro](https://astro.build) using the `@astrojs/react` integration.

## Features

- **Hybrid Rendering**: Pages are pre-rendered by default, with on-demand SSR for dynamic content
- **React Integration**: Uses `@astrojs/react` to render React components in Astro
- **Puck Editor**: Full-featured visual editor for creating and editing pages
- **Node.js Deployment**: Configured for standalone Node.js deployment with `@astrojs/node`

## Getting Started

### Installation

```bash
# From the root of the puck monorepo
cd recipes/astro

# Install dependencies
yarn install

# Start development server
yarn dev
```

### Usage

1. **View the home page**: Navigate to `http://localhost:4321`

2. **Edit a page**:
   - Click "Edit This Page" or navigate to `/edit` for the home page
   - Use the Puck editor to modify the page
   - Click "Publish" to save your changes

3. **Create a new page**:
   - Navigate to `/edit/new-page`
   - Design your page with the Puck editor
   - Click "Publish" to save

### File Structure

```
recipes/astro/
├── src/
│   ├── components/      # React components
│   │   ├── PageRenderer.tsx    # Renders published pages
│   │   └── PuckEditor.tsx      # Puck editor component
│   ├── lib/             # Utilities
│   │   ├── get-page.ts         # Fetch page data
│   │   └── save-page.ts        # Save page data
│   ├── pages/           # Astro routes
│   │   ├── api/               # API endpoints
│   │   │   └── puck/
│   │   │       └── save.ts    # Save page API
│   │   ├── edit/              # Editor routes
│   │   │   └── [...path].astro
│   │   ├── [...path].astro    # Dynamic page routes
│   │   └── index.astro        # Home page
│   └── layouts/
│       └── Layout.astro       # Base layout
├── database.json      # Page data storage (JSON file)
├── puck.config.tsx    # Puck component configuration
├── astro.config.mjs   # Astro configuration
└── package.json
```

## Configuration

### Puck Components

Edit `puck.config.tsx` to customize available components:

```typescript
export const config: Config<Props> = {
  components: {
    MyComponent: {
      fields: { /* ... */ },
      render: ({ props }) => <div>{props.title}</div>
    }
  }
};
```

### Storage

By default, pages are stored in `database.json`. For production, replace the `save-page.ts` and `get-page.ts` functions with your preferred database or CMS.

### Deployment

Build for production:

```bash
yarn build
```

Start the production server:

```bash
yarn preview
```

The app runs as a standalone Node.js server.

## Rendering Modes

- **Static Pages**: Add `export const prerender = true` to any page for static generation
- **Server-Side**: Default behavior in `output: 'hybrid'` mode - pages render on demand
- **Editor**: Always renders client-side for interactivity

## Customization

### Add a New Component

1. Define your React component
2. Add it to `puck.config.tsx`
3. The component will appear in the Puck editor

### Change Data Source

1. Modify `src/lib/get-page.ts` to fetch from your API/database
2. Modify `src/lib/save-page.ts` to save to your API/database
3. Update the API endpoint at `src/pages/api/puck/save.ts`

## License

MIT
