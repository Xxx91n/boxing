<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · **Tiếng Việt** — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

Trình quản lý dấu trang phân cấp trên canvas vô cực, thiết kế tối giản màu be.

Boxing biến trang tab mới của trình duyệt thành không gian làm việc trực quan cho các dấu trang. Không còn các thư mục phẳng: sắp xếp dấu trang vào các hộp có nhãn trên canvas vô cực — kéo thả, kết nối và lồng ghép linh hoạt theo tư duy của bạn. Tương tự như một canvas của Obsidian dành riêng cho việc quản lý dấu trang.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Tổng quan canvas Boxing" width="1280">
</picture>

## Mục lục

- [Tính năng](#tính-năng)
- [Ảnh chụp màn hình](#ảnh-chụp-màn-hình)
- [Cài đặt](#cài-đặt)
- [Cách sử dụng](#cách-sử-dụng)
- [Quyền riêng tư](#quyền-riêng-tư)
- [Phát triển](#phát-triển)
- [Đóng góp](#đóng-góp)
- [Giấy phép](#giấy-phép)

## Tính năng

**Canvas vô cực** : Tự do di chuyển và thu phóng (Ctrl+cuộn chuột). Tạo không giới hạn các hộp trên một canvas duy nhất. Thể hiện mối quan hệ giữa các hộp bằng đường nối trực quan. Thiết lập quan hệ cha-con — khi di chuyển hộp cha, các hộp con sẽ di chuyển theo.

**Phân cấp hai cấp độ** : Hộp lớn chứa các hộp nhỏ, hộp nhỏ chứa các dấu trang. Nhấp vào hộp để mở canvas con. Thanh điều hướng đường dẫn (breadcrumbs) hiển thị vị trí hiện tại. Hỗ trợ lồng ghép với bất kỳ độ sâu nào.

**Quản lý dấu trang** : Mỗi hộp sở hữu bộ sưu tập dấu trang riêng, hỗ trợ chế độ xem danh sách và lưới. Thêm, sửa, xóa nhanh chóng và gọn gàng. Tùy chọn mở liên kết trong tab hiện tại hoặc tab mới (có thể cấu hình). Kéo thả để sắp xếp lại.

**Đường nối** : Đường nối SVG trực quan giữa các hộp. Alt+nhấp vào đường nối để xóa (có thể cấu hình: nhấp một lần hoặc nhấp đúp). Truyền chuyển động từ cha sang con với ràng buộc ranh giới đàn hồi.

**Thiết kế và chủ đề** : Phong cách tối giản màu be / kem. Chế độ tối tự động đồng bộ theo hệ thống. Điều chỉnh kích thước phông chữ và tỷ lệ thu phóng. Chuyển đổi giữa góc vuông và góc bo tròn.

**14 ngôn ngữ** : en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi (tự động nhận diện ngôn ngữ trình duyệt).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="Phân cấp hộp và dấu trang" width="1280">
</picture>

## Ảnh chụp màn hình

| Canvas | Hộp và dấu trang | Đường nối |
|---|---|---|
| ![Canvas](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![Hộp và dấu trang](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![Đường nối](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| Cài đặt | Chỉnh sửa dấu trang |
|---|---|
| ![Cài đặt](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![Chỉnh sửa dấu trang](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## Cài đặt

> [!IMPORTANT]
> **Khuyến nghị cài đặt qua các trang cửa hàng chính thức** (khuyến nghị). Các bước cài đặt chuẩn và phiên bản cửa hàng đã phát hành hiện tại được duy trì trong [README tiếng Anh — Install](../../README.md#install).
> GitHub Releases chỉ đóng vai trò là **nhật ký thay đổi dành cho người dùng**: [Phiên bản mới nhất](https://github.com/Xxx91n/boxing/releases/latest).

### Firefox (cài đặt chính thức)

1. Mở [Firefox Browser ADD-ONS — Boxing New Tab](https://addons.mozilla.org/vi/firefox/addon/boxing-newtab/)
2. Nhấp vào **Add to Firefox** và làm theo hướng dẫn của trình duyệt để hoàn tất cài đặt

### Edge / Chromium (cài đặt chính thức)

1. Mở [Edge Add-ons — Boxing](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi)
2. Nhấp vào **Nhận** / **Get** để hoàn tất cài đặt (với các trình duyệt gốc Chromium, vui lòng sử dụng trang cửa hàng Edge)

### Dành cho nhà phát triển: Xây dựng từ mã nguồn

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm ci
npm run build
```

- Chrome/Edge: `chrome://extensions` → Bật chế độ nhà phát triển → **Tải tiện ích đã giải nén** → chọn `dist/boxing-chrome/`
- Firefox: `about:debugging#/runtime/this-firefox` → **Tải tiện ích bổ sung tạm thời...** → chọn `dist/boxing-firefox/manifest.json`

> [!NOTE]
> Tệp zip sau khi build dùng cho việc **tải lên cửa hàng hoặc gỡ lỗi cục bộ**, không phải là kênh cài đặt chính thức cho người dùng cuối. Vui lòng sử dụng các liên kết cửa hàng ở trên để cài đặt thông thường.
> Chữ ký số được thực hiện bởi cửa hàng; kho lưu trữ GitHub này **không còn** phân phối các tệp `.xpi` / `.crx` trong phần Releases.

## Cách sử dụng

- **Nhấp đúp** vào vùng trống canvas → Tạo hộp mới
- **Kéo** thanh tiêu đề của hộp → Di chuyển hộp
- **Ctrl+cuộn chuột** → Thu phóng canvas (30% đến 200%)
- **Kéo** vùng trống canvas → Di chuyển góc nhìn (pan)
- **Nhấp chuột phải** → Quay lại canvas cha
- **Nhấp** vào hộp → Vào canvas con
- **Kéo** từ điểm giữa cạnh hộp → Nối với hộp khác
- **Alt+nhấp** vào đường nối → Xóa đường nối
- Biểu tượng **ngôi sao** trên hộp → Đặt làm hộp cha (các hộp con sẽ di chuyển theo)
- Biểu tượng **ghim** → Khóa vị trí của hộp
- **Nút tròn** ở góc trên bên phải canvas → Bỏ ghim và chuyển sang chế độ toàn màn hình

## Quyền riêng tư

[docs/privacy-policy.md](../../docs/privacy-policy.md)

## Phát triển

### Yêu cầu trước khi bắt đầu

- Node.js 24.22.1
- npm

### Cài đặt môi trường

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### Xây dựng (Build)

```bash
npm run build     # Bản dựng phát triển → dist/boxing-chrome + dist/boxing-firefox
npm test          # Kiểm thử Playwright (Chrome + Firefox)
```

Xem [CONTRIBUTING.md](../../CONTRIBUTING.md) để biết hướng dẫn phát triển đầy đủ.

## Đóng góp

Rất hoan nghênh các đóng góp! Xem [CONTRIBUTING.md](../../CONTRIBUTING.md) để biết chi tiết về thiết lập môi trường, quy trình làm việc và phong cách viết mã.

## Giấy phép

[Apache-2.0](../../LICENSE)
