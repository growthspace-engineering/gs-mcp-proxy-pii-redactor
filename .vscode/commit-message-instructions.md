# Commit Message Instructions

Generate commit messages following Angular's semantic commit conventions.

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Commit Types

Use one of the following types:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)
- **ci**: Changes to CI configuration files and scripts (example scopes: Travis, Circle, GitHub Actions)
- **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation
- **revert**: Reverts a previous commit

## Scope (REQUIRED)

**⚠️ IMPORTANT: Scope is REQUIRED for all commits. Never generate a commit message without a scope.**

The scope identifies the area of the codebase affected by the change. Common scopes for this project:

- `proxy`: MCP proxy functionality
- `redaction`: PII redaction features
- `config`: Configuration management
- `auth`: Authentication/OAuth
- `transport`: Transport layer (stdio, SSE, HTTP)
- `client`: Client-side code
- `server`: Server-side code
- `docs`: Documentation
- `deps`: Dependencies
- `build`: Build system changes
- `ci`: CI/CD configuration
- `test`: Test-related changes
- `audit`: Audit logging functionality

If the change affects multiple areas, choose the primary scope or use a more general scope that encompasses the change. Always include a scope - never omit it.

## Subject

The subject contains a succinct description of the change:

- Use the imperative, present tense: "change" not "changed" nor "changes"
- Don't capitalize the first letter
- No dot (.) at the end
- Maximum 72 characters

## Body

The body is optional and should include:

- The motivation for the change
- Contrast this implementation with the previous behavior
- Use the imperative, present tense
- Wrap at 72 characters

## Footer

The footer is optional and should contain:

- Any breaking changes (should start with `BREAKING CHANGE:`)
- References to issues that this commit closes (e.g., `Closes #123`)

## Examples

```
feat(proxy): add support for GitHub MCP server

Add routing and configuration for GitHub MCP server integration.
Enables users to connect to GitHub repositories through the proxy.

Closes #42
```

```
fix(redaction): correct regex pattern for email detection

The previous pattern was missing edge cases for international domains.
Updated regex to match RFC 5322 compliant email addresses.

Closes #55
```

```
docs(config): update configuration documentation

Add troubleshooting section for common configuration issues.
Clarify environment variable requirements.
```

```
refactor(transport): simplify transport loading logic

Extract transport validation into separate function.
Improve error messages for invalid transport configuration.
```

```
chore(deps): update dependencies to latest versions

Update all dependencies to their latest stable versions.
Includes security patches for vulnerable packages.
```

## Guidelines

1. **Always use imperative mood** in the subject line (e.g., "add" not "added" or "adds")
2. **Always include a scope** - never create a commit message without a scope
3. **Keep subject line under 72 characters**
4. **Use scope to clarify the change** - scope must be included in every commit
5. **Include body for complex changes** that need explanation
6. **Reference issues** when applicable using `Closes #123` or `Fixes #456`
7. **Mark breaking changes** clearly with `BREAKING CHANGE:` in the footer
8. **Be concise but descriptive** - the commit message should explain WHY the change was made

## When Generating Commit Messages

- Analyze the git diff to understand what changed
- Determine the appropriate type based on the nature of the changes
- **ALWAYS identify and include a scope** - this is mandatory
- Write a clear, imperative subject line
- Add a body if the change is complex or needs explanation
- Include issue references if mentioned in the changes or code comments
- Flag breaking changes if they exist

## Scope Selection Rules

If you cannot determine a specific scope from the changes:
- Look at the file paths modified
- Identify the main package/component affected
- Use a general scope if multiple areas are touched (e.g., `proxy` for general proxy changes)
- Never omit the scope - always find one that fits

**Remember: Every commit message MUST follow the format `<type>(<scope>): <subject>` - scope is never optional.**

