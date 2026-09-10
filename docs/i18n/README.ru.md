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
- [Снимки экрана](#снимки-экрана)
- [Фирменные материалы](#фирменные-материалы)
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

## Снимки экрана

| Холст | Блоки и закладки | Связи |
|---|---|---|
| ![Холст](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![Блоки и закладки](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![Связи](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| Настройки | Редактирование закладок |
|---|---|
| ![Настройки](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![Редактирование закладок](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## Фирменные материалы

Светлые и тёмные логотипы, значки расширения, фавиконы, плитки для магазина и галерея вариантов лежат в [`docs/brand/`](../../docs/brand/) (24 файла из набора `box_png`). Используйте их для листингов магазинов, документации и social preview GitHub.

## Установка

> [!TIP]
> Готовые установочные пакеты опубликованы в GitHub Releases: [последний релиз](https://github.com/Xxx91n/boxing/releases/latest) содержит `boxing-chrome-<version>.zip` / `.crx`, `boxing-firefox-<version>.zip` / `.xpi` и `SHA256SUMS.txt`. Размещение в магазинах ещё в процессе (Edge — идёт, Chrome Web Store отложен, публичного листинга в AMO нет) — self-hosted-путь для Firefox — `.xpi` из релиза.

### Chrome / Edge (Chromium)

**Из пакета релиза (инструменты сборки не нужны)**

1. Скачайте `boxing-chrome-<version>.zip` из [последнего релиза](https://github.com/Xxx91n/boxing/releases/latest) и распакуйте
2. Откройте `chrome://extensions` (или `edge://extensions`)
3. Включите **режим разработчика** (переключатель в правом верхнем углу)
4. Нажмите **Загрузить распакованное расширение** и выберите распакованную папку `boxing-chrome/`

**Из исходного кода**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `chrome://extensions` (or `edge://extensions`)
4. Enable Developer mode
5. Click Load unpacked and select `dist/boxing-chrome/`

### Firefox

**Из пакета релиза**

1. Скачайте `boxing-firefox-<version>.xpi` из [последнего релиза](https://github.com/Xxx91n/boxing/releases/latest) и откройте в Firefox — сборки с подписью AMO устанавливаются напрямую; неподписанные загружаются только в Firefox Developer Edition/Nightly
2. Или распакуйте `boxing-firefox-<version>.zip` и на странице `about:debugging#/runtime/this-firefox` выберите **Временно запустить дополнение**, указав на распакованный `manifest.json`

**Из исходного кода**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `about:debugging#/runtime/this-firefox`
4. Click Load Temporary Add-on and select `dist/boxing-firefox/manifest.json`

> [!NOTE]
> Node.js и npm нужны только для сборки из исходников; установка из пакета GitHub Releases обходится без них. После публикации в магазинах не понадобится ничего.

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
