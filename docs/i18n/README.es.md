<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Español** · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

Gestor de marcadores jerárquico en lienzo infinito con diseño minimalista beige.

Boxing convierte la página de nueva pestaña de tu navegador en un espacio de trabajo visual para tus marcadores. Olvídate de las carpetas planas: organiza tus marcadores en cajas etiquetadas sobre un lienzo infinito — arrastra, conecta y anida según tu forma de pensar. Imagínalo como el lienzo de Obsidian adaptado a la gestión de marcadores.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Vista general del lienzo de Boxing" width="1280">
</picture>

## Índice

- [Funcionalidades](#funcionalidades)
- [Capturas de pantalla](#capturas-de-pantalla)
- [Instalación](#instalación)
- [Uso](#uso)
- [Privacidad](#privacidad)
- [Desarrollo](#desarrollo)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

## Funcionalidades

**Lienzo infinito** : Desplazamiento y zoom libres (Ctrl+rueda). Crea cajas ilimitadas en un único lienzo. Muestra relaciones entre cajas con líneas de conexión. Establece relaciones padre-hijo — las cajas hijas siguen automáticamente los movimientos de la caja padre.

**Jerarquía de dos niveles** : Las cajas grandes contienen cajas pequeñas, y las cajas pequeñas contienen marcadores. Haz clic en una caja para abrir su sublienzo. La barra de navegación (migas de pan) muestra la ruta actual. Anidamiento con profundidad ilimitada.

**Gestión de marcadores** : Cada caja mantiene su propia colección de marcadores en vista de lista o cuadrícula. Añadir, editar y eliminar con total sencillez. Abre enlaces en la pestaña actual o en una nueva (configurable). Ordenación mediante arrastrar y soltar.

**Líneas de conexión** : Conexiones SVG visuales entre cajas. Alt+clic en una línea para eliminarla (configurable: un clic o doble clic). Movimiento coordinado de padres a hijos con límites elásticos.

**Diseño y temas** : Estética minimalista en color beige / crema. Modo oscuro con adaptación automática al sistema. Tamaño de fuente y escala ajustables. Alternancia entre esquinas rectas y redondeadas.

**14 idiomas** : en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi (detección automática según el idioma del navegador).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="Jerarquía de cajas y marcadores" width="1280">
</picture>

## Capturas de pantalla

| Lienzo | Cajas y marcadores | Líneas de conexión |
|---|---|---|
| ![Lienzo](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![Cajas y marcadores](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![Líneas de conexión](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| Configuración | Editar marcador |
|---|---|
| ![Configuración](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![Editar marcador](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## Instalación

> [!IMPORTANT]
> **Recomendamos instalar a través de las tiendas oficiales** (recomendado). Los pasos de instalación oficiales y las versiones actualmente publicadas se mantienen en el [README en inglés — Install](../../README.md#install).
> Los GitHub Releases se usan únicamente como **registro de cambios para los usuarios**: [Última versión](https://github.com/Xxx91n/boxing/releases/latest).

### Firefox (instalación oficial)

1. Abre [Firefox Browser ADD-ONS — Boxing New Tab](https://addons.mozilla.org/es/firefox/addon/boxing-newtab/)
2. Haz clic en **Add to Firefox** y sigue las instrucciones del navegador para completar la instalación

### Edge / Chromium (instalación oficial)

1. Abre [Edge Add-ons — Boxing](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi)
2. Haz clic en **Obtener** / **Get** para completar la instalación (los navegadores basados en Chromium deben usar la página de Edge)

### Desarrolladores: compilar desde el código fuente

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm ci
npm run build
```

- Chrome/Edge: `chrome://extensions` → Modo de desarrollador → **Cargar extensión descomprimida** → seleccionar `dist/boxing-chrome/`
- Firefox: `about:debugging#/runtime/this-firefox` → **Cargar complemento temporal...** → seleccionar `dist/boxing-firefox/manifest.json`

> [!NOTE]
> El archivo zip generado es para **subir a tiendas o depuración local**, no como canal de instalación oficial para usuarios finales. Para uso habitual, utiliza los enlaces a tiendas indicados arriba.
> La firma digital la realizan las tiendas; este repositorio de GitHub **ya no distribuye** archivos `.xpi` / `.crx` en sus Releases.

## Uso

- **Doble clic** en un espacio vacío del lienzo → Crear una nueva caja
- **Arrastrar** la barra de título de la caja → Mover la caja
- **Ctrl+rueda** → Zoom en el lienzo (de 30 % a 200 %)
- **Arrastrar** en un espacio vacío del lienzo → Desplazar la vista (pan)
- **Clic derecho** → Volver al lienzo padre
- **Clic** en una caja → Entrar al sublienzo
- **Arrastrar** desde el centro del borde de una caja → Conectar con otra caja
- **Alt+clic** en una línea de conexión → Eliminar la línea
- **Estrella** en una caja → Marcar como caja padre (las cajas hijas se mueven con ella)
- **Chincheta / Pin** → Fijar la posición de la caja
- **Botón circular** superior derecho del lienzo → Desanclar y entrar en modo pantalla completa

## Privacidad

[docs/privacy-policy.md](../../docs/privacy-policy.md)

## Desarrollo

### Requisitos previos

- Node.js 24.22.1
- npm

### Configuración

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### Compilación

```bash
npm run build     # Compilación de desarrollo → dist/boxing-chrome + dist/boxing-firefox
npm test          # Pruebas con Playwright (Chrome + Firefox)
```

Consulta [CONTRIBUTING.md](../../CONTRIBUTING.md) para ver la guía completa de desarrollo.

## Contribuir

¡Las contribuciones son bienvenidas! Consulta [CONTRIBUTING.md](../../CONTRIBUTING.md) para conocer los detalles sobre el entorno, el flujo de trabajo y el estilo de código.

## Licencia

[Apache-2.0](../../LICENSE)
