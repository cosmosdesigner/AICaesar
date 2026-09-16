# AICaesar — Plano de Desenvolvimento da Fase 16

## Objetivo

Substituir evolução, população e impostos de casas hardcoded por uma especificação declarativa de habitação.

Esta fase cria a base para crescimento populacional, desirability e assets de casas maiores no futuro. Não adiciona novos edifícios nem novos serviços.

## Referência Caesaria

Usar apenas como inspiração conceptual:

```text
/root/caesaria-game-inspect/source/objects/house_spec.hpp
/root/caesaria-game-inspect/source/objects/house_spec.cpp
/root/caesaria-game-inspect/source/objects/house_level.hpp
/root/caesaria-game-inspect/source/objects/house.cpp
```

A ideia a adaptar é simples: cada nível de casa declara capacidade, valor económico e requisitos. Não portar código, dados nem níveis da Caesaria.

## Estado atual

Existem três fontes hardcoded relacionadas com casas em `Simulation.ts`:

- `HOUSE_POPULATION_BY_LEVEL`;
- `HOUSE_TAX_BY_LEVEL`;
- regras condicionais para evolução nível 1 → 2 e 2 → 3.

Também existe `upgradeProgress`, mas não existe degradação nem um modo consistente de explicar requisitos em falta.

## Escopo

### Inclui

- `HouseSpecification` declarativa em TypeScript;
- níveis 1–3;
- requisitos por nível;
- capacidade/população por nível;
- imposto por nível;
- progresso de evolução por nível;
- progresso de degradação;
- status derivado por casa;
- missing requirement explícito;
- estatísticas de requisitos em falta no painel;
- analyzer/summary aproveitam o status derivado quando fizer sentido;
- testes unitários;
- README atualizado.

### Exclui

- nível 4;
- desirability;
- jardins/plaza/fountain;
- população individual/migração;
- multi-tile houses;
- troca de sprites de casa;
- road graph;
- browser testing.

## House specification

Criar:

```text
src/simulation/HouseSpecification.ts
```

Tipos sugeridos:

```ts
export type HouseLevel = 1 | 2 | 3
export type HouseRequirement = 'road' | 'water' | 'food'

export interface HouseLevelSpecification {
  readonly level: HouseLevel
  readonly populationCapacity: number
  readonly taxPerPeriod: number
  readonly requirements: readonly HouseRequirement[]
  readonly upgradeTicks: number
}
```

Definir uma fonte única de verdade:

```ts
HOUSE_SPECIFICATIONS
```

Valores iniciais:

| Nível | Capacidade | Imposto/período | Requisitos | Upgrade ticks |
|---|---:|---:|---|---:|
| 1 | 4 | 2 | nenhum | — |
| 2 | 8 | 4 | road + water | 3 |
| 3 | 14 | 7 | road + water + food | 5 |

Decisão pragmática:

- uma casa nível 1 pode existir sem serviços;
- precisa de road + water para chegar a nível 2;
- precisa de road + water + food para chegar a nível 3;
- isto preserva a mecânica atual e evita criar uma população de zero antes da Fase 18.

## Status derivado de casa

Criar API pura, possivelmente em `HouseSpecification.ts` ou `Simulation.ts`:

```ts
interface HouseServices {
  readonly road: boolean
  readonly water: boolean
  readonly food: boolean
}

interface HouseStatus {
  readonly currentLevel: HouseLevel
  readonly targetLevel: HouseLevel
  readonly missingForCurrentLevel?: HouseRequirement
  readonly missingForNextLevel?: HouseRequirement
  readonly canUpgrade: boolean
  readonly shouldDegrade: boolean
}
```

Regras:

- `targetLevel` é o nível mais alto cujos requisitos estão satisfeitos;
- `missingForNextLevel` explica o primeiro requisito que bloqueia evolução;
- `missingForCurrentLevel` explica o requisito perdido que causa degradação;
- ordem legível de requisitos: road → water → food.

Não duplicar estes campos no `Building` se puderem ser derivados.

## Evolução e degradação

### Evolução

- uma casa só sobe um nível de cada vez;
- quando `targetLevel > currentLevel`, acumula `upgradeProgress`;
- usa `upgradeTicks` do nível alvo;
- ao subir, reseta progresso de upgrade e degrade;
- se perder requisito enquanto sobe, reseta upgrade progress.

### Degradação

Adicionar:

```ts
HOUSE_DEGRADE_TICKS = 4
```

- quando `targetLevel < currentLevel`, acumula `degradeProgress`;
- após 4 ticks, desce exatamente um nível;
- reseta upgrade/degrade progress após descida;
- degradação não pode levar abaixo do nível 1;
- quando serviços recuperam, reseta `degradeProgress`.

Adicionar `degradeProgress?: number` apenas às casas em `Building`.

Esta regra cria pressão sem colapso instantâneo:

```text
nível 3 perde comida -> espera 4 ticks -> nível 2
nível 2 continua sem água -> espera 4 ticks -> nível 1
```

## Refactor de simulação

Atualizar `Simulation.ts` para:

- calcular serviços da casa uma vez por tick;
- usar `HouseSpecification` para status/evolução;
- usar specification para população;
- usar specification para impostos;
- remover duplicação de `HOUSE_POPULATION_BY_LEVEL` e `HOUSE_TAX_BY_LEVEL`, ou manter reexports de compatibilidade apenas se necessários.

`getPopulation()` e `getHouseTax()` devem ler `populationCapacity` e `taxPerPeriod` da spec.

## UI

Atualizar `BuildPanel` com resumo de housing requirements:

```text
Housing requirements
Blocked by road: N
Blocked by water: N
Blocked by food: N
Degrading: N
```

Não criar seleção de tile nesta fase.

A explicação por casa fica disponível via `getHouseStatus` para uso futuro por seleção/analyzer/advisor.

## Analyzer/advisor

Não criar uma nova rules engine.

Atualizar o analyzer apenas se for simples para usar o status derivado e manter mensagens coerentes:

- `water_shortage` continua a identificar casas bloqueadas por água;
- `food_shortage` continua a identificar casas bloqueadas por comida;
- road access mantém-se relevante;
- podem incluir o nível alvo/requisito em falta na explicação se não acrescentar complexidade excessiva.

O advisor continua a depender das issues existentes.

## Visual

Manter os sprites atuais e a tint existente para níveis 1–3.

Não tentar resolver qualidade de assets nem usar assets multi-tile nesta fase.

## Testes obrigatórios

Seguir TDD: escrever e correr testes falhados antes de produção.

Testes mínimos:

1. specifications definem níveis, capacidade, imposto e requisitos corretos;
2. house com road + water evolui de 1 para 2 após 3 ticks;
3. house com road + water + food evolui de 2 para 3 após 5 ticks;
4. house nível 3 sem food degrada para 2 após 4 ticks;
5. house nível 2 sem water degrada para 1 após 4 ticks;
6. recuperar serviços antes do limite cancela degradação;
7. `getHouseStatus` expõe missing road/water/food na ordem correta;
8. população e impostos são derivados da specification;
9. reset inicializa `degradeProgress` e progressos de casas corretamente.

## Critérios de aceitação

A Fase 16 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- níveis 1–3 estão declarados numa única specification;
- população e impostos usam essa specification;
- evolução usa requisitos declarados;
- casas degradam uma fase de cada vez após serviços em falta;
- recuperar serviços cancela degradação pendente;
- API expõe missing requirements;
- painel mostra resumo de requisitos em falta/degradação;
- analyzer não regressa;
- README é atualizado;
- não é feito browser testing.

## Decisões para evitar overengineering

- sem nível 4;
- sem desirability;
- sem árvores de requisitos genéricas;
- sem estado duplicado de serviços;
- sem multi-tile houses;
- sem trocar assets;
- sem browser testing.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 16 com TDD;
2. preservar economia, cenário, câmara, advisor e executor;
3. centralizar regras de casa sem adicionar abstração desnecessária;
4. correr `npm run build` e `npm test`;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados e evidência de verificação.
