# Boxing Privacy Policy

**Last updated:** 2026-11-01  
**Effective date:** 2026-08-08

## Introduction

Boxing is an open-source browser extension that provides a hierarchical, infinite-canvas bookmark organizer. This privacy policy explains what data we collect, how we use it, and how we protect it. Its scope covers the Boxing extension and its demo mirror; services operated by third parties (icon providers, GitHub, your WebDAV host) are governed by their own policies and are out of scope of this document.

**Boxing does not collect, transmit, or sell any personal data to any server operated by the developer.**

The full source code is available at [https://github.com/Xxx91n/boxing](https://github.com/Xxx91n/boxing) under the Apache-2.0 license. You can audit every line of code yourself.

## Data We Collect

**Data stored locally on your device:**

- Bookmark metadata (titles, URLs, descriptions, tags, custom icons)
- Canvas layout data (box positions, sizes, connections, parent-child relationships)
- Extension settings (theme, font size, zoom level, open-in-tab preference, connection delete action)
- WebDAV credentials and GitHub tokens, wrapped in an obfuscation envelope at rest (see Data Security)

**Data we do NOT collect:**

- We do NOT collect browsing history
- We do NOT collect analytics or telemetry
- We do NOT collect device information
- We do NOT collect IP addresses
- We do NOT use tracking pixels, cookies, or fingerprinting
- We do NOT sell your data. The automatic favicon and version-check requests described in Network Connections transmit only the technical data listed there (bookmark-site hostnames and an anonymous version check) to those third-party services.

## How We Use Your Data

Your data is used solely to provide the extension's functionality:

- Bookmark organization and display on the New Tab Page
- Canvas rendering and interaction
- Settings persistence across sessions

No data ever leaves your device unless you explicitly configure optional cloud backup (see below), or as part of the automatic favicon and version-check requests disclosed in Network Connections.

## Network Connections (Outbound)

Boxing is local-first: your bookmarks, layout, and settings stay on your device unless you enable backup. The extension does, however, make the following automatic or user-triggered outbound requests:

**Favicon retrieval (automatic, on by default).** When displaying a bookmark whose icon is not yet cached, Boxing requests the site icon from all four third-party icon services in parallel: bytecook (`ico.bytecook.io`), DuckDuckGo (`icons.duckduckgo.com`), Google (`www.google.com/s2/favicons`), and favicon.im (`favicon.im`); it may also request the bookmark site's own `https://<host>/favicon.ico` directly. The first successful response is used and cached, but the other in-flight requests are not cancelled, and a session winner does not restrict later uncached hosts to a single service. Boxing intentionally places only the bookmark site's hostname (domain) in these request URLs — no bookmark titles, full URLs, or other data are included. As with any browser request, browser-controlled request metadata (such as your network address, referrer, or cookies) may also be transmitted; Boxing does not and cannot control those fields.

**Version check (automatic).** The About screen periodically queries the GitHub Releases API (`api.github.com/repos/Xxx91n/boxing/releases/latest`) to show whether a newer version is available, with a fallback to `https://boxing.xxx91n.com/demo/version.json`. This request is anonymous and does not include any local data.

**User-configured backup (optional, off by default).** If you enable cloud backup, Boxing contacts the WebDAV server you configure and/or the GitHub Gist API (`api.github.com/gists`) as described under Data Storage. These connections go directly from your browser to the servers you choose.

## Data Storage

All primary data is stored locally using `chrome.storage.local`, which persists across browser sessions and is scoped to the extension. This data never leaves your device.

### Optional Cloud Backup (User-Configured)

Boxing supports **optional** cloud backup via WebDAV or GitHub Gist. These features are **disabled by default** and require explicit user configuration:

- **WebDAV backup:** You provide a WebDAV server URL, username, and password. Your data is transmitted directly from your browser to your WebDAV server. We never proxy or intercept this connection. Credentials are stored locally in an obfuscated envelope, not under a user-supplied key (see Data Security). Use a dedicated WebDAV account or a narrowly scoped token.

  **WebDAV URLs must be public HTTPS endpoints by default.** The extension refuses literal private, loopback, and link-local hostnames — `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.0.0/16` (including the cloud metadata address `169.254.169.254`), `172.16.0.0/12`, `*.local`, and `*.internal` — in the settings UI and again in the extension's background proxy before any request leaves the browser. These checks inspect the hostname string only; they do not resolve DNS, so a public-looking hostname that resolves to a private address is not covered by this rule. The reason for the default refusal: a WebDAV URL you enter is later fetched by the extension, and permitting private addresses would turn a mistyped or hand-supplied URL into a request originating from inside your network (SSRF-style exposure) — router admin pages, NAS interfaces, cloud metadata endpoints. Also refused at every layer: non-HTTPS URLs, URLs longer than 2048 characters, and URLs with an embedded username/password.

  **Self-hosted WebDAV on your LAN or on `localhost` is refused by default and can be allowed by an explicit opt-in:** Settings → Sync → WebDAV → *Allow private / local network hosts (advanced)*. The checkbox ships off. Turning it on relaxes only the private-host refusal — HTTPS remains required, and the no-embedded-credentials rule and 2048-character URL limit still apply. Enable it only for a server you own, and prefer a name you control on a public HTTPS endpoint wherever that option exists.

- **GitHub Gist backup:** You provide a GitHub personal access token. Your data is pushed directly to GitHub Gist API from your browser. We never see your token; it is stored locally in an obfuscated envelope.

In both cases, the data path is **directly from your browser to your chosen cloud provider**. Boxing's developer has no access to your data, your credentials, or your cloud accounts.

## Data Security

- All local storage is scoped to the extension via `chrome.storage.local` — other extensions cannot access it.
- **Credential storage is obfuscation, not user-keyed encryption:** WebDAV passwords and GitHub tokens are wrapped with AES-GCM using a key derived (PBKDF2) from a random per-install key plus a per-record salt. The per-install key is generated on first use, stored only in your browser's `chrome.storage.local`, and is never included in the layout, JSON exports, WebDAV/Gist backups, or snapshots — an export or backup file read in isolation cannot unlock your credentials. It does **not** protect them from anyone who can read your browser profile (the key sits in the same storage area as the ciphertext) or who has the running extension. There is no passphrase prompt on this path and no user-supplied key material in it; do not rely on this as strong encryption.
- **Passphrase-protected backup files are user-keyed, and the key is only the passphrase:** you may tick *Passphrase-protect exports* in Settings → Data to seal a manually exported backup (standard envelope or full DR package) in a versioned `boxingBackup: 1` envelope — PBKDF2-SHA-256 (310,000 iterations, per-file 16-byte salt) → AES-GCM-256 with a per-file 12-byte IV. We never transmit or store that passphrase anywhere: it is not written to your profile, the layout, a snapshot, a sync payload or a log, and it is cleared from the dialog the moment it closes. Consequences we state rather than soften: lose the passphrase and the file stays unreadable (there is no recovery path and no passphrase sync), and the sealed file is readable by anyone who does hold it, so treat the file and the passphrase together as the secret. This protection covers exported files only — automatic backups and sync traffic keep their own existing protocol, and the per-install credential key above is never used to seal one, which is why restoring a backup on another install still asks you to re-enter your WebDAV/GitHub credentials.
- All network connections use HTTPS (enforced by URL validation — HTTP is rejected).
- No third-party JavaScript libraries or frameworks are loaded at runtime — the extension is vanilla JavaScript. The automatic favicon and version-check requests described in Network Connections contact third-party servers, but no third-party code is downloaded or executed from them.
- The source code is publicly auditable.

## Data Sharing

We do not sell or share your data with anyone. Your bookmarks, layout, and settings stay on your device unless you explicitly configure cloud backup. The automatic favicon and version-check requests in Network Connections send only the minimal technical data described there (a bookmark site's hostname for favicon lookup, or an anonymous version-check request) to the third-party icon services and the GitHub Releases API.

## User Rights

- **Right to access:** All your data is stored locally and is always accessible to you.
- **Right to delete:** Uninstalling the extension or using the in-extension "Clear all data" function removes all local data.
- **Right to export:** Use the built-in export function to download a JSON backup of all your bookmarks and layout.
- **Right to port:** Exported JSON can be imported into any compatible tool.
- **Right to opt-out:** Cloud backup features are opt-in and can be disabled at any time.

## Children's Privacy

Boxing is not directed at children under 13. We do not knowingly collect any data from anyone, including children. If you believe a child has provided information to us, please be aware that we do not retain or have access to any such data — all data is stored locally on the user's own device.

## Changes to This Privacy Policy

We may update this privacy policy from time to time. Changes will be posted to this page with an updated date. Since Boxing does not collect data, changes to the policy typically reflect updates to the extension's features.

## Contact

For privacy questions or concerns, please open an issue on our [GitHub repository](https://github.com/Xxx91n/boxing/issues).

## Open Source

Boxing is licensed under the Apache-2.0 license. The complete source code is available for independent audit at [https://github.com/Xxx91n/boxing](https://github.com/Xxx91n/boxing).
