<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Français** · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

Gestionnaire de favoris hiérarchique sur toile infinie, design minimaliste beige.

Boxing transforme la page de nouvel onglet de votre navigateur en un espace de travail visuel pour vos favoris. Fini les dossiers plats traditionnels : organisez vos favoris dans des boîtes étiquetées sur une toile infinie — glissez, reliez et imbriquez selon votre façon de penser. Considérez-le comme la toile d'Obsidian appliquée à la gestion des favoris.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Aperçu de la toile Boxing" width="1280">
</picture>

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Captures d'écran](#captures-décran)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Confidentialité](#confidentialité)
- [Développement](#développement)
- [Contribution](#contribution)
- [Licence](#licence)

## Fonctionnalités

**Toile infinie** : Déplacement et zoom libres (Ctrl+molette). Créez autant de boîtes que souhaité sur une seule toile. Visualisez les relations entre boîtes grâce à des lignes de connexion. Définissez des relations parent-enfant — les boîtes enfants suivent automatiquement le déplacement de la boîte parente.

**Hiérarchie à deux niveaux** : Les grandes boîtes contiennent des petites boîtes, et les petites boîtes contiennent des favoris. Cliquez sur une boîte pour accéder à sa sous-toile. Le fil d'Ariane affiche le chemin actuel. Imbrication possible à n'importe quelle profondeur.

**Gestion des favoris** : Chaque boîte possède sa propre collection de favoris, avec affichage en liste ou en grille. Ajout, modification et suppression simples et rapides. Ouverture dans l'onglet actif ou dans un nouvel onglet (configurable). Réorganisation par glisser-déposer.

**Lignes de connexion** : Connexions SVG visuelles entre les boîtes. Alt+clic sur une ligne pour la supprimer (configurable : clic simple ou double-clic). Déplacement synchronisé du parent vers les enfants avec contraintes de bordure élastiques.

**Design et thèmes** : Esthétique minimaliste beige / crème. Mode sombre avec suivi automatique du système. Taille de police et niveau de zoom ajustables. Bascule entre angles droits et arrondis.

**14 langues** : en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi, avec détection automatique de la langue du navigateur.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="Hiérarchie des boîtes et favoris" width="1280">
</picture>

## Captures d'écran

| Toile | Boîtes et favoris | Lignes de connexion |
|---|---|---|
| ![Toile](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![Boîtes et favoris](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![Lignes de connexion](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| Paramètres | Édition de favori |
|---|---|
| ![Paramètres](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![Édition de favori](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## Installation

> [!IMPORTANT]
> **Veuillez installer l'extension depuis la page officielle de la boutique** (recommandé). Les étapes d'installation de référence et les versions actuellement publiées sont maintenues dans le [README en anglais — Install](../../README.md#install).
> Les publications GitHub Releases servent uniquement de **journal des modifications utilisateur** : [Dernière version](https://github.com/Xxx91n/boxing/releases/latest).

### Firefox (installation officielle)

1. Ouvrez [Firefox Browser ADD-ONS — Boxing New Tab](https://addons.mozilla.org/fr/firefox/addon/boxing-newtab/)
2. Cliquez sur **Add to Firefox** et suivez les instructions du navigateur pour finaliser l'installation

### Edge / Chromium (installation officielle)

1. Ouvrez [Edge Add-ons — Boxing](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi)
2. Cliquez sur **Obtenir** / **Get** pour finaliser l'installation (pour les navigateurs basés sur Chromium, veuillez utiliser la page du catalogue Edge)

### Développeurs : compiler depuis les sources

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm ci
npm run build
```

- Chrome/Edge : `chrome://extensions` → Mode développeur → **Charger l'extension non empaquetée** → sélectionner `dist/boxing-chrome/`
- Firefox : `about:debugging#/runtime/this-firefox` → **Charger un module temporaire...** → sélectionner `dist/boxing-firefox/manifest.json`

> [!NOTE]
> Le fichier zip issu de la compilation est destiné à **la publication sur les boutiques ou au débogage local**, et non de canal d'installation officiel pour les utilisateurs finaux. Pour un usage standard, veuillez passer par les liens officiels ci-dessus.
> La signature numérique est effectuée par les boutiques ; ce dépôt GitHub **ne distribue plus** de fichiers `.xpi` / `.crx` dans ses Releases.

## Utilisation

- **Double-clic** sur un espace vide de la toile → Créer une nouvelle boîte
- **Glisser** la barre de titre d'une boîte → Déplacer la boîte
- **Ctrl+molette** → Zoomer sur la toile (de 30 % à 200 %)
- **Glisser** sur un espace vide de la toile → Déplacer la vue (pan)
- **Clic droit** → Revenir à la toile parente
- **Cliquer** sur une boîte → Entrer dans la sous-toile
- **Glisser** depuis le milieu d'un bord de boîte → Relier à une autre boîte
- **Alt+clic** sur une ligne de connexion → Supprimer la ligne
- **Étoile** sur une boîte → Définir comme boîte parente (les boîtes enfants suivent le déplacement)
- **Épingle** → Verrouiller la position de la boîte
- **Bouton rond** en haut à droite de la toile → Détacher et passer en mode plein écran

## Confidentialité

[docs/privacy-policy.md](../../docs/privacy-policy.md)

## Développement

### Prérequis

- Node.js 24.22.1
- npm

### Configuration

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### Compilation

```bash
npm run build     # Compilation de développement → dist/boxing-chrome + dist/boxing-firefox
npm test          # Tests Playwright (Chrome + Firefox)
```

Consultez [CONTRIBUTING.md](../../CONTRIBUTING.md) pour accéder au guide complet de développement.

## Contribution

Les contributions sont les bienvenues ! Consultez [CONTRIBUTING.md](../../CONTRIBUTING.md) pour en savoir plus sur l'environnement de travail, les flux et le style de code.

## Licence

[Apache-2.0](../../LICENSE)
