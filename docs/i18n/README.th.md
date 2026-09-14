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

> [!IMPORTANT]
> **ติดตั้งจากหน้าร้านค้าอย่างเป็นทางการ** (แนะนำ) ขั้นตอนการติดตั้งและเวอร์ชันที่เผยแพร่บนร้านค้าอ้างอิงได้จาก [README ภาษาอังกฤษ — Install](../../README.md#install) และ [หน้าสถานะการปล่อยเวอร์ชัน](../../docs/release-status.md)
> GitHub Releases เป็น **บันทึกการเปลี่ยนแปลงสำหรับผู้ใช้**: [รีลีสล่าสุด](https://github.com/Xxx91n/boxing/releases/latest)

### Firefox (การติดตั้งอย่างเป็นทางการ)

1. เปิด [Firefox Browser ADD-ONS — Boxing New Tab](https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/)
2. คลิก **Add to Firefox** และทำตามขั้นตอนของเบราว์เซอร์

### Edge / Chromium (การติดตั้งอย่างเป็นทางการ)

1. เปิด [Edge Add-ons — Boxing](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi)
2. คลิก **Get** เพื่อติดตั้ง (เบราว์เซอร์ตระกูล Chromium ใช้หน้าร้าน Edge)

### สำหรับนักพัฒนา: บิลด์จากซอร์สโค้ด

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm ci
npm run build
```

- Chrome/Edge: `chrome://extensions` → โหมดนักพัฒนา → **โหลดส่วนขยายที่ยังไม่ได้แพ็ก** → เลือก `dist/boxing-chrome/`
- Firefox: `about:debugging#/runtime/this-firefox` → **โหลดส่วนเสริมชั่วคราว** → เลือก `dist/boxing-firefox/manifest.json`

> [!NOTE]
> ไฟล์ zip ที่บิลด์ได้ใช้สำหรับ **อัปโหลดขึ้นร้านค้าหรือดีบักภายในเครื่อง** ไม่ใช่ช่องทางติดตั้งอย่างเป็นทางการ โปรดใช้ลิงก์ร้านค้าด้านบน
> การเซ็นชื่อทำโดยร้านค้า GitHub Releases ของรีโพนี้ **ไม่ได้** แจกจ่าย `.xpi` / `.crx` อีกต่อไป

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
