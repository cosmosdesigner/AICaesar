# AICaesar — Plano de Desenvolvimento da Fase 1

## Objetivo

Implementar a primeira base visual jogável do AICaesar: um mapa em grelha/isométrico simples, renderizado no browser com sprites temporários da Caesaria.

Esta fase ainda não implementa simulação, IA, construção completa ou regras de cidade. O objetivo é validar o pipeline visual e a base técnica sobre a qual as fases seguintes vão assentar.

## Resultado esperado

Ao correr `npm run dev`, deve abrir uma aplicação web com:

- canvas PixiJS;
- mapa 30x30;
- tiles de terreno renderizados;
- conversão grid → screen consistente;
- sprites temporários copiados de `/root/caesaria-game-inspect/resources`;
- pelo menos terreno, estrada, casa e poço disponíveis como assets locais;
- estrutura de projeto pronta para fases seguintes.

## Stack

- TypeScript
- Vite
- PixiJS

Não usar React nesta fase. Ainda não há UI complexa que justifique.

## Estrutura inicial

```text
src/
  assets/
    AssetManifest.ts
  game/
    Game.ts
  input/
  rendering/
    PixiApp.ts
    MapRenderer.ts
    GridMath.ts
  simulation/
    CityState.ts
    Tile.ts
  ui/
  main.ts
  style.css

public/
  assets/
    prototype/
      README.md
      ground/
      way/
      houses/
      well/
```

## Assets da Caesaria

Usar apenas um subset mínimo dos sprites existentes localmente:

```text
/root/caesaria-game-inspect/resources/ground
/root/caesaria-game-inspect/resources/way
/root/caesaria-game-inspect/resources/houses
/root/caesaria-game-inspect/resources/well
```

Copiar apenas alguns PNGs necessários para o protótipo, não a pasta inteira.

Criar `public/assets/prototype/README.md` com aviso:

- assets temporários;
- origem Caesaria;
- apenas para prototipagem local;
- substituir antes de qualquer release pública.

## Escopo da Fase 1

### Inclui

- inicialização Vite + TypeScript;
- instalação PixiJS;
- renderização de mapa;
- grid 30x30;
- sprites carregados do diretório `public/assets/prototype`;
- terreno base repetido;
- alguns tiles de exemplo com estrada/casa/poço para validar escala e alinhamento;
- documentação mínima no README.

### Exclui

- colocação de edifícios pelo jogador;
- dinheiro;
- simulação;
- água/comida;
- workers;
- advisor/IA;
- pathfinding;
- walkers;
- menus complexos.

## Decisões técnicas

### Renderização

Usar PixiJS diretamente.

Motivo:

- menor complexidade;
- bom para sprites 2D/isométricos;
- fácil evoluir para overlays.

### Mapa

Começar com grelha lógica 30x30.

Mesmo que o visual seja isométrico, o estado deve continuar em coordenadas `{ x, y }`.

### Conversão de coordenadas

Criar `GridMath.ts` com funções:

```ts
gridToScreen(x, y): { x: number; y: number }
screenToGrid(x, y): { x: number; y: number } | null
```

Na Fase 1, `screenToGrid` pode ser aproximado ou ficar preparado para Fase 2.

### CityState mínimo

Criar um estado simples:

```ts
type Tile = {
  x: number
  y: number
  terrain: 'grass'
  building?: 'road' | 'house' | 'well'
}
```

Na Fase 1, o estado pode ser seedado com alguns edifícios de exemplo.

## Critérios de aceitação

A Fase 1 está concluída quando:

- `npm install` funciona;
- `npm run build` passa;
- `npm run dev` mostra um mapa 30x30;
- pelo menos um sprite real da Caesaria aparece;
- existem sprites locais para ground, road, house e well;
- existe aviso de licenciamento dos assets temporários;
- o código está organizado nas pastas previstas;
- não há erros TypeScript.

## Ordem de implementação recomendada

1. Criar projeto Vite + TypeScript.
2. Instalar PixiJS.
3. Criar estrutura de pastas.
4. Copiar subset mínimo de sprites Caesaria para `public/assets/prototype`.
5. Criar aviso de assets temporários.
6. Criar `CityState` seedado.
7. Criar `GridMath`.
8. Criar `PixiApp`.
9. Criar `MapRenderer`.
10. Renderizar mapa 30x30.
11. Adicionar README com instruções.
12. Correr `npm run build`.

## Próxima fase depois desta

Fase 2: construção manual.

A Fase 2 vai adicionar:

- ferramenta selecionada;
- clique no mapa;
- colocar road/house/well;
- validação simples de tile livre;
- dinheiro inicial.
