# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Puck is a modular, open-source visual editor for React.js. This is a monorepo built with Turborepo and Yarn workspaces, containing the core editor package, demo apps, documentation, framework-specific recipes, and plugins.

## Common Commands

### Development
```bash
# Install dependencies
yarn

# Run demo app (recommended for development)
cd apps/demo && yarn dev

# Run entire monorepo in development mode
yarn dev

# Build all packages
yarn build

# Lint all packages
yarn lint

# Format code
yarn format
yarn format:check  # check only
```

### Testing
```bash
# Run all tests
yarn test

# Run tests for a specific package
cd packages/core && yarn test

# Run specific test file
cd packages/core && yarn test insert-component.spec.tsx
```

### Release
```bash
# Create a release (automated via conventional commits)
yarn release

# Create canary release
yarn release:canary
```

## Monorepo Structure

- **`apps/`** - Main applications
  - `demo/` - Showcase/demo app (Next.js)
  - `docs/` - Documentation site (Next.js + Nextra)

- **`packages/`** - Core packages
  - `core/` - The main `@puckeditor/core` editor package
  - `create-puck-app/` - CLI tool for creating new Puck projects
  - `field-contentful/`, `plugin-emotion-cache/`, `plugin-heading-analyzer/` - Plugins and integrations
  - `tsconfig/`, `tsup-config/`, `eslint-config-custom/` - Shared configs

- **`recipes/`** - Framework-specific integration templates
  - `next/`, `remix/`, `react-router/` - Basic integrations
  - `next-ai/`, `remix-ai/`, `react-router-ai/` - AI-enabled variants

## Core Package Architecture

The `@puckeditor/core` package is the heart of the visual editor. Key areas:

### Type System (`packages/core/types/`)
- **`API.ts`** - Core API: Plugin, Permissions, DropZone types
- **`AppState.tsx`** - Application state combining data and UI state
- **`Config.tsx`** - Component configuration with generics for extensibility
- **`Data.tsx`** - Data structures for components, slots, root data
- **`Fields.ts`** - Field definitions for component properties

### State Management (`packages/core/store/`)
Uses **Zustand** with modular slices:
- **`store/index.ts`** - Main store factory
- **`store/slices/`** - Separate slices: history, nodes, permissions, fields

### Reducer Pattern (`packages/core/reducer/`)
Immutable reducer pattern for state transitions with actions in `reducer/actions/`.

### Core Components (`packages/core/components/`)
- **`Puck.tsx`** - Main editor orchestrator
- **`Render.tsx`** - Page renderer for preview mode
- **`DropZone.tsx`** - Drag-and-drop zones
- **`AutoField.tsx`** - Dynamic field rendering
- **`ActionBar.tsx`** - Action buttons for selected components

### Plugin System (`packages/core/plugins/`)
Extensible architecture with plugins for blocks, fields, outline, and sidebar.

## Key Architectural Patterns

### Component Configuration
Components are defined with a configuration object:
```typescript
{
  render: PuckComponent<RenderProps>;
  label?: string;
  fields?: Fields<FieldProps>;
  permissions?: Partial<Permissions>;
  resolveData?: (data, params) => Promise<Data>;
  resolveFields?: (data, params) => Promise<Fields>;
}
```

### Slots and Deep Nesting
Components can have child slots with their own component configurations, supporting deep nesting through the `WithSlotProps` pattern.

### Data Transformation Pipeline
- **resolveData** - Async data resolution for component properties
- **fieldTransforms** - Transform field values before saving
- **resolveAndCommitData** - Batch data resolution

### Drag-and-Drop
Built on `@dnd-kit` with custom abstractions for drag handles, drop zones, and nested components.

## Code Style

- **TypeScript**: Avoid `any`. Use proper types from `types/` directory.
- **CSS**: Follow [SUIT CSS](https://suitcss.github.io) naming methodology. Don't rely on global styles.
- **Commits**: Use [angular-style conventional commits](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#-git-commit-guidelines) (e.g., `feat:`, `fix:`, `docs:`).

## Build Configuration

- **Turborepo**: `turbo.json` defines build tasks with caching
- **tsup**: Fast TypeScript bundler with multiple entry points (index, rsc, internal, no-external)
- **Jest**: Tests use jest with ts-jest preset for ESM, jsdom environment

## Public API Changes

Any PR that introduces or changes public APIs will receive additional scrutiny to avoid breaking changes.
