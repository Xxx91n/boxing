<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Français** · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

Organisateur de signets hierarchique sur canevas infini, design minimaliste beige.

Boxing transforme votre page de nouvel onglet en espace de travail visuel pour vos signets. Au lieu de dossiers plats, organisez vos signets dans des boites etiquetees sur un canevas infini — glissez, connectez et imbriquez-les spatialment. Pensez Obsidian canvas rencontre signets.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Apercu du canevas Boxing" width="1280">
</picture>

## Sommaire

- [Fonctionnalites](#fonctionnalites)
- [Captures d'écran](#captures-décran)
- [Ressources de marque](#ressources-de-marque)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Confidentialite](#confidentialite)
- [Developpement](#developpement)
- [Contribuer](#contribuer)
- [Licence](#licence)

## Fonctionnalites

**Canevas infini** — Pan et zoom libres (Ctrl+molette). Creez un nombre illimite de boites sur un seul canevas. Connectez les boites avec des lignes pour montrer les relations. Definissez des relations parent-enfant — deplacez un parent et ses enfants suivent.

**Hierarchie a deux niveaux** — Les grandes boites contiennent des petites boites, les petites boites contiennent des signets. Cliquez sur une boite pour entrer dans son sous-canevas. Le fil d Ariane montre votre chemin. Imbriquez aussi profondement que necessaire.

**Gestion des signets** — Chaque boite a sa propre collection de signets avec vues liste et grille. Ajouter, modifier, supprimer avec un dialogue eclaire. Ouvrir dans l onglet actuel ou un nouvel onglet (configurable). Glisser pour reorganiser.

**Connectivite** — Lignes de connexion SVG visuelles entre boites. Alt+Clic sur une ligne pour la supprimer (configurable: clic simple ou double-clic). Propagation du deplacement parent-enfant avec limite elastique.

**Design et theme** — Esthetique minimaliste beige/creme. Mode clair et sombre avec detection automatique du systeme. Taille de police et zoom ajustables. Bascule coins carres/arrondis.

**14 langues** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi avec detection automatique de la langue du navigateur.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="Hierarchie des boites et signets" width="1280">
</picture>

## Captures d'écran

| Toile | Boîtes et favoris | Connexions |
|---|---|---|
| ![Toile](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![Boîtes et favoris](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![Connexions](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| Paramètres | Édition des favoris |
|---|---|
| ![Paramètres](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![Édition des favoris](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## Ressources de marque

Les logos clair/sombre, icônes d'extension, favicons, vignettes de boutique et la galerie de variantes sont fournis dans [`docs/brand/`](../../docs/brand/) (24 fichiers, issus du kit d'assets `box_png`). Réutilisables pour les fiches de boutique, la documentation et l'aperçu social GitHub.

## Installation

> [!TIP]
> Des paquets d'installation pré-construits sont publiés sur GitHub Releases : la [dernière version](https://github.com/Xxx91n/boxing/releases/latest) fournit `boxing-chrome-<version>.zip` / `.crx`, `boxing-firefox-<version>.zip` / `.xpi` et `SHA256SUMS.txt`. Le déploiement sur les boutiques est en cours (Edge en bonne voie, Chrome Web Store reporté, aucun listing public AMO) — le `.xpi` de la release sert d'installation auto-hébergée pour Firefox.

### Chrome / Edge (Chromium)

**Depuis le paquet de la release (aucun outil de build requis)**

1. Télécharger `boxing-chrome-<version>.zip` depuis la [dernière release](https://github.com/Xxx91n/boxing/releases/latest) et le décompresser
2. Ouvrir `chrome://extensions` (ou `edge://extensions`)
3. Activer le **mode développeur** (interrupteur en haut à droite)
4. Cliquer sur **Charger une extension non empaquetée** et sélectionner le dossier décompressé `boxing-chrome/`

**Depuis les sources**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `chrome://extensions` (or `edge://extensions`)
4. Enable Developer mode
5. Click Load unpacked and select `dist/boxing-chrome/`

### Firefox

**Depuis le paquet de la release**

1. Télécharger `boxing-firefox-<version>.xpi` depuis la [dernière release](https://github.com/Xxx91n/boxing/releases/latest) et l'ouvrir dans Firefox — les versions signées AMO s'installent directement ; les versions non signées ne se chargent que dans Firefox Developer Edition/Nightly
2. Ou décompresser `boxing-firefox-<version>.zip`, aller sur `about:debugging#/runtime/this-firefox` et choisir **Charger un module temporaire** en pointant le `manifest.json` décompressé

**Depuis les sources**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `about:debugging#/runtime/this-firefox`
4. Click Load Temporary Add-on and select `dist/boxing-firefox/manifest.json`

> [!NOTE]
> Node.js et npm ne sont nécessaires que pour la compilation depuis les sources ; l'installation depuis le paquet GitHub Release s'en passe. Une fois les boutiques ouvertes, rien de tout cela ne sera nécessaire.

## Utilisation

- **Double-clic** sur canevas vide → creer une nouvelle boite
- **Glisser** la barre de titre de la boite → deplacer la boite
- **Ctrl+molette** → zoomer le canevas (30% a 200%)
- **Glisser** le canevas vide → pan
- **Clic droit** → revenir au niveau de canevas parent
- **Clic** sur une boite → entrer dans son sous-canevas
- **Glisser** depuis le milieu d un bord de boite → connecter a une autre boite
- **Alt+Clic** sur une ligne de connexion → la supprimer
- **Etoile** sur une boite → marquer comme parent (les enfants bougent ensemble)
- **Epingle** → verrouiller la position de la boite
- **Bouton cercle** en haut a droite du canevas → detacher l en-tete pour le mode plein ecran

## Confidentialite

- Toutes les donnees stockees localement dans `chrome.storage.local` — rien ne quitte votre appareil sauf si vous configurez la sauvegarde cloud optionnelle
- La sauvegarde WebDAV / GitHub Gist optionnelle est la seule utilisation reseau sortante
- Pas d analytics, pas de tracking, pas de services tiers
- 100% open source (Apache-2.0) — auditez chaque ligne
- Politique de confidentialite complete: [docs/privacy-policy.md](../../docs/privacy-policy.md)

## Developpement

### Prerequis

- Node.js >= 18
- npm

### Configuration

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### Build

```bash
npm run build     # Build dev → dist/boxing-chrome + dist/boxing-firefox
npm test          # Tests Playwright (Chrome + Firefox)
```

Voir [CONTRIBUTING.md](../../CONTRIBUTING.md) pour le guide de developpement complet.

## Contribuer

Les contributions sont les bienvenues! Voir [CONTRIBUTING.md](../../CONTRIBUTING.md) pour la configuration, le flux de travail et le style de code.

## Licence

Apache-2.0 — voir [LICENSE](../../LICENSE)
