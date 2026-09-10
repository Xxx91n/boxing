<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · **العربية** · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

منظم إشارات مرجعية هرمي على لوحة لا نهائية، تصميم بيج مينيمالي.

Boxing يحول صفحة التبويب الجديدة إلى مساحة عمل مرئية للإشارات المرجعية. بدلاً من المجلدات المسطحة، نظّم إشاراتك المرجعية في صناديق معنونة على لوحة لا نهائية — اسحبها وصِلها وداخلها مكانيّاً. فكّر في لوحة Obsidian تلتقي بالإشارات المرجعية.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="نظرة عامة على لوحة Boxing" width="1280">
</picture>

## الفهرس

- [الميزات](#الميزات)
- [لقطات الشاشة](#لقطات-الشاشة)
- [أصول العلامة التجارية](#أصول-العلامة-التجارية)
- [التثبيت](#التثبيت)
- [الاستخدام](#الاستخدام)
- [الخصوصية](#الخصوصية)
- [التطوير](#التطوير)
- [المساهمة](#المساهمة)
- [الترخيص](#الترخيص)

## الميزات

**لوحة لا نهائية** — تحريك وتكبير حر (Ctrl+عجلة الفأرة). إنشاء صناديق غير محدودة على لوحة واحدة. ربط الصناديق بخطوط لإظهار العلاقات. تعيين علاقات أب-ابن — حرّك الأب ويتبعه الأبناء.

**هيكل هرمي من مستويين** — الصناديق الكبيرة تحتوي صغيرة، والصغيرة تحتوي إشارات مرجعية. انقر على صندوق لدخول لوحته الفرعية. فتات الخبز يظهر مسارك. التداخل لأي عمق تحتاجه.

**إدارة الإشارات المرجعية** — كل صندوق له مجموعته الخاصة من الإشارات المرجعية مع عروض القائمة والشبكة. إضافة، تحرير، حذف بحوار نظيف. الفتح في التبويب الحالي أو تبويب جديد (قابل للتخصيص). السحب لإعادة الترتيب.

**الاتصالات** — خطوط اتصال SVG مرئية بين الصناديق. Alt+نقر على خط لحذفه (قابل للتخصيص: نقرة واحدة أو نقرة مزدوجة). انتشار حركة أب-ابن مع تثبيت حدود مرن.

**التصميم والمظهر** — جماليات بيج/كريمي مينيمالية. الوضع الفاتح والداكن مع كشف تلقائي للنظام. حجم خط وتكبير قابلان للتعديل. تبديل زوايا مربعة/دائرية.

**14 لغة** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi مع كشف تلقائي للغة المتصفح.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="هرمية الصناديق والإشارات المرجعية" width="1280">
</picture>

## لقطات الشاشة

| اللوحة | الصناديق والإشارات | خطوط الاتصال |
|---|---|---|
| ![اللوحة](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![الصناديق والإشارات](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![خطوط الاتصال](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| الإعدادات | تحرير الإشارات |
|---|---|
| ![الإعدادات](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![تحرير الإشارات](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## أصول العلامة التجارية

شعارات الوضع الفاتح والداكن وأيقونات الإضافة وأيقونات المواقع وبلاطات المتجر ومعرض التنويعات مضمّنة في [`docs/brand/`](../../docs/brand/) (24 ملفًا من حزمة أصول `box_png`)؛ أعِد استخدامها في إدراجات المتجر والوثائق ومعاينة GitHub الاجتماعية.

## التثبيت

> [!TIP]
> حزم التثبيت الجاهزة منشورة على GitHub Releases: يوفّر [أحدث إصدار](https://github.com/Xxx91n/boxing/releases/latest) `boxing-chrome-<version>.zip` / `.crx` و`boxing-firefox-<version>.zip` / `.xpi` و`SHA256SUMS.txt`. الإدراجات في المتاجر ما زالت قيد التدرّج (Edge جارٍ، وChrome Web Store مؤجّل، ولا إدراج عام على AMO) — ملف `.xpi` من الإصدار هو مسار التثبيت المستضاف ذاتيًا لـ Firefox.

### Chrome / Edge (Chromium)

**من حزمة الإصدار (لا أدوات بناء مطلوبة)**

1. نزّل `boxing-chrome-<version>.zip` من [أحدث إصدار](https://github.com/Xxx91n/boxing/releases/latest) وفك ضغطه
2. افتح `chrome://extensions` (أو `edge://extensions`)
3. فعّل **وضع المطور** (المفتاح أعلى اليمين)
4. اضغط **تحميل إضافة غير مغلّفة** واختر مجلد `boxing-chrome/` المفكوك

**من المصدر**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `chrome://extensions` (or `edge://extensions`)
4. Enable Developer mode
5. Click Load unpacked and select `dist/boxing-chrome/`

### Firefox

**من حزمة الإصدار**

1. نزّل `boxing-firefox-<version>.xpi` من [أحدث إصدار](https://github.com/Xxx91n/boxing/releases/latest) وافتحه في Firefox — الحزم الموقعة من AMO تُثبَّت مباشرة؛ وغير الموقعة تُحمَّل فقط في Firefox Developer Edition/Nightly
2. أو فك ضغط `boxing-firefox-<version>.zip` ثم من `about:debugging#/runtime/this-firefox` اختر **تحميل إضافة مؤقتة** وحدّد `manifest.json` المفكوك

**من المصدر**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `about:debugging#/runtime/this-firefox`
4. Click Load Temporary Add-on and select `dist/boxing-firefox/manifest.json`

> [!NOTE]
> ‏Node.js وnpm مطلوبان فقط للبناء من المصدر؛ التثبيت من حزمة GitHub Releases لا يحتاجهما، وبعد إدراج المتاجر لن تكون هناك حاجة لأيٍّ منهما.

## الاستخدام

- **نقر مزدوج** على لوحة فارغة → إنشاء صندوق جديد
- **سحب** شريط عنوان الصندوق → تحريك الصندوق
- **Ctrl+عجلة** → تكبير اللوحة (30% إلى 200%)
- **سحب** لوحة فارغة → تحريك
- **نقر يمين** → العودة إلى مستوى اللوحة الأب
- **نقر** على صندوق → دخول لوحته الفرعية
- **سحب** من منتصف حافة الصندوق → ربط بصندوق آخر
- **Alt+نقر** على خط الاتصال → حذفه
- **نجمة** على صندوق → تعليم كأب (الأبناء يتحركون معاً)
- **دبوس** → قفل موضع الصندوق
- **زر دائري** أعلى يمين اللوحة → فك التثبيت للوضع بملء الشاشة

## الخصوصية

- جميع البيانات مخزنة محلياً في `chrome.storage.local` — لا شيء يغادر جهازك إلا إذا قمت بتكوين نسخة احتياطية سحابية اختيارية
- النسخ الاحتياطي الاختياري WebDAV / GitHub Gist هو الاستخدام الصادر الوحيد للشبكة
- بدون تحليلات، بدون تتبع، بدون خدمات طرف ثالث
- 100% مفتوح المصدر (Apache-2.0) — تدقيق كل سطر
- سياسة الخصوصية الكاملة: [docs/privacy-policy.md](../../docs/privacy-policy.md)

## التطوير

### المتطلبات

- Node.js >= 18
- npm

### الإعداد

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### البناء

```bash
npm run build     # بناء التطوير → dist/boxing-chrome + dist/boxing-firefox
npm test          # اختبارات Playwright (Chrome + Firefox)
```

انظر [CONTRIBUTING.md](../../CONTRIBUTING.md) لدليل التطوير الكامل.

## المساهمة

المساهمات مرحب بها! انظر [CONTRIBUTING.md](../../CONTRIBUTING.md) للإعداد وسير العمل وأسلوب الكود.

## الترخيص

Apache-2.0 — انظر [LICENSE](../../LICENSE)
