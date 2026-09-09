<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · **Русский** · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

Иерархический органайзер закладок на бесконечном холсте, бежевый минималистичный дизайн.

Boxing превращает новую вкладку в визуальное рабочее пространство для закладок. Вместо плоских папок вы организуете закладки в помеченные блоки на бесконечном холсте — перетаскивайте, соединяйте и вкладывайте их пространственно. Представьте холст Obsidian, встретившийся с закладками.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Обзор холста Boxing" width="1280">
</picture>

## Содержание

- [Возможности](#возможности)
- [Установка](#установка)
- [Использование](#использование)
- [Конфиденциальность](#конфиденциальность)
- [Разработка](#разработка)
- [Участие](#участие)
- [Лицензия](#лицензия)

## Возможности

**Бесконечный холст** — Свободное панорамирование и масштабирование (Ctrl+колесо). Создавайте неограниченное количество блоков на одном холсте. Соединяйте блоки линиями для отображения связей. Устанавливайте отношения родитель-потомок — двигаете родителя, потомки следуют.

**Двухуровневая иерархия** — Большие блоки содержат малые блоки, малые блоки содержат закладки. Нажмите на блок, чтобы войти в его под-холст. Хлебные крошки показывают путь. Вкладывайте на любую глубину.

**Управление закладками** — Каждый блок имеет свою коллекцию закладок с видами списка и сетки. Добавление, редактирование, удаление через чистый диалог. Открытие в текущей или новой вкладке (настраиваемо). Перетаскивание для сортировки.

**Соединения** — Визуальные SVG-линии соединений между блоками. Alt+клик по линии для удаления (настраиваемо: одинарный или двойной клик). Распространение движения родитель-потомок с упругим ограничением границ.

**Дизайн и тема** — Бежевая/кремовая минималистичная эстетика. Светлый и тёмный режим с автоматическим определением системы. Регулируемый размер шрифта и масштаб. Переключение квадратных/закруглённых углов.

**14 языков** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi с автоматическим определением языка браузера.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="Иерархия блоков и закладки" width="1280">
</picture>

## Установка

### Chrome / Edge (Chromium)

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `chrome://extensions` (or `edge://extensions`)
4. Enable Developer mode
5. Click Load unpacked and select `dist/boxing-chrome/`

### Firefox

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `about:debugging#/runtime/this-firefox`
4. Click Load Temporary Add-on and select `dist/boxing-firefox/manifest.json`

> [!TIP]
> Until the first release is published, Node.js and npm are required once to build from source.
## Использование

- **Двойной клик** по пустому холсту → создать новый блок
- **Перетащить** заголовок блока → переместить блок
- **Ctrl+колесо** → масштаб холста (от 30% до 200%)
- **Перетащить** пустой холст → панорамирование
- **Правый клик** → вернуться на родительский уровень холста
- **Клик** по блоку → войти в под-холст
- **Перетащить** от середины края блока → соединить с другим блоком
- **Alt+клик** по линии соединения → удалить
- **Звезда** на блоке → отметить как родитель (потомки двигаются вместе)
- **Булавка** → заблокировать позицию блока
- **Кнопка-круг** вверху справа холста → открепить заголовок для полноэкранного режима

## Конфиденциальность

- Все данные хранятся локально в `chrome.storage.local` — ничего не покидает ваше устройство, если вы не настроите опциональное облачное резервное копирование
- Опциональное резервное копирование WebDAV / GitHub Gist — единственное исходящее сетевое использование
- Никакой аналитики, никакого отслеживания, никаких сторонних сервисов
- 100% открытый исходный код (Apache-2.0) — аудит каждой строки
- Полная политика конфиденциальности: [docs/privacy-policy.md](../../docs/privacy-policy.md)

## Разработка

### Требования

- Node.js >= 18
- npm

### Настройка

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### Сборка

```bash
npm run build     # Сборка для разработки → dist/boxing-chrome + dist/boxing-firefox
npm test          # Тесты Playwright (Chrome + Firefox)
```

См. [CONTRIBUTING.md](../../CONTRIBUTING.md) для полного руководства разработчика.

## Участие

Вклады приветствуются! См. [CONTRIBUTING.md](../../CONTRIBUTING.md) для настройки, рабочего процесса и стиля кода.

## Лицензия

Apache-2.0 — см. [LICENSE](../../LICENSE)
