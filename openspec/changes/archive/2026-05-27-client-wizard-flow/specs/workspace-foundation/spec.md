# Delta for workspace-foundation

## MODIFIED Requirements

### Requirement: Root workspace foundation

The repository MUST provide a root pnpm workspace that includes both `apps/*` and `packages/*`. Root tracked workspace files MUST include `package.json`, `pnpm-workspace.yaml`, and `tsconfig.base.json`; a root `tsconfig.json` MAY exist only as a workspace coordination file. Root `.gitignore` MUST ignore Node/pnpm outputs introduced by this capability while continuing to track the existing `*.example` env files. Root configuration MUST remain tooling-only. The `packages/*` scope MUST be limited to shared type/schema packages (e.g., `packages/contracts`). This capability MUST NOT introduce Turborepo, Nx, Changesets, or shared runtime source code beyond type definitions.

(Previously: Workspace was limited to `apps/*` only; `packages/*` was explicitly prohibited.)

#### Scenario: Workspace root includes packages scope

- GIVEN a fresh clone of the repository
- WHEN the operator reviews `pnpm-workspace.yaml`
- THEN the workspace scope includes both `apps/*` and `packages/*`

#### Scenario: Packages scope is limited to contracts

- GIVEN the completed change
- WHEN the operator inspects `packages/`
- THEN only `packages/contracts` exists as a shared types package
- AND no runtime business logic packages are introduced

## ADDED Requirements

### Requirement: Contracts package in workspace

The workspace MUST include `packages/contracts` as a resolvable workspace package. The package MUST be importable from `apps/web` using the workspace protocol (`@template-ai/contracts` or equivalent). The package MUST NOT introduce build tooling beyond TypeScript compilation.

#### Scenario: Web app resolves contracts package

- GIVEN `packages/contracts` exists with a valid `package.json`
- WHEN `apps/web` adds it as a workspace dependency
- THEN `pnpm install` resolves the dependency correctly

## REMOVED Requirements

### Requirement: Root configuration MUST NOT introduce `packages/*`

(Reason: `packages/*` is now required to host `packages/contracts` for shared Zod schemas. The restriction was correct at bootstrap time but is no longer appropriate now that the wizard flow needs shared type definitions.)
