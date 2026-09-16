# AICaesar — Plano de Desenvolvimento da Fase 8

## Objetivo

Validar a experiência de um advisor antes de integrar um LLM.

A Fase 8 deve transformar as issues determinísticas da Fase 7 num plano legível e estruturado para o jogador. O advisor continua 100% determinístico/mock: não executa ações, não chama IA, não modifica a cidade e não aprova nada automaticamente.

## Estado atual

Já existe:

- construção manual de `road`, `house`, `well`, `farm`, `granary`, `market`;
- simulação de água, comida e trabalhadores;
- analyzer determinístico em `src/analysis/CityAnalyzer.ts`;
- painel com top 3 issues;
- testes unitários Vitest para analyzer.

## Escopo da Fase 8

### Inclui

- criar um advisor determinístico/mock;
- gerar plano estruturado a partir das issues do analyzer;
- adicionar painel do advisor;
- adicionar botão `Analyze city`;
- mostrar explicação textual do principal problema;
- mostrar raciocínio resumido;
- mostrar ações sugeridas;
- mostrar custo estimado;
- mostrar impactos esperados;
- mostrar riscos;
- adicionar botões `Approve` e `Reject`;
- garantir que `Approve` nesta fase não executa ações, apenas marca como aprovado/pendente para fase futura;
- garantir que `Reject` descarta o plano;
- adicionar testes unitários para geração de plano;
- atualizar README.

### Exclui

- LLM;
- action validator;
- action executor;
- execução real de ações;
- alteração automática da cidade;
- pathfinding;
- walkers;
- backend;
- persistência;
- browser testing.

## Modelo proposto

Criar ficheiro:

```text
src/advisor/MockAdvisor.ts
```

### AdvisorPlan

```ts
export interface AdvisorPlan {
  readonly summary: string
  readonly reasoning: readonly string[]
  readonly actions: readonly AdvisorAction[]
  readonly estimatedCost: number
  readonly expectedImpact: readonly string[]
  readonly risks: readonly string[]
}
```

### AdvisorAction

```ts
export type AdvisorActionType =
  | 'build_road'
  | 'build_well'
  | 'build_farm'
  | 'build_granary'
  | 'build_market'
  | 'build_house'
  | 'wait'

export interface AdvisorAction {
  readonly type: AdvisorActionType
  readonly label: string
  readonly reason: string
  readonly target?: { readonly x: number; readonly y: number }
  readonly estimatedCost: number
}
```

### API

```ts
export function createAdvisorPlan(city: CityState): AdvisorPlan
```

O advisor deve internamente usar:

- `analyzeCity(city)`;
- `summarizeCity(city)`;
- `BUILD_COSTS`.

## Regras de geração do plano

A geração deve ser determinística e simples.

### Sem issues

Se não houver issues:

- summary: cidade está estável;
- action: `wait`;
- estimatedCost: 0;
- impact: observar mais ticks;
- risk: nenhum relevante.

### Water shortage

Se a issue principal for `water_shortage`:

- sugerir construir `well` perto da primeira casa afetada;
- action type: `build_well`;
- estimatedCost: `BUILD_COSTS.well`;
- target pode ser aproximado, por exemplo tile adjacente à primeira casa afetada se estiver no mapa; não precisa validar ainda.

### Food shortage / food production shortage

Se problema for comida:

- se não houver granary/capacidade, sugerir `build_granary`;
- se há capacity mas pouca produção, sugerir `build_farm`;
- se há comida armazenada mas sem cobertura, sugerir `build_market`.

### Worker shortage

Se problema for trabalhadores:

- sugerir `build_house`;
- explicar que mais casas aumentam população e workers.

### Road access missing

Se problema for estrada:

- sugerir `build_road` perto do primeiro edifício afetado.

### Low money

Se problema for dinheiro baixo:

- sugerir `wait`;
- explicar que economia monetária ainda não existe, por isso não há ação automática segura.

## UI

Pode ficar no mesmo `BuildPanel` ou num novo componente `AdvisorPanel`.

Preferência: criar novo componente para manter responsabilidades separadas:

```text
src/ui/AdvisorPanel.ts
```

O painel deve ter:

- título `Advisor`;
- botão `Analyze city`;
- área de summary;
- lista de reasoning;
- lista de actions;
- estimated cost;
- expected impact;
- risks;
- botões `Approve` e `Reject` visíveis apenas quando existe plano.

### Sem execução nesta fase

`Approve`:

- não altera cidade;
- mostra mensagem: `Plan approved for future execution. Execution is not implemented yet.`

`Reject`:

- limpa plano;
- mostra mensagem: `Plan rejected.`

## Integração no jogo

`Game.ts` deve instanciar o advisor panel e dar acesso ao estado atual da cidade.

Opção simples:

```ts
const advisor = new AdvisorPanel(host, () => city)
```

Após reset/build/tick, o plano existente pode ficar visível, mas deve haver indicação que foi gerado para um estado anterior se for simples. Para MVP, é aceitável manter o plano até o jogador voltar a analisar.

## Testes

Adicionar testes unitários em:

```text
src/advisor/MockAdvisor.test.ts
```

Testes mínimos:

1. cidade com water shortage gera ação `build_well`;
2. cidade com worker shortage gera ação `build_house`;
3. cidade sem issues gera ação `wait`;
4. estimatedCost é soma dos custos das ações.

## Critérios de aceitação

A Fase 8 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- existe `createAdvisorPlan(city)` determinístico;
- botão `Analyze city` gera plano no painel;
- advisor explica o problema principal;
- advisor propõe pelo menos uma ação válida/mock;
- jogador pode rejeitar o plano;
- jogador pode aprovar o plano sem execução real;
- nenhuma ação modifica a cidade nesta fase;
- README documenta a Fase 8;
- não é feito browser testing.

## Verificação

Obrigatório:

```sh
npm run build
npm test
git status --short
```

## Decisões para evitar overengineering

- Não chamar LLM;
- Não validar nem executar ações;
- Não tentar encontrar posição perfeita;
- Não criar um planner genérico;
- Não introduzir estado global complexo;
- Não criar backend/persistência.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 8;
2. preservar gameplay e analyzer existentes;
3. adicionar testes do advisor;
4. correr build e testes;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados e evidência de verificação.
