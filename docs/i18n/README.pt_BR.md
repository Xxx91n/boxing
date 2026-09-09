<!-- README-I18N:START -->
**Languages:** [English](../../README.md) · [简体中文](README.zh_CN.md) · [繁體中文](README.zh_TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · **Português (Brasil)** · [Русский](README.ru.md) · [العربية](README.ar.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [Tiếng Việt](README.vi.md) — see [TRANSLATIONS.md](../../TRANSLATIONS.md)
<!-- README-I18N:END -->

# Boxing

Organizador de marcadores hierarquico em tela infinita, com design minimalista bege.

Boxing transforma sua pagina de nova aba em um espaco de trabalho visual para marcadores. Em vez de pastas planas, organize seus marcadores em caixas etiquetadas em uma tela infinita — arraste, conecte e aninhe-os espacialmente. Pense no canvas do Obsidian encontrando os marcadores.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-1-canvas.png">
  <img src="../../docs/store-assets/screenshots/screenshot-1-canvas.png" alt="Visao geral da tela do Boxing" width="1280">
</picture>

## Sumario

- [Recursos](#recursos)
- [Instalacao](#instalacao)
- [Uso](#uso)
- [Privacidade](#privacidade)
- [Desenvolvimento](#desenvolvimento)
- [Contribuir](#contribuir)
- [Licenca](#licenca)

## Recursos

**Tela infinita** — Pan e zoom livres (Ctrl+rolagem). Crie caixas ilimitadas em uma unica tela. Conecte caixas com linhas para mostrar relacionamentos. Defina relacionamentos pai-filho — mova um pai e seus filhos o seguem.

**Hierarquia de dois niveis** — Caixas grandes contem caixas pequenas, caixas pequenas contem marcadores. Clique em uma caixa para entrar em sua sub-tela. Navegacao por trilha mostra seu caminho. Aninhe tao profundamente quanto necessario.

**Gerenciamento de marcadores** — Cada caixa tem sua propria colecao de marcadores com visualizacoes de lista e grade. Adicionar, editar, excluir com um dialogo limpo. Abrir na aba atual ou nova aba (configuravel). Arrastar para reordenar.

**Conectividade** — Linhas de conexao SVG visuais entre caixas. Alt+Clique em uma linha para exclui-la (configuravel: clique simples ou duplo clique). Propagacao de movimento pai-filho com fixacao de limites elastica.

**Design e tema** — Estetica minimalista bege/creme. Modo claro e escuro com deteccao automatica do sistema. Tamanho de fonte e zoom ajustaveis. Alternancia de cantos quadrados/arredondados.

**14 idiomas** — en, zh_CN, zh_TW, ja, ko, fr, de, es, pt_BR, ru, ar, hi, th, vi com deteccao automatica do idioma do navegador.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../docs/store-assets/screenshots/screenshot-2-boxes.png">
  <img src="../../docs/store-assets/screenshots/screenshot-2-boxes.png" alt="Hierarquia de caixas e marcadores" width="1280">
</picture>

## Instalacao

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
## Uso

- **Duplo clique** na tela vazia → criar nova caixa
- **Arrastar** barra de titulo da caixa → mover caixa
- **Ctrl+rolagem** → zoom da tela (30% a 200%)
- **Arrastar** tela vazia → pan
- **Clique direito** → voltar ao nivel de tela pai
- **Clique** em uma caixa → entrar em sua sub-tela
- **Arrastar** do ponto medio da borda da caixa → conectar a outra caixa
- **Alt+Clique** na linha de conexao → exclui-la
- **Estrela** em uma caixa → marcar como pai (filhos se movem juntos)
- **Alfinete** → bloquear posicao da caixa
- **Botao circular** no canto superior direito da tela → soltar cabecalho para modo tela cheia

## Privacidade

- Todos os dados armazenados localmente em `chrome.storage.local` — nada sai do seu dispositivo a menos que voce configure o backup em nuvem opcional
- O backup opcional WebDAV / GitHub Gist e o unico uso de rede de saida
- Sem analises, sem rastreamento, sem servicos de terceiros
- 100% codigo aberto (Apache-2.0) — audite cada linha
- Politica de privacidade completa: [docs/privacy-policy.md](../../docs/privacy-policy.md)

## Desenvolvimento

### Pre-requisitos

- Node.js >= 18
- npm

### Configuracao

```bash
git clone https://github.com/Xxx91n/boxing.git
cd boxing
npm install
npx playwright install firefox chromium
npm run build
```

### Build

```bash
npm run build     # Build de desenvolvimento → dist/boxing-chrome + dist/boxing-firefox
npm test          # Testes Playwright (Chrome + Firefox)
```

Veja [CONTRIBUTING.md](../../CONTRIBUTING.md) para o guia de desenvolvimento completo.

## Contribuir

Contribuicoes sao bem-vindas! Veja [CONTRIBUTING.md](../../CONTRIBUTING.md) para configuracao, fluxo de trabalho e estilo de codigo.

## Licenca

Apache-2.0 — veja [LICENSE](../../LICENSE)
