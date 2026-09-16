# AICaesar — Plano de Desenvolvimento da Fase 11

## Objetivo

Fechar o ciclo de cooperação entre jogador e advisor através de um after-action report baseado em métricas reais.

A Fase 10 permite gerar planos via provider e a Fase 9 permite executar planos aprovados. A Fase 11 deve mostrar ao jogador o que mudou depois da execução, usando snapshots antes/depois da cidade e problemas remanescentes do analyzer.

## Estado atual

Já existe:

- analyzer determinístico;
- advisor provider boundary;
- advisor mock/LLM provider preparado;
- action validator/executor;
- approve executa planos válidos;
- testes Vitest.

## Escopo da Fase 11

### Inclui

- criar snapshot de métricas antes da execução do plano;
- criar snapshot depois da execução do plano;
- comparar métricas relevantes;
- gerar relatório textual determinístico;
- listar problemas remanescentes após execução;
- mostrar report no `AdvisorPanel` depois de aprovação bem-sucedida;
- adicionar testes unitários;
- atualizar README.

### Exclui

- LLM report;
- explicações longas;
- gráficos;
- persistência de histórico;
- múltiplos reports guardados;
- exportação;
- backend;
- browser testing.

## Métricas mínimas

O snapshot deve incluir pelo menos:

```ts
export interface CityMetricsSnapshot {
  readonly money: number
  readonly foodStored: number
  readonly foodCapacity: number
  readonly houses: number
  readonly housesWithWater: number
  readonly housesWithFood: number
  readonly levelTwoHouses: number
  readonly levelThreeHouses: number
  readonly population: number
  readonly workersAvailable: number
  readonly workersRequired: number
  readonly workerShortage: number
  readonly activeWorkplaces: number
  readonly inactiveWorkplaces: number
  readonly issueCount: number
  readonly highSeverityIssues: number
}
```

Pode incluir métricas adicionais se forem úteis e simples.

## Modelo proposto

Criar ficheiro:

```text
src/advisor/AfterActionReport.ts
```

### Tipos

```ts
export interface MetricDelta {
  readonly label: string
  readonly before: number
  readonly after: number
  readonly delta: number
}

export interface AfterActionReport {
  readonly summary: string
  readonly executedActions: number
  readonly spent: number
  readonly deltas: readonly MetricDelta[]
  readonly remainingIssues: readonly string[]
}
```

### API

```ts
export function createCityMetricsSnapshot(city: CityState): CityMetricsSnapshot

export function createAfterActionReport(input: {
  readonly before: CityMetricsSnapshot
  readonly after: CityMetricsSnapshot
  readonly executedActions: number
  readonly spent: number
  readonly remainingIssues: readonly CityIssue[]
}): AfterActionReport
```

## Integração com execução

`Game.ts` deve capturar snapshot antes de executar:

```ts
const before = createCityMetricsSnapshot(city)
const result = executePlan(city, plan, plan.estimatedCost)
const after = createCityMetricsSnapshot(city)
const report = createAfterActionReport(...)
```

Apenas criar report se `result.ok === true`.

Se a execução falhar, mostrar erro atual sem report.

## UI

`AdvisorPanel` deve receber e mostrar o report.

Opção simples:

- adicionar callback `onReport?: (report) => void` não é necessário;
- melhor: `onApprovePlan` pode devolver `{ ok, message, report? }`.

Atualizar `AdvisorApprovalResult`:

```ts
export interface AdvisorApprovalResult {
  readonly ok: boolean
  readonly message: string
  readonly report?: AfterActionReport
}
```

No painel, mostrar secção:

```text
After-action report
Summary: Executed 1 action, spent 35.
Money: 500 → 465 (-35)
Houses with water: 2 → 3 (+1)
Remaining issues:
- [medium] Falta comida em 2 casas.
```

Se não houver issues remanescentes:

```text
No remaining critical issues detected.
```

## Regras de report

### Summary

Gerar frase curta:

- se executou build actions:
  `Executed N action(s), spent X.`
- se wait/no-op:
  `No build actions executed. City observed.`

### Deltas

Gerar deltas apenas para métricas relevantes, ou todas as métricas se o painel ficar legível.

Preferência:

- money;
- food stored;
- houses with water;
- houses with food;
- population;
- workers available;
- worker shortage;
- active/inactive workplaces;
- issue count;
- high severity issues.

### Remaining issues

Usar `analyzeCity(city)` depois da execução.

Mostrar no máximo 3 issues remanescentes no report para não poluir UI.

## Testes obrigatórios

Seguir TDD.

Testes mínimos:

1. snapshot reflete dinheiro, food, houses, workers e issue count;
2. report calcula deltas corretamente;
3. report inclui issues remanescentes;
4. execução bem-sucedida de plano gera report com spent/executedActions;
5. execução falhada não deve gerar report na integração/callback se for simples testar.

## Critérios de aceitação

A Fase 11 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- existe snapshot antes/depois;
- after-action report mostra métricas reais;
- depois de aprovar plano bem-sucedido, advisor mostra o que mudou;
- problemas remanescentes são listados;
- execução falhada não gera report enganador;
- README documenta a Fase 11;
- não é feito browser testing.

## Verificação

Obrigatório:

```sh
npm run build
npm test
git status --short
```

## Decisões para evitar overengineering

- Sem histórico persistente;
- Sem gráficos;
- Sem LLM report;
- Sem analytics complexos;
- Sem guardar múltiplos reports;
- Sem backend.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 11 com TDD;
2. preservar provider/advisor/executor existentes;
3. adicionar testes para snapshot/report;
4. correr build e testes;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados e evidência de verificação.
