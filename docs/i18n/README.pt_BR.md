<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · **Português (Brasil)** · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

Gerenciador hierárquico de favoritos em tela infinita, com design minimalista bege.

O Boxing transforma a página de nova guia do seu navegador em um espaço de trabalho visual para seus favoritos. Em vez de pastas planas tradicionais, organize seus favoritos em caixas identificadas em uma tela infinita — arraste, conecte e aninhe de acordo com seu fluxo de pensamento. Pense nisso como a tela do Obsidian aplicada aos seus favoritos.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Visão geral da tela do Boxing" width="1280">
</picture>

## Sumário

- [Recursos](#recursos)
- [Capturas de tela](#capturas-de-tela)
- [Instalação](#instalação)
- [Como usar](#como-usar)
- [Privacidade](#privacidade)
- [Desenvolvimento](#desenvolvimento)
- [Contribuição](#contribuição)
- [Licença](#licença)

## Recursos

**Tela infinita** : Movimentação panorâmica e zoom livres (Ctrl+rolagem). Crie quantas caixas precisar em uma única tela. Exiba relações entre caixas usando linhas de conexão. Defina relações pai-filho — as caixas filhas acompanham automaticamente o movimento da caixa pai.

**Hierarquia de dois níveis** : Caixas grandes contêm caixas pequenas, e caixas pequenas contêm favoritos. Clique em uma caixa para acessar sua subtela. A navegação estrutural (breadcrumbs) mostra o caminho percorrido. Aninhamento em qualquer nível de profundidade.

**Gerenciamento de favoritos** : Cada caixa mantém sua própria coleção de favoritos com visualização em lista ou grade. Adicione, edite e exclua com facilidade. Abra links na guia atual ou em uma nova guia (configurável). Reordenação por arrastar e soltar.

**Linhas de conexão** : Conexões SVG visuais entre as caixas. Alt+clique em uma linha para removê-la (configurável: clique simples ou duplo). Movimentação sincronizada de pai para filhos com limites elásticos.

**Design e temas** : Estética minimalista em tons de bege e creme. Modo escuro com acompanhamento automático do sistema. Tamanho de fonte e zoom ajustáveis. Alternância entre cantos retos e arredondados.

**14 idiomas** : en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi (detecção automática pelo idioma do navegador).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="Hierarquia de caixas e favoritos" width="1280">
</picture>

## Capturas de tela

| Tela | Caixas e favoritos | Linhas de conexão |
|---|---|---|
| ![Tela](../../docs/store-assets/screenshots/screenshot-1-canvas.png) | ![Caixas e favoritos](../../docs/store-assets/screenshots/screenshot-2-boxes.png) | ![Linhas de conexão](../../docs/store-assets/screenshots/screenshot-3-connections.png) |

| Configurações | Edição de favoritos |
|---|---|
| ![Configurações](../../docs/store-assets/screenshots/screenshot-4-settings.png) | ![Edição de favoritos](../../docs/store-assets/screenshots/screenshot-5-bookmarks.png) |

## Instalação

> [!IMPORTANT]
> **Recomendamos a instalação pelas páginas oficiais das lojas** (recomendado). As etapas oficiais e as versões atualmente publicadas são mantidas no [README em inglês — Install](../../README.md#install).
> Os lançamentos do GitHub Releases servem exclusivamente como **registro de alterações para usuários**: [Última versão](https://github.com/Xxx91n/boxing/releases/latest).

### Firefox (instalação oficial)

1. Acesse [Firefox Browser ADD-ONS — Boxing New Tab](https://addons.mozilla.org/pt-BR/firefox/addon/boxing-newtab/)
2. Clique em **Add to Firefox** e siga as instruções do navegador para concluir a instalação

### Edge / Chromium (instalação oficial)

1. Acesse [Edge Add-ons — Boxing](https://microsoftedge.microsoft.com/addons/detail/inkgieheaiifkkdmlpggihjplkkgpepi)
2. Clique em **Obter** / **Get** para concluir a instalação (navegadores baseados em Chromium devem usar a página do Edge)

### Desenvolvedores: compilação a partir do código-fonte

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm ci
npm run build
```

- Chrome/Edge: `chrome://extensions` → Modo do desenvolvedor → **Carregar sem compactação** → selecione `dist/boxing-chrome/`
- Firefox: `about:debugging#/runtime/this-firefox` → **Carregar extensão temporária...** → selecione `dist/boxing-firefox/manifest.json`

> [!NOTE]
> Os pacotes zip gerados destinam-se ao **envio para as lojas ou depuração local**, não como canal de instalação para usuários finais. Para uso regular, utilize os links das lojas acima.
> A assinatura digital é feita pelas lojas; este repositório **não distribui mais** arquivos `.xpi` / `.crx` no GitHub Releases.

## Como usar

- **Clique duplo** na tela vazia → Criar nova caixa
- **Arrastar** a barra de título da caixa → Mover a caixa
- **Ctrl+rolagem** → Zoom na tela (de 30% a 200%)
- **Arrastar** na tela vazia → Movimento panorâmico (pan)
- **Botão direito** → Voltar à tela pai
- **Clicar** na caixa → Entrar na subtela
- **Arrastar** a partir do ponto médio da borda da caixa → Conectar a outra caixa
- **Alt+clique** na linha de conexão → Excluir linha de conexão
- **Estrela** na caixa → Marcar como caixa pai (caixas filhas se movem junto)
- **Alfinete / Pin** → Fixar posição da caixa
- **Botão circular** no canto superior direito da tela → Desafixar e entrar no modo tela cheia

## Privacidade

[docs/privacy-policy.md](../../docs/privacy-policy.md)

## Desenvolvimento

### Pré-requisitos

- Node.js 24.22.1
- npm

### Configuração

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### Compilação

```bash
npm run build     # Compilação de desenvolvimento → dist/boxing-chrome + dist/boxing-firefox
npm test          # Testes Playwright (Chrome + Firefox)
```

Consulte [CONTRIBUTING.md](../../CONTRIBUTING.md) para obter o guia completo de desenvolvimento.

## Contribuição

Contribuições são muito bem-vindas! Consulte [CONTRIBUTING.md](../../CONTRIBUTING.md) para saber mais sobre configuração do ambiente, fluxo de trabalho e estilo de código.

## Licença

[Apache-2.0](../../LICENSE)
