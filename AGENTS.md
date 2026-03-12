# Repository Guidelines

## Project Structure & Module Organization
This repository is a Turborepo-based monorepo.
- `packages/core`: main `@puckeditor/core` library (source, reducers, store, and most tests).
- `packages/*`: supporting packages (`create-puck-app`, plugins, shared ESLint/TS/tsup configs).
- `apps/demo`: Next.js playground for local development.
- `apps/docs`: documentation site.
- `recipes/*`: starter integrations (Next, Remix, React Router, and AI variants).
- `scripts/`: release/changelog/smoke utilities.

## Build, Test, and Development Commands
Use Node.js 20+ and the workspace package manager (`pnpm`).
- `pnpm install`: install all workspace dependencies.
- `pnpm dev`: run the demo-focused dev pipeline via Turbo.
- `pnpm build`: build all packages/apps (`turbo run build`).
- `pnpm test`: run workspace tests (`turbo run test`).
- `pnpm lint`: run ESLint across workspaces.
- `pnpm format:check` / `pnpm format`: check or apply Prettier formatting.
- `pnpm --filter @puckeditor/core test`: run core Jest tests directly.

## Coding Style & Naming Conventions
- Language stack: TypeScript + React, CSS Modules.
- Formatting: Prettier (default config in `.prettierrc.json`), 2-space indentation.
- Linting: shared `eslint-config-custom` (`.eslintrc.js`).
- Avoid `any` unless strongly justified.
- CSS class naming follows SUIT CSS conventions.
- Prefer clear naming: `PascalCase` for React components, `camelCase` for functions/variables, and `kebab-case` for package directories.

## Testing Guidelines
- Primary framework: Jest (see `packages/core/jest.config.ts`).
- Place tests alongside domain folders using `__tests__/` and `*.spec.ts(x)` naming (example: `packages/core/lib/__tests__/migrate.spec.tsx`).
- Add/update tests when modifying reducer logic, store behavior, or data transforms.
- Keep snapshot updates intentional and review `__snapshots__` diffs carefully.

## Commit & Pull Request Guidelines
- Follow Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `release:`.
- Keep each PR focused on a single issue.
- Use the PR template (`.github/pull_request_template.md`): include linked issue (`Closes #...`), concise description, change list, and explicit test steps.
- For UI/UX changes, include screenshots or short recordings from `apps/demo` when relevant.
