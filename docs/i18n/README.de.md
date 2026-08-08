<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · **Deutsch** · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md)
<!-- README-I18N:END -->

# Boxing

Hierarchischer Lesezeichen-Organisator auf unendlicher Leinwand, im beige-minimalistischen Design.

Boxing wandelt Ihre neue Tab-Seite in einen visuellen Arbeitsbereich fuer Lesezeichen um. Statt flacher Ordner organisieren Sie Lesezeichen in beschrifteten Boxen auf einer unendlichen Leinwand — ziehen, verbinden und schachteln Sie sie raeumlich. Obsidian-Canvas trifft auf Lesezeichen.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Boxing Canvas-Uebersicht" width="1280">
</picture>

> [!NOTE]
> Dies ist ein Platzhalter. Ersetzen Sie ihn durch einen echten Screenshot, der die Haupt-Leinwand mit Boxen und Verbindungen zeigt.

## Inhaltsverzeichnis

- [Funktionen](#features)
- [Installation](#install)
- [**Doppelklick** auf leere Leinwand → neue Box erstellen,**Ziehen** an Box-Titelleiste → Box bewegen,**Strg+Scrollen** → Leinwand zoomen (30% bis 200%),**Ziehen** der leeren Leinwand → Schwenken,**Rechtsklick** → zurueck zur uebergeordneten Canvas-Ebene,**Klick** auf eine Box → Unter-Canvas betreten,**Ziehen** von Box-Kantenmitte → mit anderer Box verbinden,**Alt+Klick** auf Verbindungslinie → loeschen,**Stern** auf einer Box → als Eltern-Box markieren (Kinder bewegen sich mit),**Pin** → Box-Position sperren,**Kreis-Schaltflaeche** oben rechts auf Leinwand → Kopfzeile loesen fuer Vollbildmodus](#usage)
- [Alle Daten werden lokal in `chrome.storage.local` gespeichert — nichts verlaesst Ihr Geraet, es sei denn, Sie konfigurieren optionales Cloud-Backup,Optionales WebDAV / GitHub Gist Backup ist die einzige ausgehende Netzwerkverwendung,Keine Analytik, kein Tracking, keine Drittanbieter-Dienste,100% Open Source (Apache-2.0) — jede Zeile pruefbar,Vollstaendige Datenschutzrichtlinie: [docs/privacy-policy.md](../../docs/privacy-policy.md)](#privacy)
- [Entwicklung](#development)
- [Mitwirken](#contributing)
- [Lizenz](#license)

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

> [!NOTE]
> Dies ist ein Platzhalter. Ersetzen Sie ihn durch einen echten Screenshot, der die Box-Hierarchie und Lesezeichenverwaltung zeigt.

## Installation

### Chrome / Edge (Chromium)

1. Neueste [Release-ZIP](https://github.com/Xxx91n/boxing/releases) herunterladen
2. In einen Ordner entpacken
3. Zu `chrome://extensions` (oder `edge://extensions`) gehen
4. Entwicklermodus aktivieren (oben rechts)
5. Auf **Entpackte Erweiterung laden** klicken und den entpackten Ordner auswaehlen

### Firefox

1. Neueste [Release-XPI](https://github.com/Xxx91n/boxing/releases) herunterladen
2. Zu `about:addons` gehen
3. Auf das Zahnrad-Symbol klicken → **Add-on aus Datei installieren**
4. Die heruntergeladene XPI-Datei auswaehlen

> [!TIP]
> Endbenutzer benoetigen kein Node.js oder npm. Diese sind nur fuer die Entwicklung.

## **Doppelklick** auf leere Leinwand → neue Box erstellen,**Ziehen** an Box-Titelleiste → Box bewegen,**Strg+Scrollen** → Leinwand zoomen (30% bis 200%),**Ziehen** der leeren Leinwand → Schwenken,**Rechtsklick** → zurueck zur uebergeordneten Canvas-Ebene,**Klick** auf eine Box → Unter-Canvas betreten,**Ziehen** von Box-Kantenmitte → mit anderer Box verbinden,**Alt+Klick** auf Verbindungslinie → loeschen,**Stern** auf einer Box → als Eltern-Box markieren (Kinder bewegen sich mit),**Pin** → Box-Position sperren,**Kreis-Schaltflaeche** oben rechts auf Leinwand → Kopfzeile loesen fuer Vollbildmodus

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

## Alle Daten werden lokal in `chrome.storage.local` gespeichert — nichts verlaesst Ihr Geraet, es sei denn, Sie konfigurieren optionales Cloud-Backup,Optionales WebDAV / GitHub Gist Backup ist die einzige ausgehende Netzwerkverwendung,Keine Analytik, kein Tracking, keine Drittanbieter-Dienste,100% Open Source (Apache-2.0) — jede Zeile pruefbar,Vollstaendige Datenschutzrichtlinie: [docs/privacy-policy.md](../../docs/privacy-policy.md)

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

<!-- README-I18N:START:FOOTER -->
> Translations: [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END:FOOTER -->
