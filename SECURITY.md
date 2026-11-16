# Security Policy

## Supported Versions

| Version   | Supported |
|-----------|-----------|
| 2026.10.17 | Yes      |
| < 2026.10.17 | No     |

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

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:7537b1ebd756122884859e9ff6b7110cebe2f228048fb894039d1c71f58be7f9 -->

- **Favicon retrieval** from five third-party icon services (DuckDuckGo `icons.duckduckgo.com`, Google `www.google.com/s2/favicons` with redirects to `t*.gstatic.com`, favicon.im, icon.horse, and Yandex `favicon.yandex.net`) and the bookmark site’s own `https://<host>/favicon.ico`, all requested in parallel. Failed lookups can be retried after 7 days, including up to 3 in the background per new-tab load;

<!-- /coderabbit-ai-generated:v1 -->
- **Version check** against the GitHub Releases API (`api.github.com`) with a fallback to `https://boxing.xxx91n.com/demo/version.json`;
- **User-configured WebDAV or GitHub Gist backup** (off by default).

No analytics, no tracking, no third-party code is executed. See [docs/privacy-policy.md](docs/privacy-policy.md) for the full outbound disclosure.
