# Boxing Privacy Policy

**Last updated:** 2026-08-08  
**Effective date:** 2026-08-08

## Introduction

Boxing is an open-source browser extension that provides a hierarchical, infinite-canvas bookmark organizer. This privacy policy explains what data we collect, how we use it, and how we protect it.

**Boxing does not collect, transmit, or sell any personal data to any server operated by the developer.**

The full source code is available at [https://github.com/Xxx91n/boxing](https://github.com/Xxx91n/boxing) under the Apache-2.0 license. You can audit every line of code yourself.

## Data We Collect

**Data stored locally on your device:**

- Bookmark metadata (titles, URLs, descriptions, tags, custom icons)
- Canvas layout data (box positions, sizes, connections, parent-child relationships)
- Extension settings (theme, font size, zoom level, open-in-tab preference, connection delete action)
- Encrypted WebDAV credentials (stored in `chrome.storage.local`, encrypted with a user-provided password)

**Data we do NOT collect:**

- We do NOT collect browsing history
- We do NOT collect analytics or telemetry
- We do NOT collect device information
- We do NOT collect IP addresses
- We do NOT use tracking pixels, cookies, or fingerprinting
- We do NOT sell or share data with any third party

## How We Use Your Data

Your data is used solely to provide the extension's functionality:

- Bookmark organization and display on the New Tab Page
- Canvas rendering and interaction
- Settings persistence across sessions

No data ever leaves your device unless you explicitly configure optional cloud backup (see below).

## Data Storage

All primary data is stored locally using `chrome.storage.local`, which persists across browser sessions and is scoped to the extension. This data never leaves your device.

### Optional Cloud Backup (User-Configured)

Boxing supports **optional** cloud backup via WebDAV or GitHub Gist. These features are **disabled by default** and require explicit user configuration:

- **WebDAV backup:** You provide a WebDAV server URL, username, and password. Your data is transmitted directly from your browser to your WebDAV server. We never proxy or intercept this connection. Credentials are encrypted with a user-provided password and stored locally.

- **GitHub Gist backup:** You provide a GitHub personal access token. Your data is pushed directly to GitHub Gist API from your browser. We never see or store your token beyond local encrypted storage.

In both cases, the data path is **directly from your browser to your chosen cloud provider**. Boxing's developer has no access to your data, your credentials, or your cloud accounts.

## Data Security

- All local storage is scoped to the extension via `chrome.storage.local` — other extensions cannot access it.
- WebDAV credentials are encrypted with AES-GCM using a user-provided password before storage.
- All network connections use HTTPS (enforced by URL validation — HTTP is rejected).
- No third-party libraries are loaded at runtime. The extension is 100% vanilla JavaScript with no external dependencies loaded from CDNs or remote servers.
- The source code is publicly auditable.

## Data Sharing

We do not share your data with anyone. Your data stays on your device unless you explicitly configure cloud backup to a service you control.

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
