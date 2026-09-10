<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Español** · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

Organizador jerarquico de marcadores en lienzo infinito, con diseno minimalista beige.

Boxing transforma tu pagina de nueva pestana en un espacio de trabajo visual para marcadores. En lugar de carpetas planas, organiza tus marcadores en cajas etiquetadas en un lienzo infinito — arrastra, conecta y anidalos espacialmente. Piensa en Obsidian canvas conociendo a los marcadores.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Vista general del lienzo de Boxing" width="1280">
</picture>

## Indice

- [Funciones](#funciones)
- [Capturas de pantalla](#capturas-de-pantalla)
- [Recursos de marca](#recursos-de-marca)
- [Instalacion](#instalacion)
- [Uso](#uso)
- [Privacidad](#privacidad)
- [Desarrollo](#desarrollo)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

## Funciones

**Lienzo infinito** — Pan y zoom libres (Ctrl+rueda). Crea cajas ilimitadas en un solo lienzo. Conecta cajas con lineas para mostrar relaciones. Establece relaciones padre-hijo — mueve un padre y sus hijos lo siguen.

**Jerarquia de dos niveles** — Las cajas grandes contienen cajas pequenas, las cajas pequenas contienen marcadores. Haz clic en una caja para entrar en su sub-lienzo. La navegacion de migas de pan muestra tu ruta. Anida tan profundo como necesites.

**Gestion de marcadores** — Cada caja tiene su propia coleccion de marcadores con vistas de lista y cuadricula. Agregar, editar, eliminar con un dialogo limpio. Abrir en pestana actual o nueva pestana (configurable). Arrastrar para reordenar.

**Conectividad** — Lineas de conexion SVG visuales entre cajas. Alt+Clic en una linea para eliminarla (configurable: clic simple o doble clic). Propagacion de movimiento padre-hijo con fijacion de limites elastica.

**Diseno y tema** — Estetica minimalista beige/crema. Modo claro y oscuro con deteccion automatica del sistema. Tamano de fuente y zoom ajustables. Alternancia de esquinas cuadradas/redondeadas.

**14 idiomas** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi con deteccion automatica del idioma del navegador.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="Jerarquia de cajas y marcadores" width="1280">
</picture>

## Capturas de pantalla

| Lienzo | Cajas y marcadores | Conexiones |
|---|---|---|
| ![Lienzo](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![Cajas y marcadores](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![Conexiones](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| Ajustes | Edición de marcadores |
|---|---|
| ![Ajustes](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![Edición de marcadores](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## Recursos de marca

Los logotipos claro/oscuro, iconos de extensión, faviconos, mosaicos de tienda y la galería de variantes están incluidos en [`docs/brand/`](../../docs/brand/) (24 archivos, del kit de recursos `box_png`). Reutilizables para fichas de tienda, documentación y la vista previa social de GitHub.

## Instalacion

> [!TIP]
> Los paquetes de instalación precompilados ya están publicados en GitHub Releases: la [última versión](https://github.com/Xxx91n/boxing/releases/latest) incluye `boxing-chrome-<version>.zip` / `.crx`, `boxing-firefox-<version>.zip` / `.xpi` y `SHA256SUMS.txt`. La publicación en tiendas sigue en curso (Edge en marcha, Chrome Web Store aplazado, sin listado público en AMO): el `.xpi` de la release es la vía autoalojada para Firefox.

### Chrome / Edge (Chromium)

**Desde el paquete de la release (sin herramientas de compilación)**

1. Descarga `boxing-chrome-<version>.zip` de la [última release](https://github.com/Xxx91n/boxing/releases/latest) y descomprímelo
2. Abre `chrome://extensions` (o `edge://extensions`)
3. Activa el **modo de desarrollador** (interruptor arriba a la derecha)
4. Pulsa **Cargar desempaquetada** y selecciona la carpeta descomprimida `boxing-chrome/`

**Desde el código fuente**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `chrome://extensions` (or `edge://extensions`)
4. Enable Developer mode
5. Click Load unpacked and select `dist/boxing-chrome/`

### Firefox

**Desde el paquete de la release**

1. Descarga `boxing-firefox-<version>.xpi` de la [última release](https://github.com/Xxx91n/boxing/releases/latest) y ábrelo en Firefox: las compilaciones firmadas por AMO se instalan directamente; las no firmadas solo cargan en Firefox Developer Edition/Nightly
2. O descomprime `boxing-firefox-<version>.zip` y, en `about:debugging#/runtime/this-firefox`, usa **Cargar complemento temporal** apuntando al `manifest.json` descomprimido

**Desde el código fuente**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `about:debugging#/runtime/this-firefox`
4. Click Load Temporary Add-on and select `dist/boxing-firefox/manifest.json`

> [!NOTE]
> Node.js y npm solo hacen falta para compilar desde el código fuente; instalar desde el paquete de GitHub Release no los requiere. Cuando las tiendas estén activas, la instalación será directa.

## Uso

- **Doble clic** en lienzo vacio → crear nueva caja
- **Arrastrar** barra de titulo de caja → mover caja
- **Ctrl+rueda** → zoom del lienzo (30% a 200%)
- **Arrastrar** lienzo vacio → pan
- **Clic derecho** → volver al nivel de lienzo padre
- **Clic** en una caja → entrar en su sub-lienzo
- **Arrastrar** desde el punto medio del borde de una caja → conectar a otra caja
- **Alt+Clic** en linea de conexion → eliminarla
- **Estrella** en una caja → marcar como padre (los hijos se mueven juntos)
- **Alfiler** → bloquear posicion de caja
- **Boton circular** arriba a la derecha del lienzo → desbloquear encabezado para modo pantalla completa

## Privacidad

- Todos los datos almacenados localmente en `chrome.storage.local` — nada sale de tu dispositivo a menos que configures la copia de seguridad en la nube opcional
- La copia de seguridad WebDAV / GitHub Gist opcional es el unico uso de red saliente
- Sin analiticas, sin seguimiento, sin servicios de terceros
- 100% codigo abierto (Apache-2.0) — audita cada linea
- Politica de privacidad completa: [docs/privacy-policy.md](../../docs/privacy-policy.md)

## Desarrollo

### Requisitos

- Node.js >= 18
- npm

### Configuracion

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### Build

```bash
npm run build     # Build de desarrollo → dist/boxing-chrome + dist/boxing-firefox
npm test          # Tests de Playwright (Chrome + Firefox)
```

Ver [CONTRIBUTING.md](../../CONTRIBUTING.md) para la guia de desarrollo completa.

## Contribuir

Las contribuciones son bienvenidas! Ver [CONTRIBUTING.md](../../CONTRIBUTING.md) para configuracion, flujo de trabajo y estilo de codigo.

## Licencia

Apache-2.0 — ver [LICENSE](../../LICENSE)
