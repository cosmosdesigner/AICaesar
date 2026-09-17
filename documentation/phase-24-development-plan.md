# AICaesar — Plano de Desenvolvimento da Fase 24

## Objetivo

Transformar o advisor de corretor reativo de um único problema num parceiro estratégico simples para vencer o cenário actual.

A fase deve manter o advisor local, determinístico e validado: sem LLM real obrigatório, sem novas ações perigosas, sem demolição automática, sem simulação especulativa profunda. O ganho principal é o plano passar a considerar objectivos do cenário, orçamento e sequência de ações, apresentando alternativas e trade-offs antes da aprovação.

```text
 jogador clica Analyze city
          ↓
 advisor recebe summary + issues + contexto do cenário
          ↓
 gera plano estratégico com orçamento e múltiplas ações validadas
          ↓
 UI mostra recomendação, alternativa curta e trade-offs
          ↓
 jogador aprova dentro do orçamento
          ↓
 executor valida tudo e aplica apenas ações suportadas
          ↓
 after-action compara intenção/promessa com resultado real
```

## Estado actual

- O advisor mock escolhe o primeiro problema do analyzer e normalmente devolve uma única ação;
- `AdvisorPlan` já suporta múltiplas ações, `estimatedCost`, `expectedImpact` e `risks`;
- `ActionValidator` já valida todos os targets, custos, ocupação, orçamento aprovado e dinheiro antes de executar;
- `ActionExecutor` já executa planos transacionais simples com ações `build_*` e `wait`;
- `AdvisorPanel` mostra cenário, raciocínio, ações, custo, impacto, riscos e after-action report;
- `Scenario.ts` avalia progresso do cenário e expõe contexto textual curto;
- o after-action report compara métricas antes/depois, mas ainda não compara promessa vs resultado;
- a Fase 23 adicionou demolição manual, mas o advisor continua proibido de demolir;
- o projecto usa TypeScript estrito, Vitest e não faz browser/manual UI testing.

## Escopo

### Inclui

- extensão pequena do modelo `AdvisorPlan` para suportar estratégia, orçamento recomendado, alternativas e critérios de sucesso;
- advisor mock estratégico que considera progresso do cenário, dinheiro, issues e objetivos restantes;
- planos com múltiplas ações quando isso for seguro e útil;
- comparação explícita entre plano recomendado e uma alternativa simples;
- trade-offs claros no painel do advisor;
- orçamento aprovado pelo jogador derivado do plano, sem input livre nesta fase;
- after-action report que referencia a intenção/promessa do plano e compara com deltas reais;
- validação reforçada para manter planos multi-ação transacionais, sem targets duplicados e sem custos manipulados;
- testes unitários para geração estratégica, validação multi-ação e after-action promise-vs-result;
- testes headless de integração do `AdvisorPanel`/`Game` onde já existirem seams;
- atualização do README e documentação.

### Exclui

- LLM real obrigatório, streaming, tool-calling ou chamadas de rede;
- novo provider externo ou secrets/API keys;
- demolição automática pelo advisor;
- ações novas além das atualmente suportadas (`build_*` e `wait`);
- drag/build em massa, blueprints ou execução parcial de plano;
- UI complexa para editar orçamento manualmente;
- simulação preditiva profunda ou lookahead de vários ticks;
- novos edifícios, walkers, pathfinding de unidades ou sistemas económicos novos;
- alterações ao schema de save/load;
- browser/manual UI testing.

## Decisões de comportamento

- O plano estratégico continua a ser um `AdvisorPlan` validado antes da execução;
- o advisor pode propor 2–4 ações, mas deve preferir menos ações quando o benefício é incerto;
- planos multi-ação só devem usar targets dentro do mapa, livres e distintos;
- a recomendação deve explicar qual objetivo do cenário pretende desbloquear;
- a alternativa pode ser textual e não executável nesta fase, desde que seja clara;
- o orçamento aprovado por defeito é o `estimatedCost` validado do plano;
- se o dinheiro for baixo, o advisor deve reduzir ambição ou recomendar wait;
- `wait` pode coexistir com análise estratégica, mas não deve ser usado para mascarar targets inválidos;
- o after-action report deve deixar claro que alguns benefícios dependem de ticks futuros;
- aprovação continua bloqueada quando o cenário terminou;
- Reject continua a limpar plano sem mutar cidade;
- Save/Load continua independente do advisor e não persiste plano/report.

## Modelo de dados proposto

Manter compatibilidade simples, adicionando campos opcionais ao `AdvisorPlan`:

```ts
interface AdvisorAlternative {
  readonly label: string;
  readonly summary: string;
  readonly tradeOffs: readonly string[];
}

interface AdvisorPlan {
  readonly summary: string;
  readonly reasoning: readonly string[];
  readonly actions: readonly AdvisorAction[];
  readonly estimatedCost: number;
  readonly expectedImpact: readonly string[];
  readonly risks: readonly string[];
  readonly strategicGoal?: string;
  readonly recommendedBudget?: number;
  readonly alternatives?: readonly AdvisorAlternative[];
  readonly successCriteria?: readonly string[];
}
```

Regras:

- providers antigos sem estes campos continuam válidos;
- validação de shape do provider deve aceitar campos opcionais apenas quando bem formados;
- `recommendedBudget`, quando presente, deve ser inteiro não negativo e não pode ser menor que `estimatedCost`;
- `successCriteria` deve ser texto explicativo, não uma condição executável;
- `alternatives` são comunicação para o jogador, não ações executadas.

## Estratégia do advisor mock

O mock deve continuar determinístico e pequeno.

Prioridade sugerida:

1. cenário terminal ou aprovação bloqueada: explicar que não há ação aprovada;
2. money baixo: preservar dinheiro e recomendar wait/estabilização;
3. falta de estrada em edifícios importantes: construir ligação simples quando houver target válido;
4. falta de água/comida para objetivo de cenário: propor sequência pequena que desbloqueie cobertura;
5. falta de workers/população: propor casa + serviço necessário apenas se orçamento permitir;
6. baixa desirability: explicar trade-off e manter wait ou melhoria manual, sem inventar actions não suportadas;
7. cidade estável mas objetivos incompletos: propor expansão pequena orientada ao objetivo mais atrasado;
8. cidade estável e perto de vitória: recomendar wait/observe se ticks futuros devem materializar benefícios.

O plano deve procurar targets livres próximos dos tiles afetados. Se não houver target válido seguro, deve devolver `wait` com razão explícita em vez de criar uma ação inválida.

## Integração com UI

O `AdvisorPanel` deve mostrar, quando presentes:

- objetivo estratégico;
- orçamento recomendado/aprovado;
- alternativas e trade-offs;
- critérios de sucesso;
- after-action com promessa vs resultado.

Manter layout simples: listas existentes são suficientes. Não criar um design system novo.

## After-action promise vs result

Ao aprovar um plano, guardar a intenção relevante do plano no report:

- `strategicGoal`;
- `expectedImpact`;
- `successCriteria`;
- custo prometido vs gasto real;
- deltas reais já existentes.

O report deve distinguir:

- efeitos imediatos observados após execução;
- efeitos esperados apenas após futuros ticks, como imigração, produção ou evolução de casas.

## Validação e segurança

Preservar explicitamente:

- executor transacional: ou o plano todo é válido antes de mutar, ou nada muda;
- orçamento e dinheiro disponíveis;
- custos calculados a partir de `BUILD_COSTS`, nunca confiando no texto do provider;
- targets distintos em planos multi-ação;
- ausência de demolição automática;
- ausência de chamadas de rede;
- ausência de alterações ao save schema;
- bloqueio de cenário terminal;
- invalidar plano/report quando a cidade muda por construção, demolição, load ou reset.

## Testes obrigatórios

Seguir TDD para lógica nova determinística.

Testes mínimos:

1. plano estratégico para cidade com falta de comida pode conter granary/farm/market quando houver orçamento e targets válidos;
2. plano multi-ação calcula `estimatedCost` pela soma real;
3. plano evita targets ocupados, fora do mapa ou duplicados;
4. dinheiro baixo gera plano reduzido ou wait sem ultrapassar orçamento;
5. objetivos do cenário aparecem em `strategicGoal`/reasoning;
6. alternativas e trade-offs são apresentados quando o plano é estratégico;
7. validator rejeita `recommendedBudget` menor que `estimatedCost` quando aplicável;
8. shape validation aceita planos legacy sem campos estratégicos;
9. after-action report inclui promessa/objetivo e deltas reais;
10. aprovação usa orçamento aprovado derivado do plano e continua bloqueada em cenário terminal;
11. Reject, Load, Reset e demolição invalidam plano/report;
12. Save/Load schema version 1 continua compatível;
13. `npm test` passa;
14. `npm run build` passa;
15. não é feito browser/manual UI testing.

## Critérios de aceitação

A Fase 24 está concluída quando:

- o advisor deixa de sugerir apenas uma correção local sempre que existe um objetivo de cenário melhor;
- planos podem ter múltiplas ações seguras e validadas;
- a UI mostra objetivo estratégico, orçamento, alternativa e trade-offs;
- o jogador consegue aprovar/rejeitar com confiança sem editar JSON ou abrir README;
- o executor continua a validar orçamento, custos, targets e dinheiro antes de mutar;
- after-action report compara intenção/promessa com resultado real;
- regressões de advisor, executor, cenário, save/load, demolição e renderer continuam a passar;
- `npm test` passa;
- `npm run build` passa;
- working tree fica limpo depois do commit/push.

## Decisões para evitar overengineering

- manter mock determinístico em vez de LLM real;
- usar campos opcionais no `AdvisorPlan` em vez de criar um novo aggregate;
- usar orçamento recomendado derivado do plano, sem input numérico livre;
- não adicionar novas actions nesta fase;
- não criar simulação preditiva profunda;
- não persistir plano/report no save;
- melhorar utilidade do advisor antes de introduzir autonomia maior.

## Entrega esperada do OMP

O OMP deve:

1. implementar exclusivamente a Fase 24;
2. seguir TDD para advisor estratégico, validação e after-action;
3. preservar as fases 1–23;
4. actualizar testes, README e UI necessários;
5. correr `npm test` e `npm run build`;
6. não usar browser testing;
7. não fazer commit ou push da implementação;
8. devolver resumo, ficheiros alterados e evidência de verificação.
