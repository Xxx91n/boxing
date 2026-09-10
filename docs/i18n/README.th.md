<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · **ไทย** · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

ตัวจัดการบุ๊คมาร์กแบบลำดับชั้นบนผืนผ้าใบไม่จำกัด ดีไซน์มินิมอลสีเบจ

Boxing เปลี่ยนหน้าแท็บใหม่ของคุณให้เป็นพื้นที่ทำงานเชิงภาพสำหรับบุ๊คมาร์ก แทนที่จะเป็นโฟลเดอร์แบบเรียบ ให้จัดระเบียบบุ๊คมาร์กในกล่องที่มีป้ายกำกับบนผืนผ้าใบไม่จำกัด — ลาก เชื่อมต่อ และซ้อนทับตามแนวคิดของคุณ คิดถึง Obsidian canvas พบกับบุ๊คมาร์ก

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="ภาพรวมผืนผ้าใบ Boxing" width="1280">
</picture>

## สารบัญ

- [คุณสมบัติ](#คุณสมบัติ)
- [ภาพหน้าจอ](#ภาพหน้าจอ)
- [ทรัพยากรแบรนด์](#ทรัพยากรแบรนด์)
- [การติดตั้ง](#การติดตั้ง)
- [การใช้งาน](#การใช้งาน)
- [ความเป็นส่วนตัว](#ความเป็นส่วนตัว)
- [การพัฒนา](#การพัฒนา)
- [การมีส่วนร่วม](#การมีส่วนร่วม)
- [ลิขสิทธิ์](#ลิขสิทธิ์)

## คุณสมบัติ

**ผืนผ้าใบไม่จำกัด** — เลื่อนและซูมอย่างอิสระ (Ctrl+ล้อเลื่อน) สร้างกล่องไม่จำกัดบนผืนผ้าใบเดียว เชื่อมต่อกล่องด้วยเส้นเพื่อแสดงความสัมพันธ์ กำหนดความสัมพันธ์พ่อ-ลูก — ย้ายพ่อแล้วลูกตามไปด้วย

**ลำดับชั้นสองระดับ** — กล่องใหญ่บรรจุกล่องเล็ก กล่องเล็กบรรจุบุ๊คมาร์ก คลิกที่กล่องเพื่อเข้าสู่ผืนผ้าใบย่อย เบรดครัมบ์นำทางแสดงเส้นทางของคุณ ซ้อนทับลึกเท่าที่ต้องการ

**การจัดการบุ๊คมาร์ก** — แต่ละกล่องมีคอลเลกชันบุ๊คมาร์กของตัวเองพร้อมมุมมองรายการและตาราง เพิ่ม แก้ไข ลบด้วยกล่องโต้ตอบที่สะอาดตา เปิดในแท็บปัจจุบันหรือแท็บใหม่ (กำหนดค่าได้) ลากเพื่อจัดเรียงใหม่

**การเชื่อมต่อ** — เส้นเชื่อมต่อ SVG แบบภาพระหว่างกล่อง Alt+คลิกที่เส้นเพื่อลบ (กำหนดค่าได้: คลิกเดียวหรือดับเบิลคลิก) การเคลื่อนที่พ่อ-ลูกกระจายพร้อมขอบเขตยืดหยุ่น

**ดีไซน์และธีม** — สุนทรียศาสตร์มินิมอลสีเบจ/ครีม โหมดสว่างและมืดพร้อมตรวจจับระบบอัตโนมัติ ปรับขนาดฟอนต์และซูมได้ สลับมุมเหลี่ยม/มน

**14 ภาษา** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi พร้อมตรวจจับภาษาเบราว์เซอร์อัตโนมัติ

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="ลำดับชั้นกล่องและบุ๊คมาร์ก" width="1280">
</picture>

## ภาพหน้าจอ

| ผืนผ้าใบ | กล่องและที่คั่นหน้า | เส้นเชื่อมต่อ |
|---|---|---|
| ![ผืนผ้าใบ](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![กล่องและที่คั่นหน้า](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![เส้นเชื่อมต่อ](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| การตั้งค่า | แก้ไขที่คั่นหน้า |
|---|---|
| ![การตั้งค่า](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![แก้ไขที่คั่นหน้า](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## ทรัพยากรแบรนด์

โลโก้แบบสว่าง/มืด ไอคอนส่วนขยาย ฟาวิคอน ภาพ tile ร้านค้า และแกลเลอรีแบบหลากหลาย รวมอยู่ใน [`docs/brand/`](../../docs/brand/) (24 ไฟล์ จากชุดทรัพยากร `box_png`) นำไปใช้ซ้ำได้ทั้งรายการร้านค้า เอกสาร และภาพตัวอย่างโซเชียลของ GitHub

## การติดตั้ง

> [!TIP]
> แพ็กเกจติดตั้งพร้อมใช้งานเผยแพร่บน GitHub Releases แล้ว: [รุ่นล่าสุด](https://github.com/Xxx91n/boxing/releases/latest) มี `boxing-chrome-<version>.zip` / `.crx`, `boxing-firefox-<version>.zip` / `.xpi` และ `SHA256SUMS.txt` รายการร้านค้ายังทยอยเปิด (Edge กำลังดำเนินการ, Chrome Web Store รอหลัง Edge เปิด, AMO ยังไม่มีรายการสาธารณะ) — ไฟล์ `.xpi` จากรุ่นนี้คือเส้นทางติดตั้ง Firefox แบบโฮสต์เอง

### Chrome / Edge (Chromium)

**ติดตั้งจากแพ็กเกจรุ่นเผยแพร่ (ไม่ต้องมีเครื่องมือ build)**

1. ดาวน์โหลด `boxing-chrome-<version>.zip` จาก[รุ่นล่าสุด](https://github.com/Xxx91n/boxing/releases/latest) แล้วแตกไฟล์
2. เปิด `chrome://extensions` (หรือ `edge://extensions`)
3. เปิด **โหมดนักพัฒนา** (สวิตช์มุมขวาบน)
4. คลิก **โหลดส่วนขยายแบบแยกไฟล์** แล้วเลือกโฟลเดอร์ `boxing-chrome/` ที่แตกไฟล์

**Build จากซอร์สโค้ด**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `chrome://extensions` (or `edge://extensions`)
4. Enable Developer mode
5. Click Load unpacked and select `dist/boxing-chrome/`

### Firefox

**ติดตั้งจากแพ็กเกจรุ่นเผยแพร่**

1. ดาวน์โหลด `boxing-firefox-<version>.xpi` จาก[รุ่นล่าสุด](https://github.com/Xxx91n/boxing/releases/latest) แล้วเปิดใน Firefox — รุ่นที่เซ็นโดย AMO ติดตั้งได้โดยตรง รุ่นไม่เซ็นโหลดได้เฉพาะ Firefox Developer Edition/Nightly
2. หรือแตกไฟล์ `boxing-firefox-<version>.zip` แล้วไปที่ `about:debugging#/runtime/this-firefox` เลือก **โหลดส่วนเสริมชั่วคราว** ไปที่ `manifest.json` ที่แตกไฟล์

**Build จากซอร์สโค้ด**

1. Clone or download the repository: https://github.com/Xxx91n/boxing
2. Run `npm install` then `npm run build`
3. Go to `about:debugging#/runtime/this-firefox`
4. Click Load Temporary Add-on and select `dist/boxing-firefox/manifest.json`

> [!NOTE]
> ต้องใช้ Node.js และ npm เฉพาะเมื่อ build จากซอร์สโค้ด การติดตั้งจากแพ็กเกจ GitHub Releases ไม่จำเป็นต้องมี และเมื่อรายการร้านค้าเปิดแล้วจะติดตั้งได้ในคลิกเดียว

## การใช้งาน

- **ดับเบิลคลิก** ผืนผ้าใบว่าง → สร้างกล่องใหม่
- **ลาก** แถบหัวข้อกล่อง → ย้ายกล่อง
- **Ctrl+ล้อเลื่อน** → ซูมผืนผ้าใบ (30% ถึง 200%)
- **ลาก** ผืนผ้าใบว่าง → เลื่อน
- **คลิกขวา** → กลับไปยังระดับผืนผ้าใบพ่อ
- **คลิก** ที่กล่อง → เข้าสู่ผืนผ้าใบย่อย
- **ลาก** จากกึ่งกลางขอบกล่อง → เชื่อมต่อกับกล่องอื่น
- **Alt+คลิก** เส้นเชื่อมต่อ → ลบ
- **ดาว** บนกล่อง → ทำเครื่องหมายเป็นพ่อ (ลูกเคลื่อนที่ตามไปด้วย)
- **พิน** → ล็อกตำแหน่งกล่อง
- **ปุ่มวงกลม** ขวาบนผืนผ้าใบ → ปลดหัวสำหรับโหมดเต็มจอ

## ความเป็นส่วนตัว

- ข้อมูลทั้งหมดจัดเก็บใน `chrome.storage.local` — ไม่มีอะไรออกจากอุปกรณ์ของคุณเว้นแต่คุณกำหนดค่าการสำรองข้อมูลบนคลาวด์
- การสำรองข้อมูล WebDAV / GitHub Gist ที่เลือกได้เป็นการใช้เครือข่ายขาออกเพียงอย่างเดียว
- ไม่มีการวิเคราะห์ ไม่มีการติดตาม ไม่มีบริการภายนอก
- 100% โอเพนซอร์ส (Apache-2.0) — ตรวจสอบทุกบรรทัดได้
- นโยบายความเป็นส่วนตัวฉบับเต็ม: [docs/privacy-policy.md](../../docs/privacy-policy.md)

## การพัฒนา

### ข้อกำหนดเบื้องต้น

- Node.js >= 18
- npm

### การตั้งค่า

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### บิลด์

```bash
npm run build     # บิลด์พัฒนา → dist/boxing-chrome + dist/boxing-firefox
npm test          # ทดสอบ Playwright (Chrome + Firefox)
```

ดู [CONTRIBUTING.md](../../CONTRIBUTING.md) สำหรับคู่มือการพัฒนาฉบับเต็ม

## การมีส่วนร่วม

ยินดีรับการมีส่วนร่วม! ดู [CONTRIBUTING.md](../../CONTRIBUTING.md) สำหรับการตั้งค่า เวิร์กโฟลว์ และสไตล์โค้ด

## ลิขสิทธิ์

Apache-2.0 — ดู [LICENSE](../../LICENSE)
