// One-click stack presets for the AGENTS.md / CLAUDE.md generator.
// JS stacks use {pm} placeholders, filled by the chosen package manager (npm, pnpm, yarn, bun).

export const PM = {
  npm: { install: 'npm install', run: (s) => (s === 'test' ? 'npm test' : `npm run ${s}`), exec: 'npx' },
  pnpm: { install: 'pnpm install', run: (s) => `pnpm ${s}`, exec: 'pnpm exec' },
  yarn: { install: 'yarn install', run: (s) => `yarn ${s}`, exec: 'yarn' },
  // `bun test` runs Bun's own test runner, so scripts always go through `bun run`
  bun: { install: 'bun install', run: (s) => `bun run ${s}`, exec: 'bunx' },
};

// cmd values: a string, or for JS stacks a function of the package manager
const js = (script) => (pm) => PM[pm].run(script);
const one = (pm) => (pm === 'npm' ? 'npm test -- path/to/file.test.ts' : `${PM[pm].run('test')} path/to/file.test.ts`);
const tsc = (pm) => `${PM[pm].exec} tsc --noEmit`;

export const STACKS = [
  {
    id: 'nextjs', icon: '▲', title: 'Next.js', sub: 'App Router · TypeScript', js: true,
    about: 'A Next.js web app (App Router, TypeScript)',
    cmds: { install: (pm) => PM[pm].install, dev: js('dev'), build: js('build'), test: js('test'), lint: js('lint'), typecheck: tsc, testOne: one },
    structure: ['app/ — routes, layouts and pages (App Router)', 'components/ — shared React components', 'lib/ — helpers, data access and API clients', 'public/ — static files served as-is'],
    style: [
      'TypeScript strict mode. No `any`; use `unknown` and narrow it',
      'Components are Server Components by default. Add "use client" only when a component needs state, effects or browser APIs',
      'Use `next/image` for images and `next/link` for internal links',
      'Fetch data on the server; never expose secrets to client components (only `NEXT_PUBLIC_` variables reach the browser)',
    ],
  },
  {
    id: 'react-vite', icon: '⚛️', title: 'React + Vite', sub: 'TypeScript · Vitest', js: true,
    about: 'A React single-page app built with Vite and TypeScript',
    cmds: { install: (pm) => PM[pm].install, dev: js('dev'), build: js('build'), test: js('test'), lint: js('lint'), typecheck: tsc, testOne: one },
    structure: ['src/components/ — UI components', 'src/hooks/ — custom hooks', 'src/lib/ — helpers and API clients', 'public/ — static files'],
    style: [
      'Function components and hooks only, no class components',
      'TypeScript strict mode. Type props explicitly',
      'Keep tests next to the file they test: `Button.tsx` → `Button.test.tsx`',
      'Only `VITE_` environment variables reach the browser; never put secrets in them',
    ],
  },
  {
    id: 'node-api', icon: '🟢', title: 'Node.js API', sub: 'Express / Fastify · TS', js: true,
    about: 'A Node.js REST API written in TypeScript',
    cmds: { install: (pm) => PM[pm].install, dev: js('dev'), build: js('build'), test: js('test'), lint: js('lint'), typecheck: tsc, testOne: one },
    structure: ['src/routes/ — HTTP route handlers', 'src/services/ — business logic', 'src/db/ — database access and migrations', 'test/ — tests'],
    style: [
      'async/await everywhere; no callbacks or unhandled promises',
      'Validate every request body and query string at the route (for example with zod)',
      'Route handlers stay thin: business logic lives in services',
      'Read config and secrets from environment variables, never from code',
    ],
  },
  {
    id: 'fastapi', icon: '⚡', title: 'Python · FastAPI', sub: 'uv · pytest · ruff',
    about: 'A Python API built with FastAPI',
    cmds: { install: 'uv sync', dev: 'uv run uvicorn app.main:app --reload', test: 'uv run pytest', lint: 'uv run ruff check .', format: 'uv run ruff format .', typecheck: 'uv run mypy .', testOne: 'uv run pytest tests/test_items.py -k test_name' },
    structure: ['app/main.py — FastAPI app and router setup', 'app/routers/ — endpoints', 'app/models/ — Pydantic schemas', 'tests/ — pytest tests'],
    style: [
      'Type hints on every function',
      'Pydantic models for request and response bodies',
      'Use `async def` for endpoints that do I/O',
      'Format and lint with ruff; fix lint errors instead of disabling rules',
    ],
  },
  {
    id: 'django', icon: '🐍', title: 'Python · Django', sub: 'uv · manage.py',
    about: 'A Django web app',
    cmds: { install: 'uv sync', dev: 'uv run python manage.py runserver', test: 'uv run python manage.py test', lint: 'uv run ruff check .', migrate: 'uv run python manage.py makemigrations && uv run python manage.py migrate', testOne: 'uv run python manage.py test myapp.tests.MyTestCase' },
    structure: ['<project>/settings.py — settings', '<app>/models.py, views.py, urls.py — one folder per Django app', 'templates/ — HTML templates'],
    style: [
      'Never edit a migration that has already been applied; create a new one',
      'Keep views thin; put logic in models or a services module',
      'Use the ORM; raw SQL only with parameters, never string formatting',
    ],
  },
  {
    id: 'go', icon: '🐹', title: 'Go', sub: 'modules · go test',
    about: 'A Go service',
    cmds: { install: 'go mod download', dev: 'go run .', build: 'go build ./...', test: 'go test ./...', lint: 'go vet ./...', format: 'gofmt -w .', testOne: 'go test ./internal/foo -run TestName' },
    structure: ['cmd/ — entry points (one folder per binary)', 'internal/ — private packages', 'pkg/ — packages safe to import from other modules'],
    style: [
      'Handle every error. Wrap with context: `fmt.Errorf("load config: %w", err)`',
      'Accept interfaces, return structs',
      'No `panic` outside `main` and tests',
      'Run `gofmt` on every file you change',
    ],
  },
  {
    id: 'rust', icon: '🦀', title: 'Rust', sub: 'cargo · clippy',
    about: 'A Rust project',
    cmds: { build: 'cargo build', dev: 'cargo run', test: 'cargo test', lint: 'cargo clippy --all-targets -- -D warnings', format: 'cargo fmt', testOne: 'cargo test test_name' },
    structure: ['src/main.rs or src/lib.rs — crate root', 'src/ — modules', 'tests/ — integration tests'],
    style: [
      'Return `Result` and use `?`; no `unwrap()` or `expect()` outside tests',
      'Clippy warnings are errors: fix them, don\'t `#[allow]` them without a comment saying why',
      'Run `cargo fmt` before finishing',
    ],
  },
  {
    id: 'flutter', icon: '💙', title: 'Flutter', sub: 'Dart · mobile',
    about: 'A Flutter app',
    cmds: { install: 'flutter pub get', dev: 'flutter run', test: 'flutter test', lint: 'flutter analyze', format: 'dart format .', testOne: 'flutter test test/widget_test.dart' },
    structure: ['lib/ — app code (lib/main.dart is the entry point)', 'test/ — widget and unit tests', 'assets/ — images and fonts (listed in pubspec.yaml)'],
    style: [
      'Use `const` constructors wherever possible',
      'Keep `build()` methods free of side effects and heavy work',
      'Split big widgets into small ones instead of deep nesting',
    ],
  },
  {
    id: 'laravel', icon: '🔺', title: 'Laravel', sub: 'PHP · Pint · Pest/PHPUnit',
    about: 'A Laravel web app',
    cmds: { install: 'composer install && npm install', dev: 'composer run dev', test: 'php artisan test', format: './vendor/bin/pint', migrate: 'php artisan migrate', testOne: 'php artisan test --filter=TestName' },
    structure: ['app/ — models, controllers, jobs', 'routes/ — web.php and api.php', 'resources/views/ — Blade templates', 'database/migrations/ — schema changes'],
    style: [
      'Validate input with Form Request classes',
      'No database queries inside Blade views',
      'Never edit a migration that has already run; add a new migration',
      'Format PHP with Pint',
    ],
  },
  {
    id: 'spring', icon: '🍃', title: 'Spring Boot', sub: 'Java · Maven',
    about: 'A Spring Boot service (Java, Maven)',
    cmds: { dev: './mvnw spring-boot:run', build: './mvnw package', test: './mvnw test', testOne: './mvnw test -Dtest=ClassNameTest' },
    structure: ['src/main/java/ — application code', 'src/main/resources/ — application.yml and static files', 'src/test/java/ — tests'],
    style: [
      'Constructor injection only; no `@Autowired` on fields',
      'Use DTOs at the API boundary; never return JPA entities directly',
      'Keep controllers thin; business logic lives in services',
    ],
  },
  {
    id: 'dotnet', icon: '🟣', title: '.NET', sub: 'C# · dotnet CLI',
    about: 'A .NET application (C#)',
    cmds: { install: 'dotnet restore', dev: 'dotnet run', build: 'dotnet build', test: 'dotnet test', format: 'dotnet format', testOne: 'dotnet test --filter "FullyQualifiedName~TestName"' },
    structure: ['src/ — projects', 'tests/ — test projects'],
    style: [
      'Nullable reference types are on; don\'t silence warnings with `!`',
      'async all the way down; never block with `.Result` or `.Wait()`',
      'Use dependency injection; no static service locators',
    ],
  },
  {
    id: 'monorepo', icon: '🧱', title: 'Monorepo', sub: 'pnpm workspaces · Turborepo', js: true, pm: 'pnpm',
    about: 'A TypeScript monorepo (pnpm workspaces + Turborepo)',
    cmds: { install: (pm) => PM[pm].install, dev: js('dev'), build: () => 'pnpm turbo run build', test: () => 'pnpm turbo run test --filter <package>', lint: () => 'pnpm turbo run lint', testOne: () => 'pnpm turbo run test --filter <package> -- <file>' },
    structure: ['apps/ — deployable apps', 'packages/ — shared libraries used by the apps', 'Each package can have its own AGENTS.md with package-specific rules'],
    style: [
      'Shared code goes in `packages/`; apps never import from other apps',
      'Run commands for one package with `--filter <package>` instead of the whole repo',
      'Add dependencies to the package that uses them, not the root',
    ],
  },
];

export const BLANK = { id: 'blank', icon: '✨', title: 'Other', sub: 'Start from scratch', about: '', cmds: {}, structure: [], style: [] };

// Rules most teams want. `on` = ticked by default.
export const RULES = [
  { id: 'verify', on: true, text: 'Run the tests and the linter before saying a task is done. Fix failures; don\'t skip or delete tests to make them pass.' },
  { id: 'small', on: true, text: 'Keep changes small and focused. Don\'t refactor or reformat code that isn\'t part of the task.' },
  { id: 'secrets', on: true, text: 'Never commit secrets, API keys or `.env` files. Read them from environment variables.' },
  { id: 'deps', on: true, text: 'Ask before adding a new dependency.' },
  { id: 'tests', on: false, text: 'Add or update tests for every behaviour you change.' },
  { id: 'match', on: false, text: 'Match the style of the surrounding code, even where you would do it differently.' },
  { id: 'generated', on: false, text: 'Don\'t edit generated files (lockfiles, build output, generated clients) by hand.' },
  { id: 'plan', on: false, text: 'For changes touching more than a few files, explain the plan first and wait for a go-ahead.' },
  { id: 'commits', on: false, text: 'Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.' },
  { id: 'destructive', on: false, text: 'Never run destructive commands (dropping databases, `git push --force`, deleting branches) without asking.' },
];

export const CMD_LABELS = { install: 'Install', dev: 'Run locally', build: 'Build', test: 'Test', testOne: 'Run one test', lint: 'Lint', format: 'Format', typecheck: 'Type-check', migrate: 'Migrate' };
