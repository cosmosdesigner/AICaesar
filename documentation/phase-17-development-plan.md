# AICaesar — Plano de Desenvolvimento da Fase 17

## Objetivo

Transformar a cadeia de comida num sistema espacial simples e observável:

```text
Farm → Granary → Market → House
```

A Fase 5 usava `city.resources.food` como stock global. A Fase 17 deve removê-lo como fonte de verdade: comida passa a viver em granaries e markets individuais.

## Referência Caesaria

Usar apenas como inspiração:

```text
/root/caesaria-game-inspect/source/objects/market.cpp
/root/caesaria-game-inspect/source/objects/market.hpp
/root/caesaria-game-inspect/source/walker/market_buyer.cpp
/root/caesaria-game-inspect/source/good/good.cpp
/root/caesaria-game-inspect/source/good/good.hpp
```

Conceitos a adaptar:

- market tem stock próprio;
- procura é capacity - quantity;
- market procura abastecimento;
- distribuição só funciona com bens disponíveis.

Não implementar walkers, goods múltiplos ou caminho por estrada nesta fase.

## Estado atual

- farms produzem diretamente para `city.resources.food`;
- granaries apenas fornecem capacidade global;
- markets fornecem cobertura por raio se estiverem ativos;
- casas consomem do stock global;
- `storedFood` existe em granary mas não é a fonte de verdade;
- não existe stock no market.

## Escopo

### Inclui

- remover `resources.food` como fonte de verdade;
- granaries com `storedFood` real;
- markets com `storedFood` real;
- capacidade individual por granary e market;
- farms depositam comida nos granaries ativos;
- markets obtêm comida de granaries próximos;
- casas consomem do market que as serve;
- demand de market;
- stats de comida desagregados;
- analyzer distingue produção, storage e distribuição;
- painel mostra stocks relevantes;
- testes unitários;
- README atualizado.

### Exclui

- múltiplos goods;
- warehouses;
- walkers reais;
- road graph/BFS;
- farm/market transport animation;
- save/load;
- browser testing.

## Modelo de dados

### ResourceState

Remover o campo global:

```ts
interface ResourceState {
  money: number
}
```

Não manter `resources.food` como cache/alias. Isso criaria duas fontes de verdade.

### Building

Usar `storedFood` para os dois edifícios de armazenamento:

```ts
interface Building {
  // ...campos existentes
  storedFood?: number // granary e market
}
```

Inicialização:

- granary: `storedFood: 0`;
- market: `storedFood: 0`;
- outros edifícios não recebem o campo.

## Valores iniciais

```ts
GRANARY_FOOD_CAPACITY = 100
MARKET_FOOD_CAPACITY = 40
FARM_FOOD_PER_TICK = 2
MARKET_RESTOCK_PER_TICK = 4
MARKET_SUPPLY_RADIUS = 8
MARKET_FOOD_RADIUS = 4
HOUSE_FOOD_CONSUMPTION_INTERVAL = 2
```

Estes valores são deliberadamente simples e devem ficar centralizados para balanceamento futuro.

## Regras de simulação

### 1. Workers

Atribuir workers antes da cadeia de comida, como já acontece.

- farm/granary/market inativos não produzem, não recebem nem distribuem;
- inventário existente num edifício inativo permanece, mas não é utilizável até voltar a ativo.

### 2. Produção farm → granary

Em cada tick:

- cada farm ativa produz `FARM_FOOD_PER_TICK`;
- produção é depositada em granaries ativos com espaço;
- granaries são escolhidos por ordem determinística (y, x, id);
- se não existir capacidade ativa, produção é perdida;
- não há stock global.

Nesta fase, farms podem depositar em qualquer granary ativo. A Fase 19 troca esta simplificação por road graph/distance.

### 3. Market demand e resupply

Market demand:

```ts
demand = max(0, MARKET_FOOD_CAPACITY - market.storedFood)
```

Em cada tick, cada market ativa:

- procura granaries ativos dentro de `MARKET_SUPPLY_RADIUS` Manhattan;
- granaries são ordenados por distância Manhattan, depois y/x/id;
- transfere no máximo `MARKET_RESTOCK_PER_TICK` e nunca excede demand, stock de granary ou capacidade de market;
- se não existir granary elegível/stock, market mantém stock atual.

A Fase 19 substitui raio direto por distância na rede de estradas.

### 4. Market → house

Uma casa recebe comida quando:

- está dentro de `MARKET_FOOD_RADIUS` de um market ativo;
- esse market tem `storedFood > 0`.

A cada 2 ticks:

- casas são processadas por ordem y/x/id;
- cada casa procura market válido por distância, y/x/id;
- consome 1 unidade do stock desse market;
- se nenhum market tiver stock, `hasFood = false`.

Em ticks sem consumo, `hasFood` representa disponibilidade imediata de um market válido com stock.

## Ordem de tick

Em `simulateTick(city)`:

1. incrementar tick;
2. atribuir workers;
3. farm → granary;
4. granary → market;
5. calcular serviços e market → house;
6. atualizar evolução/degradação de casas;
7. reatribuir workers;
8. aplicar finanças quando aplicável.

## API sugerida

Manter em `Simulation.ts` se for legível; criar `FoodLogistics.ts` apenas se a separação reduzir complexidade de forma clara.

Funções sugeridas:

```ts
getGranaryFoodCapacity(city)
getGranaryStoredFood(city)
getMarketStoredFood(city)
getMarketFoodDemand(market)
getFoodStats(city)
getMarketSupplyCandidates(city, market)
```

`FoodStats` deve incluir pelo menos:

```ts
interface FoodStats {
  farms: number
  granaries: number
  markets: number
  granaryFood: number
  granaryCapacity: number
  marketFood: number
  marketCapacity: number
  foodStored: number
  foodCapacity: number
  suppliedMarkets: number
  foodCoveredTiles: number
  housesWithFood: number
}
```

## UI

Atualizar o painel de comida para mostrar, no mínimo:

```text
Granary stock: 24/100
Market stock: 8/40
Market demand: 32
Supplied markets: 1/1
```

Manter o overlay de comida:

- só mostra tiles servidos por markets ativos com stock;
- market ativo sem stock não dá cobertura real;
- isto torna falha de distribuição visível.

## Analyzer

Manter tipos existentes, mas tornar causas específicas:

### Food production shortage

- houses precisam de comida;
- não há farms ativas ou granary stock não aumenta.

### Food storage shortage

Não é necessário criar um `CityIssueType` novo se complicar UI. Pode ser explicado dentro de `food_production_shortage` quando não há granary/capacidade ativa.

### Food distribution shortage

- granaries têm comida;
- markets ativos não têm stock ou não estão ao alcance de granary;
- casas continuam sem comida.

O objetivo é que advisor consiga distinguir:

```text
No production → build/activate farm
No storage → build/activate granary
No market stock/reach → build/relocate market
```

## Cenário e advisor

- `Scenario` usa `housesWithFood` e não depende de `resources.food`;
- atualizar fixtures/tests ao remover `resources.food`;
- advisor continua a usar analyzer, sem novas ações nesta fase;
- after-action snapshots passam a obter food totals via `getFoodStats`.

## Testes obrigatórios

Seguir TDD: escrever e correr testes falhados antes de código de produção.

Testes mínimos:

1. farm ativa deposita produção em granary ativo;
2. farm não produz para granary inativo/cheio;
3. market demanda é capacity - storedFood;
4. market transfere comida de granary próximo até ao limite por tick;
5. market fora de supply radius não recebe comida;
6. house servida consome comida do stock do market, não do granary;
7. market sem stock não fornece cobertura/comida;
8. stock total é soma de granary + market;
9. `resources.food` deixa de existir;
10. analyzer identifica produção/distribuição em cenários relevantes;
11. reset cria stocks a zero;
12. cenário, finanças e after-action report continuam a passar.

## Critérios de aceitação

A Fase 17 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- não existe stock global de comida;
- granaries e markets têm stock real;
- farms produzem para granaries;
- markets têm procura e fazem resupply simplificado;
- casas consomem de markets;
- market sem stock não cobre casas;
- painel mostra stocks/demand;
- analyzer distingue falhas na cadeia;
- cenário/advisor/finanças não regressam;
- README é atualizado;
- não é feito browser testing.

## Decisões para evitar overengineering

- sem walkers;
- sem road graph;
- sem múltiplos goods;
- sem warehouse;
- sem animações;
- sem stock global duplicado;
- sem browser testing.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 17 com TDD;
2. preservar economia, cenário, câmara, advisor e executor;
3. manter fluxos de comida determinísticos e fáceis de testar;
4. correr `npm run build` e `npm test`;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados e evidência de verificação.
