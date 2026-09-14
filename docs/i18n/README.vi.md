<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · **Tiếng Việt** — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

Trình tổ chức dấu trang phân cấp trên khung vẽ vô hạn, thiết kế tối giản màu be.

Boxing biến trang tab mới của bạn thành không gian làm việc trực quan cho dấu trang. Thay vì các thư mục phẳng, hãy tổ chức dấu trang của bạn trong các hộp có nhãn trên khung vẽ vô hạn — kéo, kết nối và lồng chúng theo không gian. Hãy nghĩ về canvas Obsidian gặp gỡ dấu trang.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Tổng quan khung vẽ Boxing" width="1280">
</picture>

## Mục lục

- [Tính năng](#tính-năng)
- [Ảnh chụp màn hình](#ảnh-chụp-màn-hình)
- [Tài nguyên thương hiệu](#tài-nguyên-thương-hiệu)
- [Cài đặt](#cài-đặt)
- [Sử dụng](#sử-dụng)
- [Quyền riêng tư](#quyền-riêng-tư)
- [Phát triển](#phát-triển)
- [Đóng góp](#đóng-góp)
- [Giấy phép](#giấy-phép)

## Tính năng

**Khung vẽ vô hạn** — Pan và zoom tự do (Ctrl+lăn chuột). Tạo không giới hạn hộp trên một khung vẽ. Kết nối các hộp bằng đường thẳng để hiển thị mối quan hệ. Thiết lập quan hệ cha-con — di chuyển cha và các con theo sau.

**Phân cấp hai cấp** — Hộp lớn chứa hộp nhỏ, hộp nhỏ chứa dấu trang. Nhấp vào hộp để vào khung vẽ con. Điều hướng breadcrumb hiển thị đường đi. Lồng sâu bao nhiêu tùy ý.

**Quản lý dấu trang** — Mỗi hộp có bộ sưu tập dấu trang riêng với chế độ xem danh sách và lưới. Thêm, chỉnh sửa, xóa bằng hộp thoại gọn gàng. Mở trong tab hiện tại hoặc tab mới (có thể cấu hình). Kéo để sắp xếp lại.

**Kết nối** — Đường kết nối SVG trực quan giữa các hộp. Alt+nhấp vào đường kết nối để xóa (có thể cấu hình: nhấp đơn hoặc nhấp đôi). Truyền lan di chuyển cha-con với kẹp biên đàn hồi.

**Thiết kế và chủ đề** — Thẩm mỹ tối giản be/cream. Chế độ sáng và tối với tự động phát hiện hệ thống. Cỡ chữ và zoom có thể điều chỉnh. Chuyển đổi góc vuông/bo tròn.

**14 ngôn ngữ** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi với tự động phát hiện ngôn ngữ trình duyệt.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="Phân cấp hộp và dấu trang" width="1280">
</picture>

## Ảnh chụp màn hình

| Canvas | Hộp và dấu trang | Kết nối |
|---|---|---|
| ![Canvas](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![Hộp và dấu trang](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![Kết nối](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| Cài đặt | Sửa dấu trang |
|---|---|
| ![Cài đặt](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![Sửa dấu trang](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## Tài nguyên thương hiệu

Logo sáng/tối, biểu tượng phần mở rộng, favicon, ô ảnh cửa hàng và trang giới thiệu biến thể đều có trong [`docs/brand/`](../../docs/brand/) (24 tệp, từ bộ tài nguyên `box_png`). Dùng lại cho danh sách cửa hàng, tài liệu và ảnh xem trước xã hội của GitHub.

## Cài đặt

> [!IMPORTANT]
> **Cài đặt từ trang cửa hàng chính thức** (khuyến nghị). Các bước cài đặt và phiên bản đã phát hành trên cửa hàng được quy định tại [README tiếng Anh — Install](../../README.md#install) và [trang trạng thái phát hành](../../docs/release-status.md).
> GitHub Releases là **nhật ký thay đổi dành cho người dùng**: [bản phát hành mới nhất](https://github.com/Xxx91n/boxing/releases/latest).

### Firefox (cài đặt chính thức)

1. Mở [Firefox Browser ADD-ONS — Boxing New Tab](https://addons.mozilla.org/zh-CN/firefox/addon/boxing-newtab/)
2. Nhấn **Add to Firefox** và làm theo hướng dẫn của trình duyệt

### Edge / Chromium (cài đặt chính thức)

1. Mở [Edge Add-ons — Boxing](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi)
2. Nhấn **Get** để cài đặt (trình duyệt Chromium dùng trang cửa hàng Edge)

### Nhà phát triển: build từ mã nguồn

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm ci
npm run build
```

- Chrome/Edge: `chrome://extensions` → Chế độ nhà phát triển → **Tải tiện ích chưa đóng gói** → chọn `dist/boxing-chrome/`
- Firefox: `about:debugging#/runtime/this-firefox` → **Tải tiện ích tạm thời** → chọn `dist/boxing-firefox/manifest.json`

> [!NOTE]
> Các file zip được build ra dùng để **tải lên cửa hàng hoặc gỡ lỗi cục bộ**, không phải kênh cài đặt chính thức. Hãy dùng liên kết cửa hàng ở trên.
> Việc ký được thực hiện bởi cửa hàng; GitHub Releases của repo này **không còn** phân phối `.xpi` / `.crx`.

## Sử dụng

- **Nhấp đúp** khung vẽ trống → tạo hộp mới
- **Kéo** thanh tiêu đề hộp → di chuyển hộp
- **Ctrl+lăn chuột** → zoom khung vẽ (30% đến 200%)
- **Kéo** khung vẽ trống → pan
- **Nhấp chuột phải** → quay lại cấp khung vẽ cha
- **Nhấp** vào hộp → vào khung vẽ con
- **Kéo** từ điểm giữa cạnh hộp → kết nối với hộp khác
- **Alt+nhấp** đường kết nối → xóa
- **Sao** trên hộp → đánh dấu là cha (các con di chuyển cùng)
- **Ghim** → khóa vị trí hộp
- **Nút hình tròn** trên cùng bên phải khung vẽ → bỏ ghim tiêu đề cho chế độ toàn màn hình

## Quyền riêng tư

- Tất cả dữ liệu được lưu trữ cục bộ trong `chrome.storage.local` — không có gì rời khỏi thiết bị của bạn trừ khi bạn cấu hình sao lưu đám mây tùy chọn
- Sao lưu WebDAV / GitHub Gist tùy chọn là sử dụng mạng ra duy nhất
- Không phân tích, không theo dõi, không dịch vụ bên thứ ba
- 100% mã nguồn mở (Apache-2.0) — kiểm toán từng dòng
- Chính sách quyền riêng tư đầy đủ: [docs/privacy-policy.md](../../docs/privacy-policy.md)

## Phát triển

### Điều kiện tiên quyết

- Node.js >= 18
- npm

### Thiết lập

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### Build

```bash
npm run build     # Build phát triển → dist/boxing-chrome + dist/boxing-firefox
npm test          # Kiểm thử Playwright (Chrome + Firefox)
```

Xem [CONTRIBUTING.md](../../CONTRIBUTING.md) để biết hướng dẫn phát triển đầy đủ.

## Đóng góp

Chào đón đóng góp! Xem [CONTRIBUTING.md](../../CONTRIBUTING.md) để biết thiết lập, quy trình và phong cách mã.

## Giấy phép

Apache-2.0 — xem [LICENSE](../../LICENSE)
