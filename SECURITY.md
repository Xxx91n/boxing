# Security Policy

## Supported Versions

| Version   | Supported |
|-----------|-----------|
| 2026.11.1 | Yes       |
| < 2026.11.1 | No      |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Please report via [GitHub Security Advisories](https://github.com/Xxx91n/boxing/security/advisories/new) (Private Vulnerability Reporting).

Include:
- Description of the vulnerability
- Steps to reproduce
- Affected version
- Suggested fix (if any)

## Response Timeline

- Acknowledgment: within 72 hours
- Initial assessment: within 7 days
- Fix or mitigation: depends on severity, targeted within 30 days

## Scope

Boxing is a client-only browser extension. All data is stored locally. Outbound network access is limited to:

- **Favicon retrieval** from four third-party icon services (bytecook `ico.bytecook.io`, DuckDuckGo `icons.duckduckgo.com`, Google `www.google.com/s2/favicons`, favicon.im) and direct `favicon.ico` requests to bookmark-site hosts;
- **Version check** against the GitHub Releases API (`api.github.com`) with a fallback to `https://boxing.xxx91n.com/demo/version.json`;
- **User-configured WebDAV or GitHub Gist backup** (off by default).

No analytics, no tracking, no third-party code is executed. See [docs/privacy-policy.md](docs/privacy-policy.md) for the full outbound disclosure.
