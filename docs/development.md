# Development

## Requirements

- Node.js 24+ (`ctxd doctor` enforces this)
- pnpm (`corepack enable pnpm` is enough)

## Commands

```bash
pnpm install     # install and link the workspace
pnpm build       # tsc -b across all packages
pnpm typecheck   # the same project build; there is no second config to drift
pnpm test        # build, then unit + integration + e2e
pnpm clean       # tsc -b --clean
```

Run the CLI from the build output:

```bash
node packages/cli/dist/index.js doctor
node packages/cli/dist/index.js status
```

## Working on the code

Each phase follows the same loop:

1. inspect the repository
2. make a concise plan
3. implement the smallest correct change
4. run the tests
5. run the typecheck
6. verify actual behaviour by running it
7. update the documentation
8. only then start the next phase

Two rules matter more than the rest:

- **Never claim something works without running it.** `ctxd doctor` embodies
  this — every check does real work.
- **Never document a feature that does not exist.** README, this file and
  `architecture.md` describe only what is implemented.

## Conventions

- Strict TypeScript, ESM, `NodeNext` resolution — relative imports carry a
  `.js` extension because that is what the compiled output uses
- `verbatimModuleSyntax` is on, so type-only imports need `import type`
- Prepared statements for all SQL
- Small modules, explicit interfaces, no circular dependencies
- No dependency is added unless it clearly reduces complexity

## Tests

Tests are TypeScript, executed by the Node test runner with type stripping.
Layout:

```
tests/
├── unit/          pure logic
├── integration/   SQLite and other real subsystems
├── e2e/           the CLI as a subprocess
├── fixtures/      benchmark repositories (Phase 1.5)
└── helpers/       shared test utilities
```

Anything touching storage must use `createTempHome()` from
`tests/helpers/temp-home.ts`, which sets `CTXD_HOME` to a fresh temporary
directory and removes it afterwards. **No test may touch the real `~/.ctxd`**
or depend on the developer's machine.

## Adding a migration

Append to `MIGRATIONS` in `packages/db/src/schema.ts` with the next version
number. Never edit a released migration — `migrate()` applies each pending
migration in a transaction and records the version in the same transaction, and
refuses to touch a database written by a newer build.
