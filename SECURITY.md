# Security Policy

## Supported Versions

This project follows semantic versioning and publishes security fixes as patch/minor releases on the latest supported lines.

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |
| < 1.0   | ❌        |

Notes:
- Pre-releases (e.g., `-beta`) based on the current `1.x` line receive fixes as needed.
- Older lines may be selectively backported for high/critical issues at the maintainers’ discretion.

## Reporting a Vulnerability

Please report security issues responsibly and avoid filing public GitHub issues for them.

Preferred: open a private advisory via GitHub Security Advisories:
- Create a draft advisory: `https://github.com/growthspace-engineering/gs-mcp-proxy-pii-redactor/security/advisories/new`

Include, when possible:
- Affected version(s) (e.g., `1.5.0`) and environment (OS, Node version)
- Minimal reproduction steps or proof-of-concept
- Impact assessment (what an attacker can do)
- Any mitigations or workarounds you identified

We will acknowledge receipt within 3 business days. You can expect status updates at least weekly until resolution. Once a fix is available, we will:
1. Publish patched releases to npm and GitHub Releases
2. Credit reporters (if desired) in the advisory/release notes
3. Coordinate disclosure timing to allow reasonable patching time for users

If you cannot use GitHub advisories, you may alternatively open a private issue with limited details and request escalation to a security advisory, but advisories are preferred.

## Disclosure Policy

- We practice coordinated disclosure. Please do not disclose vulnerabilities publicly until a fix has been released and a coordinated timeline is agreed.
- If an issue is found in a dependency, we may forward details to the upstream project and coordinate timelines.

## Scope and Out-of-Scope

In scope:
- Vulnerabilities in the application code, configuration parsing, authentication/authorization, redaction logic, or logging paths that could leak sensitive data.

Out of scope (non-exhaustive):
- Issues requiring unrealistic attacker capabilities or non-default, unsupported configurations
- Social engineering, physical attacks, or stolen credentials
- Vulnerabilities in third-party services or libraries not maintained by this project (though we welcome heads-up)

## Security Updates

- Fixes are released as patch/minor versions on supported lines and documented in GitHub Releases.
- Users are encouraged to keep `@growthspace-engineering/gs-mcp-proxy-pii-redactor` up to date and to review release notes for security-impacting changes.


