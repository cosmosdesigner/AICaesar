# AICaesar — Plano de Desenvolvimento da Fase 7

## Objetivo

Criar um analyzer determinístico para identificar problemas reais da cidade sem usar IA.

Esta fase prepara a base para o advisor futuro: antes de pedir recomendações a um LLM, o jogo deve conseguir resumir o estado da cidade e produzir issues reproduzíveis com severidade, causa provável e localização aproximada.

## Estado atual

Já existe:

- construção manual de `road`, `house`, `well`, `farm`, `granary`, `market`;
- simulação por tick;
- água;
- comida;
- níveis de casas até nível 3;
- trabalhadores e workplaces ativos/inativos;
- overlays de água/comida;
- painel com stats operacionais.

## Escopo da Fase 7

### Inclui

- criar `CityAnalyzer` determinístico;
- criar `CityStateSummary`;
- criar lista de `CityIssue` ordenada por severidade;
- detetar problemas mínimos:
  - casas sem água;
  - casas sem comida;
  - produção de comida insuficiente;
  - distribuição de comida insuficiente;
  - falta de trabalhadores;
  - edifícios económicos sem estrada adjacente;
  - dinheiro baixo;
- mostrar os 3 problemas principais no painel;
- adicionar testes unitários para água e comida, se for simples integrar com a stack atual;
- atualizar README.

### Exclui

- advisor textual;
- plano de ações;
- aprovação/rejeição de ações;
- LLM;
- execução automática de recomendações;
- pathfinding;
- walkers;
- UI complexa.

## Modelo proposto

Criar ficheiro:

```text
src/analysis/CityAnalyzer.ts
```

### CityIssue

```ts
export type CityIssueType =
  | 'water_shortage'
  | 'food_shortage'
  | 'food_production_shortage'
  | 'food_distribution_shortage'
  | 'worker_shortage'
  | 'road_access_missing'
  | 'low_money'

export type CityIssueSeverity = 'low' | 'medium' | 'high'

export interface CityIssue {
  readonly type: CityIssueType
  readonly severity: CityIssueSeverity
  readonly affectedTiles: readonly Array<{ x: number; y: number }>
  readonly explanation: string
  readonly cause: string
}
```

### CityStateSummary

```ts
export interface CityStateSummary {
  readonly tick: number
  readonly money: number
  readonly houses: number
  readonly housesWithoutWater: number
  readonly housesWithoutFood: number
  readonly foodStored: number
  readonly foodCapacity: number
  readonly farms: number
  readonly markets: number
  readonly population: number
  readonly workersAvailable: number
  readonly workersRequired: number
  readonly workerShortage: number
}
```

### Analyzer API

```ts
export function summarizeCity(city: CityState): CityStateSummary
export function analyzeCity(city: CityState): CityIssue[]
```

## Regras de análise

### Water shortage

Problema quando existem casas com estrada mas sem água.

- severity high: mais de 50% das casas sem água;
- severity medium: 2+ casas sem água;
- severity low: 1 casa sem água.

### Food shortage

Problema quando existem casas com água/estrada mas sem comida depois de haver mercados/granaries ou comida esperada.

- severity high: mais de 50% das casas sem comida;
- severity medium: 2+ casas sem comida;
- severity low: 1 casa sem comida.

### Food production shortage

Problema quando:

- existem casas e markets, mas não existem farms ativas; ou
- comida armazenada está a 0 e há casas que precisam de comida.

### Food distribution shortage

Problema quando:

- existe comida armazenada;
- existem casas sem comida;
- não existem markets ativos suficientes/cobertura.

Usar regra simples: se `foodStored > 0` e `housesWithoutFood > 0` e `foodCoveredTiles === 0`, issue high/medium.

### Worker shortage

Problema quando `workerShortage > 0`.

- high se shortage >= 50% dos workers required;
- medium se shortage >= 25%;
- low caso contrário.

### Road access missing

Problema quando edifícios económicos (`farm`, `granary`, `market`) não têm estrada adjacente.

Mesmo que a simulação ainda não use road access para ativar esses edifícios, o analyzer deve começar a expor este problema para o advisor futuro.

### Low money

Problema quando dinheiro está baixo.

Sugestão:

- low abaixo de 100;
- medium abaixo de 50;
- high abaixo de 20.

## Ordenação

Issues devem ser ordenadas por:

1. severity: high > medium > low;
2. tipo estável;
3. número de affectedTiles descendente.

Isto garante resultados reproduzíveis.

## UI

Atualizar `BuildPanel` para mostrar uma secção simples:

```text
Principais problemas:
1. [high] Falta água em 3 casas
2. [medium] Falta comida em 2 casas
3. [low] Dinheiro baixo
```

Mostrar no máximo 3 issues.

Se não existirem issues:

```text
Sem problemas críticos detetados.
```

Não criar modal nem advisor ainda.

## Testes

Se a stack atual não tiver runner de testes, adicionar uma opção simples com Vitest é aceitável, desde que não complique demasiado.

Preferência:

- adicionar `vitest` como dev dependency;
- script `test` no `package.json`;
- criar testes em `src/analysis/CityAnalyzer.test.ts`.

Testes mínimos:

1. cidade com casa sem poço gera `water_shortage`;
2. cidade com casa/market/granary/farm sem comida ou sem distribuição gera issue de comida;
3. cidade com workplaces acima da população gera `worker_shortage`.

Se adicionar Vitest for pesado ou problemático, criar smoke test TypeScript simples. Mas preferência é teste unitário real.

## Critérios de aceitação

A Fase 7 está concluída quando:

- `npm run build` passa;
- `npm test` passa se for criado script de testes;
- `analyzeCity(city)` corre sem IA;
- issues são determinísticas;
- são detetados pelo menos:
  - casas sem água;
  - casas sem comida;
  - falta de trabalhadores;
- painel mostra os 3 principais problemas;
- README documenta o analyzer;
- não é feito browser testing.

## Verificação

Obrigatório:

```sh
npm run build
git status --short
```

Se houver script de testes:

```sh
npm test
```

## Decisões para evitar overengineering

- Não usar LLM;
- Não criar advisor ainda;
- Não criar planos de ação;
- Não criar explicações longas;
- Não bloquear gameplay com warnings;
- Não criar sistema complexo de rules engine;
- Não introduzir backend.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 7;
2. preservar construção/simulação/UI existente;
3. adicionar testes se viável;
4. correr build e testes aplicáveis;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados e evidência de verificação.
