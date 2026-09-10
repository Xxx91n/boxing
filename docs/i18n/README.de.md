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

> [!TIP]
> Fertige Installationspakete sind auf GitHub Releases veröffentlicht: Der [neueste Release](https://github.com/Xxx91n/boxing/releases/latest) enthält `boxing-chrome-<version>.zip` / `.crx`, `boxing-firefox-<version>.zip` / `.xpi` und `SHA256SUMS.txt`. Die Store-Listings rollen noch aus (Edge läuft, Chrome Web Store zurückgestellt, AMO ohne öffentliches Listing) — das Release-`.xpi` ist der selbst gehostete Firefox-Weg.

### Chrome / Edge (Chromium)

**Aus dem Release-Paket (keine Build-Tools nötig)**

1. `boxing-chrome-<version>.zip` vom [neuesten Release](https://github.com/Xxx91n/boxing/releases/latest) herunterladen und entpacken
2. `chrome://extensions` (oder `edge://extensions`) öffnen
3. **Entwicklermodus** (Schalter oben rechts) aktivieren
4. **Entpackte Erweiterung laden** klicken und den entpackten Ordner `boxing-chrome/` auswählen

**Aus dem Quellcode bauen**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `chrome://extensions` (or `edge://extensions`)
4. Enable Developer mode
5. Click Load unpacked and select `dist/boxing-chrome/`

### Firefox

**Aus dem Release-Paket**

1. `boxing-firefox-<version>.xpi` vom [neuesten Release](https://github.com/Xxx91n/boxing/releases/latest) herunterladen und in Firefox öffnen — AMO-signierte Builds installieren direkt; unsignierte Builds laden nur in Firefox Developer Edition/Nightly
2. Alternativ `boxing-firefox-<version>.zip` entpacken und auf `about:debugging#/runtime/this-firefox` per **Add-on vorübergehend laden** die entpackte `manifest.json` auswählen

**Aus dem Quellcode bauen**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `about:debugging#/runtime/this-firefox`
4. Click Load Temporary Add-on and select `dist/boxing-firefox/manifest.json`

> [!NOTE]
> Node.js und npm werden nur für den Build aus dem Quellcode benötigt; die Installation aus dem GitHub-Release-Paket kommt ohne sie aus. Nach den Store-Listings entfällt beides.

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
