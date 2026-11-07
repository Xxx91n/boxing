<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · **한국어** · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Português (Brasil)](README.pt_BR.md) · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

계층형 무한 캔버스 북마크 관리자, 베이지 톤 미니멀 디자인.

Boxing은 브라우저의 새 탭 페이지를 시각적인 북마크 작업 공간으로 바꿉니다. 단순한 폴더 구조에서 벗어나 무한 캔버스 위에서 라벨 상자로 북마크를 정리하세요 — 드래그, 연결, 중첩을 통해 내 생각의 흐름대로 공간을 배치할 수 있습니다. 북마크를 품은 Obsidian 캔버스처럼 사용해 보세요.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Boxing 캔버스 개요" width="1280">
</picture>

## 목차

- [기능](#기능)
- [스크린샷](#스크린샷)
- [설치](#설치)
- [사용법](#사용법)
- [개인정보 보호](#개인정보-보호)
- [개발](#개발)
- [기여](#기여)
- [라이선스](#라이선스)

## 기능

**무한 캔버스** : 자유로운 화면 이동 및 확대/축소(Ctrl+스크롤). 하나의 캔버스에 무제한으로 상자 생성. 선으로 상자 간의 관계 표시. 부모-자식 관계를 설정하면 부모 상자 이동 시 자식 상자가 함께 이동.

**2단계 계층 구조** : 큰 상자 안에 작은 상자를, 작은 상자 안에 북마크를 보관. 상자를 클릭하여 하위 캔버스로 진입. 이동 경로는 브레드크럼으로 표시되며 원하는 만큼 깊이 중첩 가능.

**북마크 관리** : 상자마다 자체 북마크 모음을 가지며 목록 및 그리드 뷰 지원. 추가, 편집, 삭제가 간편. 현재 탭 또는 새 탭에서 열기 설정 가능(설정 가능). 드래그하여 순서 정렬.

**연결선** : 상자 간의 시각적인 SVG 연결선. Alt+클릭으로 연결선 삭제(설정 가능: 클릭 또는 더블클릭). 부모-자식 이동 연동 및 유연한 경계 제한 적용.

**디자인 및 테마** : 베이지/크림색의 미니멀 미학. 시스템 설정을 따르는 다크 모드. 글꼴 크기 및 확대/축소 비율 조절. 직각/둥근 모서리 전환.

**14개 언어 지원** : en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi (브라우저 언어 자동 감지).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="상자 계층 구조 및 북마크" width="1280">
</picture>

## 스크린샷

| 캔버스 | 상자 및 북마크 | 연결선 |
|---|---|---|
| ![캔버스](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![상자 및 북마크](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![연결선](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| 설정 | 북마크 편집 |
|---|---|
| ![설정](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![북마크 편집](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## 설치

> [!IMPORTANT]
> **공식 스토어 페이지를 통한 설치를 권장합니다** (추천). 정확한 설치 절차와 현재 배포된 스토어 버전은 [영문 README — Install](../../README.md#install)에서 관리됩니다.
> GitHub Releases는 **사용자용 변경 기록(체인지로그)**으로만 활용됩니다: [최신 버전](https://github.com/Xxx91n/boxing/releases/latest).

### Firefox (공식 설치)

1. [Firefox Browser ADD-ONS — Boxing New Tab](https://addons.mozilla.org/ko/firefox/addon/boxing-newtab/) 열기
2. **Add to Firefox**를 클릭하고 브라우저 안내에 따라 설치 완료

### Edge / Chromium (공식 설치)

1. [Edge 추가 기능 — Boxing](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi) 열기
2. **다운로드** / **Get**을 클릭하여 설치 완료 (Chromium 기반 브라우저는 Edge 스토어 페이지를 이용해 주세요)

### 개발자: 소스 코드에서 빌드

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm ci
npm run build
```

- Chrome/Edge: `chrome://extensions` → 개발자 모드 켜기 → **압축해제된 확장 프로그램을 로드합니다** → `dist/boxing-chrome/` 선택
- Firefox: `about:debugging#/runtime/this-firefox` → **임시 부가 기능 로드...** → `dist/boxing-firefox/manifest.json` 선택

> [!NOTE]
> 빌드 결과물인 zip 파일은 **스토어 업로드 및 로컬 디버깅용**이며, 일반 사용자 공식 설치 채널이 아닙니다. 공식 설치는 상단 스토어 링크를 이용해 주세요.
> 서명은 스토어에서 처리되며, 본 저장소의 GitHub Releases에서는 `.xpi` / `.crx`를 **더 이상 배포하지 않습니다**.

## 사용법

- 빈 캔버스 **더블 클릭** → 새 상자 만들기
- 상자 제목 표시줄 **드래그** → 상자 이동
- **Ctrl+스크롤** → 캔버스 확대/축소 (30% ~ 200%)
- 빈 캔버스 **드래그** → 평면 이동 (팬)
- **우클릭** → 상위 캔버스로 돌아가기
- 상자 **클릭** → 하위 캔버스로 들어가기
- 상자 가장자리 중앙에서 **드래그** → 다른 상자와 연결
- 연결선 **Alt+클릭** → 연결선 삭제
- 상자의 **별표** → 부모 상자로 지정 (자식 상자가 함께 이동)
- **고정 핀** → 상자 위치 고정
- 캔버스 우측 상단 **원형 버튼** → 고정 해제 및 전체 화면 모드 전환

## 개인정보 보호

[docs/privacy-policy.md](../../docs/privacy-policy.md)

## 개발

### 사전 요구사항

- Node.js 24.22.1
- npm

### 환경 설정

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### 빌드

```bash
npm run build     # 개발 빌드 → dist/boxing-chrome + dist/boxing-firefox
npm test          # Playwright 테스트 (Chrome + Firefox)
```

자세한 개발 가이드는 [CONTRIBUTING.md](../../CONTRIBUTING.md)를 참고하세요.

## 기여

기여를 환영합니다! 환경 설정, 워크플로, 코드 스타일은 [CONTRIBUTING.md](../../CONTRIBUTING.md)에서 확인하실 수 있습니다.

## 라이선스

[Apache-2.0](../../LICENSE)
