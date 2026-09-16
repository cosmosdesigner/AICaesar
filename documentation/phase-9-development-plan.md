# AICaesar — Plano de Desenvolvimento da Fase 9

## Objetivo

Permitir que planos aprovados pelo advisor sejam executados com segurança.

A Fase 8 criou planos mock determinísticos, mas `Approve` apenas mostrava uma mensagem. A Fase 9 deve introduzir uma camada explícita de validação e execução transacional simples para transformar ações aprovadas em alterações reais da cidade.

## Estado atual

Já existe:

- construção manual via `placeBuilding(city, x, y, type)`;
- `AdvisorPlan` e `AdvisorAction` em `src/advisor/MockAdvisor.ts`;
- `AdvisorPanel` com `Analyze city`, `Approve` e `Reject`;
- analyzer determinístico;
- Vitest configurado;
- build e testes existentes.

## Escopo da Fase 9

### Inclui

- criar `ActionValidator`;
- criar `ActionExecutor`;
- validar dinheiro disponível;
- validar tile dentro do mapa;
- validar tile livre;
- validar tipo de ação suportado;
- validar orçamento aprovado;
- executar plano aprovado de forma transacional simples;
- integrar execução no botão `Approve`;
- atualizar mapa/painéis depois de execução bem-sucedida;
- rejeitar plano inválido com relatório claro;
- adicionar testes unitários para validator/executor;
- atualizar README.

### Exclui

- LLM;
- demolição;
- execução parcial silenciosa;
- rollback complexo com histórico;
- pathfinding;
- walkers;
- backend;
- persistência;
- multi-action planner sofisticado;
- browser testing.

## Modelo proposto

Criar pasta:

```text
src/actions/
```

Ficheiros sugeridos:

```text
src/actions/ActionValidator.ts
src/actions/ActionExecutor.ts
src/actions/ActionExecutor.test.ts
```

Pode juntar validator/executor num único ficheiro se ficar mais simples, mas manter nomes claros.

## Tipos

### Validation result

```ts
export type PlanValidationResult =
  | { readonly ok: true; readonly estimatedCost: number }
  | { readonly ok: false; readonly errors: readonly string[] }
```

### Execution result

```ts
export type PlanExecutionResult =
  | {
      readonly ok: true
      readonly executedActions: number
      readonly spent: number
      readonly message: string
    }
  | {
      readonly ok: false
      readonly errors: readonly string[]
      readonly message: string
    }
```

## Action mapping

Mapear `AdvisorActionType` para `BuildingType`:

```ts
build_road -> road
build_well -> well
build_farm -> farm
build_granary -> granary
build_market -> market
build_house -> house
wait -> no-op válido
```

Ações `wait` são válidas e não alteram a cidade.

## Validação

Criar função:

```ts
validatePlan(city: CityState, plan: AdvisorPlan, approvedBudget: number): PlanValidationResult
```

Regras:

1. `plan.estimatedCost` não pode exceder `approvedBudget`.
2. `plan.estimatedCost` não pode exceder `city.resources.money`.
3. Cada ação build precisa de `target`.
4. Target precisa estar dentro do mapa.
5. Target precisa estar livre.
6. Action type precisa ser suportada.
7. O custo calculado pelas ações deve bater com `plan.estimatedCost`.
8. Plano sem ações é inválido.

Não tentar validar pathfinding ou desirability nesta fase.

## Execução transacional simples

Criar função:

```ts
executePlan(city: CityState, plan: AdvisorPlan, approvedBudget: number): PlanExecutionResult
```

Fluxo:

1. Validar o plano inteiro antes de mutar a cidade.
2. Se inválido, não modificar cidade.
3. Se válido:
   - executar ações por ordem;
   - `wait` não faz nada;
   - build actions usam `placeBuilding` ou helper equivalente;
   - se qualquer execução falhar inesperadamente, retornar erro explícito.
4. Depois de executar builds, recalcular trabalhadores com `assignWorkers(city)`.
5. Retornar número de ações executadas e valor gasto.

### Nota sobre transação

Como toda validação acontece antes da execução e as regras são simples, isto é suficiente para a Fase 9.

Não implementar snapshot profundo/rollback complexo a menos que seja realmente necessário.

## Integração na UI

Atualizar `AdvisorPanel` para receber callbacks:

```ts
new AdvisorPanel(panelHost, () => city, {
  onApprovePlan: (plan) => execute + refresh UI/map
})
```

Ou interface equivalente.

Ao clicar `Approve`:

- executar o plano via `executePlan`;
- se sucesso:
  - mostrar mensagem com ações executadas e dinheiro gasto;
  - limpar plano ou mantê-lo marcado como executado;
  - atualizar mapa;
  - atualizar `BuildPanel`;
- se erro:
  - mostrar erros;
  - não alterar cidade.

Ao clicar `Reject`:

- manter comportamento atual: limpar plano.

## Atualização de Game.ts

`Game.ts` deve centralizar o refresh após execução:

- `assignWorkers(city)` se necessário;
- `map.refresh(city, { waterOverlay, foodOverlay })`;
- `resize()`;
- `panel.update(...)`;
- `app.render()`.

Não duplicar lógica excessiva; um helper local `refreshCity(message)` é aceitável.

## Testes obrigatórios

Seguir TDD: criar testes antes da implementação.

Testes mínimos:

1. plano válido com `build_well` executa, reduz dinheiro e ocupa target;
2. plano com tile ocupado é rejeitado e não altera dinheiro;
3. plano acima do orçamento aprovado é rejeitado;
4. plano acima do dinheiro disponível é rejeitado;
5. plano com `wait` é válido e não altera cidade/dinheiro;
6. plano com custo manipulado diferente da soma das ações é rejeitado.

## Critérios de aceitação

A Fase 9 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- existe `validatePlan`;
- existe `executePlan`;
- plano válido aprovado é executado;
- plano inválido é rejeitado antes de mutar cidade;
- dinheiro é atualizado corretamente;
- tile alvo fica ocupado pelo edifício correto;
- `Approve` na UI executa o plano aprovado;
- `Reject` continua a limpar o plano;
- cidade/mapa/painel são atualizados após execução;
- README documenta a Fase 9;
- não é feito browser testing.

## Verificação

Obrigatório:

```sh
npm run build
npm test
git status --short
```

## Decisões para evitar overengineering

- Sem LLM;
- Sem rollback complexo;
- Sem execução parcial silenciosa;
- Sem demolição;
- Sem pathfinding;
- Sem fila de planos;
- Sem persistência;
- Sem sistema genérico de comandos.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 9 com TDD;
2. preservar analyzer/advisor/simulação existentes;
3. adicionar testes de validator/executor;
4. correr build e testes;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados e evidência de verificação.
