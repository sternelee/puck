# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Puck is a modular, open-source visual editor for React.js. It's a monorepo using Turborepo with pnpm workspaces containing:

- **@puckeditor/core** - The main editor package (React component-based)
- **apps/demo** - Next.js demo application
- **apps/docs** - Documentation site (Nextra/Next.js)
- **packages/** - Additional packages (create-puck-app, plugins, fields)
- **recipes/** - Pre-configured templates (Next.js, Remix, React Router)

## Common Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run demo for development (clears core/dist first, runs Next.js dev)
pnpm dev

# Run tests
pnpm test

# Run tests for a specific package
cd packages/core && pnpm test

# Run a specific test file
cd packages/core && pnpm test path/to/test.spec.ts

# Lint all packages
pnpm lint

# Format code
pnpm format

# Check formatting
pnpm format:check

# Run smoke tests (e2e)
pnpm smoke
```

## Architecture

### Core Package Structure (`packages/core/`)

The editor is built with a **unidirectional data flow** pattern using Zustand for state management:

- **components/** - React UI components (Puck, Render, Sidebar, DropZone, etc.)
- **lib/** - Utilities and helpers (dnd, field-transforms, data processing)
- **reducer/** - State reducer and action handlers
- **store/** - Zustand store configuration with slices (history, nodes, permissions, fields)
- **types/** - TypeScript type definitions (Config, Data, Fields, etc.)

### State Management

The editor uses a reducer pattern with Zustand:

1. **Store** (`store/index.ts`) - Created via `createAppStore()`, holds all app state
2. **Reducer** (`reducer/index.ts`) - `createReducer()` handles all state mutations via action types
3. **Actions** (`reducer/actions/`) - Individual action handlers (insert, remove, reorder, replace, etc.)
4. **Slices** (`store/slices/`) - Modular state logic (history for undo/redo, nodes for component tree, permissions)

All state changes flow through `dispatch(action)`. The reducer pattern ensures predictable state transitions and enables history tracking.

### Key Types (`packages/core/types/`)

- **Config.tsx** - Component configuration (fields, render, resolveData, resolveFields)
- **Data.tsx** - Editor data structure (root, content, zones)
- **Fields.ts** - Field types (text, richText, custom, etc.)
- **AppState.tsx** - Full application state shape

### Component Configuration

Users configure Puck by passing a `config` object:

```tsx
const config = {
  components: {
    HeadingBlock: {
      fields: { text: { type: "text" } },
      render: ({ text }) => <h1>{text}</h1>,
    },
  },
};
```

### Rendering

- **Puck** - The main editor component
- **Render** - Standalone component for rendering saved content
- Both accept `config` and `data` props

## Development Notes

- **Package manager**: pnpm (workspace protocol: `workspace:*`)
- **CSS**: SUIT CSS methodology (e.g., `ComponentName-elementName--modifierName`). Avoid global styles - Puck runs in hostile third-party environments.
- **Tests**: Jest with testing-library, co-located with source in `__tests__` directories
- **Build**: tsup for bundling the core package
- **TypeScript**: Strict mode; avoid `any`
- **Commits**: Angular-style conventional commits (squashed on merge)

## Release Process

- **Canary**: Automatically deployed after each merge to `main` (e.g., `0.10.0-canary.42c24f1`)
- **Latest**: Triggered manually when the team feels `main` is sufficiently stable
