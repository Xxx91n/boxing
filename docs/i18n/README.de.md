<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · **Deutsch** · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

Hierarchischer Lesezeichen-Organisator auf unendlicher Leinwand, im beige-minimalistischen Design.

Boxing wandelt Ihre neue Tab-Seite in einen visuellen Arbeitsbereich fuer Lesezeichen um. Statt flacher Ordner organisieren Sie Lesezeichen in beschrifteten Boxen auf einer unendlichen Leinwand — ziehen, verbinden und schachteln Sie sie raeumlich. Obsidian-Canvas trifft auf Lesezeichen.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Boxing Canvas-Uebersicht" width="1280">
</picture>

## Inhaltsverzeichnis

- [Funktionen](#funktionen)
- [Screenshots](#screenshots)
- [Marken-Assets](#marken-assets)
- [Installation](#installation)
- [Verwendung](#verwendung)
- [Datenschutz](#datenschutz)
- [Entwicklung](#entwicklung)
- [Mitwirken](#mitwirken)
- [Lizenz](#lizenz)

## Funktionen

**Unendliche Leinwand** — Frei schwenken und zoomen (Strg+Scrollen). Unbegrenzt viele Boxen auf einer einzigen Leinwand erstellen. Boxen mit Linien verbinden, um Beziehungen darzustellen. Eltern-Kind-Beziehungen festlegen — eine Eltern-Box bewegen, und die Kinder folgen.

**Zweistufige Hierarchie** — Grosse Boxen enthalten kleine Boxen, kleine Boxen enthalten Lesezeichen. Auf eine Box klicken, um ihren Unter-Canvas zu betreten. Brotkrumelnavigation zeigt den Pfad. So tief schachteln wie noetig.

**Lesezeichen-Verwaltung** — Jede Box hat ihre eigene Lesezeichensammlung mit Listen- und Rasteransicht. Hinzufuegen, bearbeiten, loeschen mit einem klaren Dialog. In aktuellem Tab oder neuem Tab oeffnen (konfigurierbar). Ziehen zum Sortieren.

**Verbindungen** — Visuelle SVG-Verbindungslinien zwischen Boxen. Alt+Klick auf eine Linie zum Loeschen (konfigurierbar: Einfachklick oder Doppelklick). Eltern-Kind-Bewegungspropagierung mit elastischer Begrenzung.

**Design und Theme** — Beige/Creme-minimalistische Aesthetik. Hell- und Dunkelmodus mit automatischer Systemerkennung. Einstellbare Schriftgroesse und Zoom. Eckig/abgerundet umschalten.

**14 Sprachen** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi mit automatischer Browser-Sprachenerkennung.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="Box-Hierarchie und Lesezeichen" width="1280">
</picture>

## Screenshots

| Leinwand | Boxen & Lesezeichen | Verbindungen |
|---|---|---|
| ![Leinwand](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![Boxen & Lesezeichen](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![Verbindungen](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| Einstellungen | Lesezeichen-Bearbeitung |
|---|---|
| ![Einstellungen](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![Lesezeichen-Bearbeitung](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## Marken-Assets

Helle und dunkle Logos, Erweiterungs-Icons, Favicons, Store-Kacheln und die Varianten-Übersicht liegen im Repository unter [`docs/brand/`](../../docs/brand/) (24 Dateien aus dem `box_png`-Asset-Kit). Wiederverwendbar für Store-Listings, Dokumentation und GitHub-Social-Preview.

## Installation

> [!IMPORTANT]
> **Installieren Sie über die offiziellen Store-Seiten** (empfohlen). Maßgeblich für die Installationsschritte und die aktuell veröffentlichte Store-Version sind das [englische README — Install](../../README.md#install) und die [Release-Statusseite](../../docs/release-status.md).
> GitHub Releases sind ein **Änderungsprotokoll für Nutzer**: [neueste Release](https://github.com/Xxx91n/boxing/releases/latest).

### Firefox (offizielle Installation)

1. Öffnen Sie [Firefox Browser ADD-ONS — Boxing New Tab](https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/)
2. Klicken Sie auf **Zu Firefox hinzufügen** und folgen Sie den Hinweisen des Browsers

### Edge / Chromium (offizielle Installation)

1. Öffnen Sie [Edge Add-ons — Boxing](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi)
2. Klicken Sie auf **Get** / **Hinzufügen**, um die Installation abzuschließen (Chromium-Browser: nutzen Sie die Edge-Store-Seite)

### Entwickler: Aus dem Quellcode bauen

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm ci
npm run build
```

- Chrome/Edge: `chrome://extensions` → Entwicklermodus → **Entpackte Erweiterung laden** → `dist/boxing-chrome/` wählen
- Firefox: `about:debugging#/runtime/this-firefox` → **Temporäres Add-on laden** → `dist/boxing-firefox/manifest.json` wählen

> [!NOTE]
> Die Build-Artefakte (zip) dienen **dem Store-Upload oder dem lokalen Debuggen**, nicht als offizieller Installationsweg. Nutzen Sie die Store-Links oben.
> Die Signierung erfolgt durch die Stores; die GitHub Releases dieses Repositorys verteilen **keine** `.xpi` / `.crx` mehr.

## Verwendung

- **Doppelklick** auf leere Leinwand → neue Box erstellen
- **Ziehen** an Box-Titelleiste → Box bewegen
- **Strg+Scrollen** → Leinwand zoomen (30% bis 200%)
- **Ziehen** der leeren Leinwand → Schwenken
- **Rechtsklick** → zurueck zur uebergeordneten Canvas-Ebene
- **Klick** auf eine Box → Unter-Canvas betreten
- **Ziehen** von Box-Kantenmitte → mit anderer Box verbinden
- **Alt+Klick** auf Verbindungslinie → loeschen
- **Stern** auf einer Box → als Eltern-Box markieren (Kinder bewegen sich mit)
- **Pin** → Box-Position sperren
- **Kreis-Schaltflaeche** oben rechts auf Leinwand → Kopfzeile loesen fuer Vollbildmodus

## Datenschutz

- Alle Daten werden lokal in `chrome.storage.local` gespeichert — nichts verlaesst Ihr Geraet, es sei denn, Sie konfigurieren optionales Cloud-Backup
- Optionales WebDAV / GitHub Gist Backup ist die einzige ausgehende Netzwerkverwendung
- Keine Analytik, kein Tracking, keine Drittanbieter-Dienste
- 100% Open Source (Apache-2.0) — jede Zeile pruefbar
- Vollstaendige Datenschutzrichtlinie: [docs/privacy-policy.md](../../docs/privacy-policy.md)

## Entwicklung

### Voraussetzungen

- Node.js >= 18
- npm

### Einrichtung

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### Build

```bash
npm run build     # Dev-Build → dist/boxing-chrome + dist/boxing-firefox
npm test          # Playwright-Tests (Chrome + Firefox)
```

Siehe [CONTRIBUTING.md](../../CONTRIBUTING.md) fuer die vollstaendige Entwicklungsanleitung.

## Mitwirken

Beitraege sind willkommen! Siehe [CONTRIBUTING.md](../../CONTRIBUTING.md) fuer Einrichtung, Workflow und Code-Stil.

## Lizenz

Apache-2.0 — siehe [LICENSE](../../LICENSE)
