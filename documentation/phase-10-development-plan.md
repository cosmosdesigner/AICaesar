# AICaesar — Plano de Desenvolvimento da Fase 10

## Objetivo

Preparar a integração LLM do advisor sem tornar o jogo dependente de rede, credenciais ou chamadas externas.

A Fase 10 deve introduzir uma fronteira clara entre:

- provider mock determinístico, usado por defeito no desenvolvimento local;
- provider LLM, preparado para receber contexto estruturado e devolver JSON validado;
- validação de schema e fallback seguro para o mock;
- ActionValidator/ActionExecutor continuam a ser a fronteira de segurança antes de qualquer execução.

## Estado atual

Já existe:

- analyzer determinístico;
- `MockAdvisor` com `createAdvisorPlan(city)`;
- `AdvisorPanel`;
- `ActionValidator`;
- `ActionExecutor`;
- testes Vitest;
- advisor pode aprovar e executar planos válidos.

## Escopo da Fase 10

### Inclui

- criar interface `AdvisorProvider`;
- criar provider mock compatível com a interface;
- criar provider LLM preparado, mas sem obrigar chamadas reais;
- criar prompt/contexto com apenas `CityStateSummary` e `CityIssue[]`;
- validar JSON/plano devolvido pelo provider LLM;
- fallback para mock quando LLM falha, está indisponível ou devolve plano inválido;
- integrar provider no `AdvisorPanel`/fluxo atual;
- manter mock como default local;
- adicionar testes unitários para:
  - provider mock;
  - fallback;
  - rejeição de JSON/plano inválido;
  - garantia de que plano gerado passa por validação antes de execução;
- atualizar README.

### Exclui

- chamadas reais a APIs externas por defeito;
- gestão de secrets/API keys;
- streaming;
- tool-calling LLM;
- execução direta de texto gerado por LLM;
- backend;
- persistência;
- browser testing.

## Arquitetura proposta

Criar pasta:

```text
src/advisor/providers/
```

Ficheiros sugeridos:

```text
src/advisor/AdvisorProvider.ts
src/advisor/providers/MockAdvisorProvider.ts
src/advisor/providers/LLMAdvisorProvider.ts
src/advisor/providers/SafeAdvisorProvider.ts
src/advisor/providers/AdvisorProvider.test.ts
```

Pode ajustar nomes se ficar mais simples, mas manter responsabilidades explícitas.

## Tipos

### AdvisorProvider

```ts
export interface AdvisorProvider {
  readonly name: string
  createPlan(input: AdvisorProviderInput): Promise<AdvisorProviderResult>
}
```

### AdvisorProviderInput

```ts
export interface AdvisorProviderInput {
  readonly summary: CityStateSummary
  readonly issues: readonly CityIssue[]
}
```

### AdvisorProviderResult

```ts
export type AdvisorProviderResult =
  | { readonly ok: true; readonly plan: AdvisorPlan; readonly provider: string }
  | { readonly ok: false; readonly error: string; readonly provider: string }
```

## Provider mock

`MockAdvisorProvider` deve reutilizar a lógica existente do mock advisor.

Opções:

- manter `createAdvisorPlan(city)` para uso interno simples;
- ou extrair função `createMockAdvisorPlan(summary, issues)` para ser usada pelo provider.

Preferência:

- preservar compatibilidade e evitar grande refactor;
- adicionar provider que recebe `city` ou input estruturado conforme for mais simples;
- mas a interface pública deve deixar claro que o provider usa summary/issues, não estado bruto.

## Provider LLM

Criar provider que:

- recebe `AdvisorProviderInput`;
- constrói prompt estruturado;
- espera JSON;
- valida a resposta.

Nesta fase, não chamar rede por defeito.

Implementação recomendada:

```ts
export interface LLMPlanClient {
  complete(prompt: string): Promise<string>
}
```

`LLMAdvisorProvider` recebe um `LLMPlanClient` injetado.

Assim os testes podem simular:

- JSON válido;
- JSON inválido;
- erro lançado;
- plano que não passa schema.

## Prompt

O prompt deve conter apenas:

- `CityStateSummary`;
- `CityIssue[]`;
- tipos de ações permitidas;
- formato JSON esperado.

Não enviar:

- `CityState` completo;
- lista crua de tiles;
- assets;
- DOM;
- qualquer secret;
- instruções para executar ações diretamente.

## Schema/validação

Adicionar validação manual simples sem biblioteca extra, a menos que OMP considere uma dependência claramente útil.

Regras mínimas para plano LLM:

- `summary` string;
- `reasoning` array de strings;
- `actions` array;
- cada action tem:
  - `type` permitido;
  - `label` string;
  - `reason` string;
  - `estimatedCost` number;
  - `target` opcional com `x`/`y` number;
- `estimatedCost` do plano é coerente com actions;
- `expectedImpact` array de strings;
- `risks` array de strings.

Depois, antes de executar, continua a passar por `ActionValidator`.

## Safe/fallback provider

Criar wrapper:

```ts
createSafeAdvisorProvider(primary, fallback)
```

Comportamento:

- chama primary;
- se primary falhar ou devolver plano inválido, chama fallback;
- resultado deve indicar provider usado;
- nunca lança para UI por erro normal do provider.

## Integração UI

`AdvisorPanel` deve suportar provider assíncrono.

Ao clicar `Analyze city`:

- gerar `summary` e `issues`;
- chamar provider configurado;
- mostrar estado `Analyzing...` se simples;
- mostrar plano e nome do provider usado;
- se fallback foi usado, mostrar mensagem curta.

Mock deve ser default.

A UI não precisa de selector complexo. Se for simples, mostrar apenas:

```text
Provider: mock
```

ou

```text
Provider: llm-fallback-mock
```

## Execução segura

Nada muda na execução:

- `Approve` continua a chamar `executePlan`;
- `executePlan` chama `validatePlan`;
- plano inválido não altera cidade.

Criticamente: texto do LLM nunca executa comandos, nunca altera cidade e nunca bypassa validator.

## Testes obrigatórios

Seguir TDD.

Testes mínimos:

1. mock provider devolve plano válido;
2. LLM provider aceita JSON válido e normaliza/valida plano;
3. LLM provider rejeita JSON inválido;
4. safe provider usa fallback quando primary falha;
5. safe provider usa fallback quando primary devolve plano inválido;
6. plano vindo de provider ainda é rejeitado por `validatePlan` se apontar para tile ocupado.

## Critérios de aceitação

A Fase 10 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- existe interface `AdvisorProvider`;
- mock provider continua disponível e é default;
- LLM provider existe com client injetável, sem network obrigatório;
- prompt usa apenas summary/issues;
- resposta JSON é validada;
- fallback para mock funciona;
- UI consegue gerar plano via provider;
- execução continua protegida por `ActionValidator`;
- README documenta provider/fallback/segurança;
- não é feito browser testing.

## Verificação

Obrigatório:

```sh
npm run build
npm test
git status --short
```

## Decisões para evitar overengineering

- Sem API key nesta fase;
- Sem chamada real obrigatória;
- Sem backend;
- Sem streaming;
- Sem tool-calling;
- Sem schema library se validação manual for suficiente;
- Sem selector complexo de providers;
- Sem execução fora do ActionExecutor.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 10 com TDD;
2. preservar advisor mock, validator e executor existentes;
3. adicionar testes de provider/fallback/schema;
4. correr build e testes;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados e evidência de verificação.
