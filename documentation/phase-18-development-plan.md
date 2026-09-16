# AICaesar — Plano de Desenvolvimento da Fase 18

## Objetivo

Substituir população estática derivada do nível da casa por população atual que cresce e diminui ao longo do tempo.

O resultado esperado é simples, mas importante:

```text
Construir house ≠ ganhar workers imediatamente
House com road + water + food → atrai habitantes
House sem serviços → perde habitantes
Habitantes → workers + impostos + progresso de cenário
```

## Estado atual

- `HouseSpecification` define capacidade por nível: 4, 8, 14;
- `getPopulation()` soma a capacidade de todas as casas;
- casas novas dão população imediatamente;
- workers são `floor(population * 0.5)`;
- impostos dependem apenas do nível da casa;
- cenário usa população e worker shortage;
- casas podem evoluir/degradar conforme serviços.

## Escopo

### Inclui

- população atual por casa;
- capacidade da spec como limite, não população automática;
- imigração em casas servidas;
- emigração lenta em casas sem serviços;
- workforce derivada de população atual;
- impostos proporcionais à ocupação;
- stats de população/capacidade/crescimento;
- UI para crescimento líquido;
- cenário e advisor passam a usar população real;
- testes unitários;
- README atualizado.

### Exclui

- cidadãos individuais;
- walkers de emigrantes;
- commute;
- nascimento/morte;
- múltiplas classes sociais;
- happiness;
- imigração por mapa/mundo externo;
- desirability;
- browser testing.

## Modelo de dados

### Building

Adicionar campos apenas às casas:

```ts
interface Building {
  // campos existentes
  population?: number
}
```

Regras:

- `population` é inteiro >= 0;
- capacidade vem sempre de `getHouseSpecification(level).populationCapacity`;
- não guardar capacidade no Building;
- outros edifícios não têm `population`.

### SimulationState

Adicionar feedback de crescimento do último tick:

```ts
interface PopulationState {
  lastChange: number
}

interface SimulationState {
  tick: number
  finance: FinanceState
  population: PopulationState
}
```

`lastChange` é resetado a 0 ao recriar a cidade e atualizado em cada tick.

## Seed e construção

### Cidade seedada

A cidade inicial deve continuar jogável imediatamente:

- casas seedadas começam com população igual à sua capacidade de nível 1;
- isto preserva workers suficientes para os workplaces iniciais.

### Casas construídas pelo jogador

- começam com `population: 0`;
- não resolvem worker shortage instantaneamente;
- precisam de receber serviços antes de crescerem.

Implementação sugerida:

- `createCityState()` pode passar população inicial explícita ao criar seed buildings;
- `placeBuilding()` mantém população 0 para houses novas;
- não duplicar lógica de capacidades fora da HouseSpecification.

## Regras de imigração/emigração

Valores iniciais:

```ts
POPULATION_GROWTH_INTERVAL_TICKS = 3
POPULATION_DECLINE_INTERVAL_TICKS = 5
```

### Serviços para crescer

Uma casa cresce quando tem simultaneamente:

```text
road + water + food
```

No tick de crescimento:

```ts
population = min(capacity, population + 1)
```

### Serviços em falta

Uma casa perde população se faltar road, water ou food.

No tick de declínio:

```ts
population = max(0, population - 1)
```

A perda é mais lenta que o crescimento para evitar colapso instantâneo e permitir reação do jogador.

### Casa já cheia

- não cresce acima da capacidade;
- ainda pode evoluir e ganhar nova capacidade;
- quando o nível sobe, passa a poder receber mais habitantes;
- quando o nível desce, população é limitada à nova capacidade imediatamente:

```ts
population = min(population, newCapacity)
```

## Ordem de tick

Manter a simulação determinística:

1. incrementar tick;
2. atribuir workers com população atual;
3. produção e logística de comida;
4. calcular serviços das casas;
5. atualizar nível/evolução/degradação de casas;
6. limitar população após possível descida de nível;
7. aplicar imigração/emigração conforme serviços e intervalos;
8. atualizar `simulation.population.lastChange`;
9. reatribuir workers usando população alterada;
10. aplicar finanças quando aplicável.

Isto significa que trabalhadores entram no sistema no mesmo tick em que os habitantes chegam.

## População e workforce

Atualizar:

```ts
getPopulation(city)
```

Para somar `building.population` das houses, nunca capacidade.

Atualizar `getWorkforceStats(city)` automaticamente, pois já depende de `getPopulation`.

Criar stats:

```ts
interface PopulationStats {
  readonly population: number
  readonly capacity: number
  readonly availableHousing: number
  readonly lastChange: number
}
```

## Impostos

`HouseSpecification.taxPerPeriod` passa a representar imposto de uma casa totalmente ocupada.

Para cada casa:

```ts
if population === 0: tax = 0
else tax = ceil(taxPerPeriod * population / capacity)
```

Regras:

- casa cheia mantém o imposto atual da Fase 15;
- casa vazia não gera imposto;
- crescimento populacional aumenta receita gradualmente;
- usar `Math.ceil` evita que uma casa com poucos habitantes gere sempre 0.

## UI

Atualizar o painel com:

```text
Population: 35/56
Available housing: 21
Growth last tick: +1
```

Manter stats de workers existentes, agora derivados de população real.

Se for simples, atualizar tooltips de house:

```text
Houses begin empty and attract residents when they have road, water and food.
```

## Cenário, analyzer e advisor

- objetivo de população passa a refletir habitantes reais;
- novos houses vazios não avançam o cenário;
- worker shortage passa a aumentar/diminuir de forma real;
- analyzer existente continua a detetar falta de água/comida/workers;
- advisor continua a poder sugerir `build_house`, mas o after-action report passa a mostrar que impacto em workers não é instantâneo.

Não criar nova action de advisor nesta fase.

## Testes obrigatórios

Seguir TDD: escrever e correr testes falhados antes de produção.

Testes mínimos:

1. casas seedadas começam ocupadas até capacidade;
2. casa construída pelo jogador começa com população 0;
3. house com road + water + food ganha 1 habitante a cada 3 ticks até capacidade;
4. house sem serviço perde 1 habitante a cada 5 ticks até zero;
5. house não cresce acima da capacidade;
6. descida de nível limita população à nova capacidade;
7. workforce depende de população atual, não capacidade;
8. casa vazia não gera impostos;
9. imposto aumenta proporcionalmente à ocupação;
10. `lastChange` indica imigração/emigração do tick;
11. reset restaura população seedada e `lastChange: 0`;
12. cenário reflete população real.

## Critérios de aceitação

A Fase 18 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- cada house tem população atual;
- casas seedadas estão ocupadas;
- casas novas começam vazias;
- serviços atraem população gradualmente;
- falta de serviços reduz população gradualmente;
- população nunca excede capacidade;
- workers são derivados de população atual;
- impostos dependem da ocupação;
- UI mostra população/capacidade/crescimento;
- cenário usa população real;
- reset restaura estado populacional;
- README é atualizado;
- não é feito browser testing.

## Decisões para evitar overengineering

- sem walkers;
- sem cidadões individuais;
- sem pathfinding;
- sem happiness;
- sem imigração por edge map;
- sem novas dependências;
- sem browser testing.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 18 com TDD;
2. preservar food logistics, economia, cenário, câmara, advisor e executor;
3. manter população determinística e fácil de testar;
4. correr `npm run build` e `npm test`;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados e evidência de verificação.
