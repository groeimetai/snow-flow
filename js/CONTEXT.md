# OpenCode Context

## Build/Test Commands
- `bun install` - Install dependencies
- `bun run index.ts` - Run the application
- `bun build src/index.ts --compile --outfile ./dist/opencode` - Build executable
- `bun test` - Run all tests
- `bun test <pattern>` - Run specific test files
- `bun test --test-name-pattern <regex>` - Run tests matching pattern

## Code Style & Conventions
- TypeScript with Bun runtime
- ES modules (`"type": "module"`)
- Namespace-based organization (e.g., `Tool.define`, `App.provide`)
- Zod for schema validation and type safety
- Async/await patterns throughout
- Structured logging with service-based loggers (`Log.create({ service: "name" })`)
- Tool pattern: define tools with `Tool.define()` wrapper for metadata/timing
- Context pattern: use `Context.create()` for dependency injection
- Import style: Node.js built-ins with `node:` prefix, relative imports with explicit extensions
- Error handling: try/catch with structured logging
- File organization: group by feature in `src/` with index files for exports
- Test files: co-located in `test/` directory, use Bun's built-in test runner
- Naming: camelCase for variables/functions, PascalCase for namespaces/types