# AICaesar — Plano de Desenvolvimento da Fase 3

## Objetivo

Consolidar o estado da cidade como fonte única de verdade.

A Fase 2 permitiu construir diretamente sobre `Tile.building`. A Fase 3 deve separar melhor:

- tiles/terreno;
- edifícios;
- recursos;
- operações de estado.

O objetivo não é adicionar novas mecânicas visíveis. O objetivo é preparar a base para água, comida, workers e advisor sem acumular dívida técnica.

## Estado atual

Hoje o estado é simples:

```ts
Tile {
  x
  y
  terrain
  building?: BuildingType
}

CityState {
  width
  height
  tiles
  money
}
```

A construção atual chama `build(city, x, y, tool)` e escreve diretamente `tile.building = tool`.

Isto funcionou para a Fase 2, mas vai limitar a Fase 4 porque edifícios vão precisar de mais dados:

- ID;
- tipo;
- posição;
- estado operacional;
- workers necessários;
- produção/consumo;
- serviços emitidos.

## Resultado esperado

No final da Fase 3:

- `CityState` contém tiles, buildings e resources;
- `Tile` deixa de guardar o tipo do edifício diretamente e passa a guardar `buildingId?`;
- existe tipo `Building`;
- existe tipo `ResourceState`;
- existe função `placeBuilding`;
- reset recria cidade e recursos iniciais;
- renderização continua derivada do `CityState`;
- UI da Fase 2 continua a funcionar.

## Escopo da Fase 3

### Inclui

- introduzir `Building`;
- introduzir `ResourceState`;
- substituir `build` por `placeBuilding` ou adaptar mantendo wrapper;
- migrar `Tile.building` para `Tile.buildingId`;
- atualizar `MapRenderer` para renderizar edifícios a partir de `city.buildings`;
- atualizar `BuildPanel` para ler custos do modelo novo;
- manter construção manual da Fase 2;
- atualizar README.

### Exclui

- água;
- comida;
- workers reais;
- evolução de casas;
- advisor;
- overlays;
- pathfinding;
- walkers.

## Modelo proposto

### BuildingType

Mantém-se por agora:

```ts
type BuildingType = 'road' | 'house' | 'well'
```

### Tile

```ts
type Tile = {
  x: number
  y: number
  terrain: 'grass'
  buildingId?: string
}
```

### Building

```ts
type Building = {
  id: string
  type: BuildingType
  x: number
  y: number
}
```

### ResourceState

```ts
type ResourceState = {
  money: number
}
```

### CityState

```ts
type CityState = {
  width: number
  height: number
  tiles: Tile[]
  buildings: Building[]
  resources: ResourceState
}
```

## Operações do estado

Criar ou manter funções puras/pragmáticas:

```ts
createCityState(): CityState
getTile(city, x, y): Tile | undefined
getBuildingAt(city, x, y): Building | undefined
placeBuilding(city, x, y, type): BuildResult
reset/createCityState para reset
```

`placeBuilding` deve:

1. validar limites;
2. obter tile;
3. validar `buildingId` vazio;
4. validar dinheiro suficiente;
5. criar `Building` com ID estável/simples;
6. associar `tile.buildingId = building.id`;
7. subtrair custo de `city.resources.money`;
8. devolver resultado.

## IDs

Não usar `crypto.randomUUID` nesta fase.

Preferir ID determinístico simples:

```ts
`${type}-${x}-${y}`
```

Motivo:

- mais fácil de depurar;
- suficiente enquanto edifícios ocupam 1 tile;
- facilita testes futuros.

## Compatibilidade com Fase 2

A UI deve continuar igual para o jogador:

- botões Road / House / Well;
- dinheiro visível;
- reset;
- mensagens de erro.

A diferença é interna:

- dinheiro passa de `city.money` para `city.resources.money`;
- tile ocupado passa a ser `tile.buildingId !== undefined`;
- renderer encontra edifício via `city.buildings`.

## Renderização

`MapRenderer.refresh(city)` deve:

1. renderizar terrain a partir de `city.tiles`;
2. ordenar `city.buildings` por `(x + y)`;
3. renderizar cada building usando `building.type` e posição.

Não voltar a duplicar o tipo do edifício no tile.

## Critérios de aceitação

A Fase 3 está concluída quando:

- `npm run build` passa;
- construção manual da Fase 2 continua funcional;
- reset continua funcional;
- `CityState` tem `resources`;
- `CityState` tem `buildings`;
- `Tile` usa `buildingId?`, não `building?`;
- renderer usa `city.buildings` para edifícios;
- não existe estado de edifício duplicado em tile + building;
- README menciona a refatoração de estado da Fase 3.

## Testes manuais mínimos

Não é necessário browser testing nesta fase, salvo pedido explícito.

Verificação mínima por comandos:

```sh
npm run build
git status --short
```

Opcionalmente, OMP pode rever o código para confirmar que não resta `tile.building`.

## Riscos

### Risco: refactor maior do que necessário

Mitigação:

- não introduzir classes complexas;
- manter funções simples;
- não implementar sistemas futuros antes do tempo.

### Risco: quebrar construção manual

Mitigação:

- manter `BuildResult` e mensagens da Fase 2;
- atualizar apenas os acessos a dinheiro e edifícios.

### Risco: abstração prematura

Mitigação:

- `ResourceState` só tem `money` por agora;
- `Building` só tem id, type, x, y;
- expandir apenas nas fases seguintes.

## Entrega esperada do OMP

O OMP deve:

1. implementar o refactor;
2. manter a UI existente;
3. correr `npm run build`;
4. devolver resumo de ficheiros alterados;
5. não fazer browser testing.
