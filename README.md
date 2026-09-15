# AICaesar

**Fase 3 — estado consolidado da cidade**: mapa isométrico 30×30, construção manual e modelo separado de tiles, edifícios e recursos, em TypeScript + Vite + PixiJS, sem React.

## Executar localmente

Requer Node.js 20.19+ na linha 20, ou Node.js 22.12+ (recomendado: uma versão LTS compatível), e npm.

```sh
npm install
npm run dev
```

Abrir o endereço local apresentado pelo Vite (normalmente `http://localhost:5173`). O browser precisa de WebGL. Todos os sprites são locais; não há chamadas a serviços externos na aplicação. A instalação de dependências requer acesso ao registry npm.

```sh
npm run build
npm run preview
```

`build` verifica TypeScript em modo estrito e gera `dist/`; `preview` serve esse build localmente. `node_modules/` e `dist/` estão ignorados pelo Git. **O build é apenas para validação local: inclui os assets temporários e não deve ser publicado.**

## O que aparece

- 900 tiles de relva numa grelha lógica 30×30.
- Uma estrada de 16 tiles, seis casas e um poço, seedados de forma determinística.
- Sprites reais da Caesaria, alinhados pela base do tile e ordenados de trás para a frente.
- Enquadramento automático de todo o mapa ao abrir ou redimensionar a janela.

## Construção manual

- Dinheiro inicial: **500** em `resources.money`, além da cidade seedada (os edifícios iniciais não são cobrados).
- Selecionar **Road (4)**, **House (20)** ou **Well (35)** no painel; Road começa selecionada.
- Clicar com o botão principal num tile vazio para construir. O dinheiro diminui pelo custo indicado.
- Cada construção cria um `Building { id, type, x, y }`; o tile guarda apenas `buildingId`.
- O painel mostra dinheiro, ferramenta selecionada e feedback da última ação.
- Tiles ocupados, coordenadas fora do mapa e dinheiro insuficiente são rejeitados sem alterar cidade ou saldo.
- **Reset** recria `CityState`, restaurando tiles, `buildings[]`, `resources.money` e os edifícios iniciais; mantém a ferramenta selecionada.

O mapa completo é redesenhado após construção válida ou reset; também é enquadrado ao redimensionar. Não há loop de simulação, pan/zoom, demolição, água/comida/workers, farms/granaries/markets, walkers/pathfinding, backend ou advisor/IA.

Verificação manual: construir Road num tile vazio (saldo 496), selecionar House e clicar no mesmo tile (erro, saldo 496), construir House noutro tile (476) e Well noutro (441). Clicar fora do mapa não deve gastar dinheiro. Após Reset, construir 14 Wells em tiles vazios deixa saldo 10; mais um Well deve ser rejeitado sem ocupar o tile. Reset deve restaurar os edifícios iniciais e saldo 500.

## Estrutura

```text
src/
  assets/AssetManifest.ts    URLs locais e carregamento das quatro texturas
  game/Game.ts              Input PixiJS, construção, reset, resize e libertação
  rendering/PixiApp.ts       Canvas PixiJS
  rendering/MapRenderer.ts   Camadas, profundidade, refresh e enquadramento
  rendering/GridMath.ts      Conversão isométrica nos dois sentidos
  simulation/CityState.ts    Estado, seed, buildings[], resources, custos e validação de construção
  simulation/Tile.ts         Coordenadas, terreno e referência buildingId opcional
  ui/BuildPanel.ts           Painel HTML: ferramentas, custos, dinheiro, feedback e reset
  main.ts                   Arranque e mensagem de erro de carregamento
  style.css                 Layout da página
public/assets/prototype/    Apenas quatro PNGs e aviso de licenciamento
```

`gridToScreen` devolve o centro do losango em coordenadas locais do mapa, usando tiles de 120×60. `screenToGrid` recebe essas mesmas coordenadas locais, devolve o tile mais próximo e retorna `null` para valores não finitos. O input usa `map.toLocal(event.global)` antes da conversão; `placeBuilding` em `CityState` valida coordenadas inteiras e limites, ocupação por `buildingId` e saldo em `resources.money` antes de qualquer mutação. `INITIAL_MONEY` e `BUILD_COSTS` nesse ficheiro configuram a economia. O renderer deriva terreno de `city.tiles` e edifícios de `city.buildings`; refresh destrói os objetos visuais antigos sem destruir as texturas partilhadas.

## Assets e documentação

**Sprites temporários, apenas para prototipagem local. Direitos de redistribuição não verificados. Substituir antes de qualquer release pública.** Proveniência e seleção exata: [aviso dos assets](public/assets/prototype/README.md).

A relva vem de `land1a/`; a estrada usa pavimento de `ground/`, pois `way/` na fonte contém indicadores de percurso. Só os quatro PNGs usados foram copiados, sem modificar os originais.

- [Plano da Fase 1](documentation/phase-1-development-plan.md)
- [Plano da Fase 2](documentation/phase-2-development-plan.md)
- [Plano da Fase 3](documentation/phase-3-development-plan.md)
- [MVP](documentation/mvp.md)
- [Fases de implementação](documentation/implementation-phases.md)
- [Notas de referência Caesaria](documentation/caesaria-reference.md)
