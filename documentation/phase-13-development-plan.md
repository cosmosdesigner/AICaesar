# AICaesar — Plano de Desenvolvimento da Fase 13

## Objetivo

Transformar o protótipo sandbox numa missão jogável com início, objetivos, progresso, vitória e derrota.

Esta fase não cria uma economia nova nem novos edifícios. Dá propósito às mecânicas existentes: construir, fornecer água/comida, manter workers e usar o advisor para atingir uma meta clara.

## Referência Caesaria

Usar apenas como inspiração de design os ficheiros de missão locais:

```text
/root/caesaria-game-inspect/bin/resources/missions/*.mission
/root/caesaria-game-inspect/bin/resources/missions/caesarea.mission
```

Adaptar os conceitos de briefing, objetivos e win/lose conditions. Não portar formato nem código C++.

## Cenário inicial

Nome: `Found a functioning settlement`

Briefing curto:

```text
Build a stable settlement. Expand housing, keep basic services running,
and prove that the city can support its population.
```

Objetivos simultâneos:

- população >= 80;
- pelo menos 70% das casas com água;
- pelo menos 50% das casas com comida;
- worker shortage <= 20% dos workers required;
- dinheiro >= 100.

## Condições de resultado

### Vitória

A cidade vence quando todos os objetivos estão satisfeitos no mesmo tick de avaliação.

### Derrota

Manter a derrota simples e alcançável sem introduzir economia nova:

- `money < 50`; ou
- limite de 900 simulation ticks atingido sem vitória.

Nota:

- o limite é game-time, não wall-clock; velocidades 2x/4x avançam a simulação mais depressa;
- a Fase 15 introduzirá falência real com upkeep/impostos. Não antecipar essa economia aqui.

## Modelo de dados

Criar `src/scenario/Scenario.ts` ou estrutura equivalente.

```ts
export type ScenarioStatus = 'active' | 'won' | 'lost'

export interface ScenarioDefinition {
  readonly id: string
  readonly title: string
  readonly briefing: string
  readonly maxTicks: number
  readonly loseBelowMoney: number
  readonly objectives: readonly ScenarioObjective[]
}

export interface ScenarioObjective {
  readonly id: string
  readonly label: string
  readonly current: number
  readonly target: number
  readonly completed: boolean
}

export interface ScenarioProgress {
  readonly status: ScenarioStatus
  readonly objectives: readonly ScenarioObjective[]
  readonly completedObjectives: number
  readonly totalObjectives: number
  readonly resultMessage?: string
}
```

A definição deve ser imutável. O progresso deve ser sempre derivado de `CityState` e tick atual, sem estado duplicado desnecessário.

## API sugerida

```ts
export const FOUNDING_SETTLEMENT_SCENARIO: ScenarioDefinition

export function evaluateScenario(
  city: CityState,
  definition: ScenarioDefinition,
): ScenarioProgress

export function getScenarioContext(progress: ScenarioProgress): string
```

`evaluateScenario` deve ser puro e determinístico.

## Cálculos dos objetivos

- População: `getWorkforceStats(city).population`.
- Água: `housesWithWater / totalHouses * 100`; se não houver casas, valor 0.
- Comida: `housesWithFood / totalHouses * 100`; se não houver casas, valor 0.
- Worker shortage: `workerShortage / workersRequired * 100`; se `workersRequired === 0`, valor 0.
- Dinheiro: `city.resources.money`.

Não criar novas regras de simulação.

## UI

Criar `src/ui/ScenarioPanel.ts`.

Mostrar:

- título;
- briefing;
- objetivos em lista;
- valor atual / target;
- estado visual de completo/incompleto;
- tick atual e limite;
- estado:
  - `Active`;
  - `Victory`;
  - `Defeat`.

Quando a partida acabar:

- mostrar mensagem clara;
- pausar a simulação;
- bloquear novas construções e aprovação de planos;
- manter `Reset` disponível para começar de novo.

Não criar modal complexo. Um painel e estado claro chegam para MVP.

## Integração no jogo

`Game.ts` deve:

1. criar o cenário ao iniciar/reset;
2. avaliar progresso depois de build, tick e execução de plano;
3. atualizar `ScenarioPanel`;
4. ao vencer/perder:
   - pausar simulação;
   - impedir construção;
   - impedir aprovação de planos;
   - informar BuildPanel e AdvisorPanel;
5. permitir Reset restaurar cidade e cenário ativo.

## Advisor consciente do cenário

O advisor não precisa de novo provider nem LLM nesta fase.

Ao gerar um plano, adicionar contexto curto e determinístico no painel/plano, por exemplo:

```text
Scenario progress: 2/5 objectives complete. Primary remaining objective: Population 32/80.
```

O objetivo é ligar o advisor ao jogo, não criar estratégia multi-ação ainda.

## Testes obrigatórios

Seguir TDD: escrever teste falhado antes de código de produção.

Testes mínimos:

1. seed city gera progresso ativo e objetivos corretos;
2. cidade que cumpre todos os valores vence;
3. dinheiro abaixo de 50 gera derrota;
4. tick >= 900 sem vitória gera derrota;
5. worker shortage com `workersRequired = 0` é 0%, sem divisão por zero;
6. progresso de água/comida calcula percentagens corretamente;
7. reset volta ao cenário ativo, se for simples testar pela API pura.

## Critérios de aceitação

A Fase 13 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- existe definição de cenário e avaliação pura;
- objetivos são visíveis durante a partida;
- vitória é detetada automaticamente;
- derrota por dinheiro baixo ou limite de ticks é detetada automaticamente;
- fim de partida pausa simulação;
- fim de partida bloqueia builds e aprovação do advisor;
- Reset reinicia cenário/cidade;
- advisor mostra contexto simples de progresso;
- README explica o primeiro cenário;
- não é feito browser testing.

## Fora de escopo

- economia de impostos/upkeep;
- múltiplos cenários;
- sistema de campanhas;
- eventos;
- LLM real;
- save/load;
- navegação de mapa;
- browser testing.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 13 com TDD;
2. preservar todas as mecânicas e testes existentes;
3. manter cenário e avaliação determinísticos;
4. correr `npm run build` e `npm test`;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados e evidência de verificação.
