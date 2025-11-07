# Contributing

Thank you for your interest in contributing to this project! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js >= 22.14.0
- npm (comes with Node.js)
- Git

### Getting Started

1. Fork the repository and clone your fork:
```bash
git clone https://github.com/your-username/gs-mcp-proxy-pii-redactor.git
cd gs-mcp-pii-redactor
```

2. Install dependencies:
```bash
npm install
```

3. Set up the development environment:
```bash
# Set up Git hooks (Husky)
npm run prepare
```

## Development Workflow

### Running the Application

```bash
# Development mode with watch
npm run start:dev

# Production build
npm run build
npm run start:prod

# With custom config file
npm run start:prod -- --config /path/to/config.json

# With remote config URL
npm run start:prod -- --config https://example.com/config.json
```

### Building

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:cov

# E2E tests
npm run test:e2e

# E2E tests with coverage
npm run test:e2e:cov
```

### E2E Test Prerequisites

**All E2E tests require a `GITHUB_TOKEN` environment variable** for GitHub MCP server integration. The tests will fail if this token is not present:

```bash
export GITHUB_TOKEN=your_token_here
npm run test:e2e
```

#### Transport Options Testing

The E2E test suite includes comprehensive tests for **both MCP transport options**:

- **SSE (Server-Sent Events)** - Tests in `e2e/mcp.sse.e2e-spec.ts` and `e2e/mcp.search-repositories.sse.e2e-spec.ts`
- **Streamable HTTP** - Tests in `e2e/mcp.e2e-spec.ts` and `e2e/mcp.search-repositories.e2e-spec.ts`

Both transport types are tested with:
- Connection and tool listing
- Authentication handling
- Tool execution (e.g., `search_repositories`)
- Multiple sequential operations
- Connection state management

This ensures that the proxy works correctly regardless of which transport option clients choose to use.

### Test Coverage

Coverage reports are generated in `test-results/` after running tests. Combined coverage reports are built using:

```bash
npm run coverage:merge
```

## Code Style

### Linting & Formatting

We use ESLint for linting and code formatting.

Fix and format your changes:

```bash
npm run lint:fix
```

Check without fixing:

```bash
npm run lint
```

Note: A pre-commit hook runs lint-staged to automatically lint and fix staged files.

## Commit Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for commit messages. We use Commitizen to help with this:

```bash
npm run commit
```

This will guide you through creating a properly formatted commit message.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(redaction): add support for custom redaction keys
fix(mcp): handle SSE transport errors gracefully
docs: update README with new configuration options
```

## Pull Request Process

1. **Create a branch** from the latest `main` or `beta` branch:
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes** following the code style and testing guidelines above.

3. **Ensure tests pass**:
```bash
npm test
npm run test:e2e  # if applicable
```

4. **Ensure linting passes**:
```bash
npm run lint
```

5. **Commit your changes** using Conventional Commits:
```bash
npm run commit
```

6. **Push your branch**:
```bash
git push origin feature/your-feature-name
```

7. **Create a Pull Request** on GitHub with:
   - A clear title following Conventional Commits format
   - A description of what changes were made and why
   - Reference any related issues

### PR Requirements

- All tests must pass
- Code must be formatted and linted
- New features should include tests
- Documentation should be updated if needed
- Commit messages follow Conventional Commits format

## Release Process

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning and releases. Releases are automatically created based on commit messages:

- `feat:` commits trigger a minor version bump
- `fix:` commits trigger a patch version bump
- `BREAKING CHANGE:` in commit body triggers a major version bump

Releases are created automatically when changes are merged to the main branch.

## Docker Development

### Building Docker Image

```bash
npm run docker:build
```

This builds the Docker image with tags for both `latest` and the current version.

### Running Docker Container

```bash
npm run docker:run
```

This runs the container with environment variables and mounts `config.json`. For minimal testing:

```bash
npm run docker:run:min
```

### Custom Docker Usage

```bash
# Build
docker build -t gs-mcp-pii-redactor:latest .

# Run with custom config
docker run --rm -p 8083:8083 \
  -e MCP_PROXY_GCS_BUCKET=your-bucket \
  -e MCP_PROXY_GCS_FILES=names.txt,emails.txt \
  -e MCP_PROXY_SERVICE_ACCOUNT_B64=base64encoded \
  -v $(pwd)/config.json:/app/config.json \
  gs-mcp-pii-redactor:latest
```

## Project Structure

```
src/
  config/          # Configuration module and types
  mcp/            # MCP client wrapper and server service
  redaction/      # PII redaction service and utilities
  app.controller.ts
  app.module.ts
  main.ts

e2e/             # E2E tests
```

## Getting Help

- Check existing [Issues](https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor/issues)
- Review the [README.md](README.md) for usage examples
- Create a new issue with a clear description

## Code of Conduct

This project adheres to a Code of Conduct. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Adding Contributors

Contributors are automatically added via GitHub Actions when PRs are merged. You can also manually add contributors:

```bash
npm run contributors:add -- <username> <contribution-type>
```

Contribution types: `code`, `doc`, `test`, `bug`, `ideas`, `review`, `infra`, `tool`, `maintenance`, `projectManagement`, etc. See [all-contributors emoji key](https://allcontributors.org/docs/en/emoji-key) for full list.
