# AICaesar — Plano de Desenvolvimento da Fase 21

## Objetivo

Adicionar eventos e pressão de jogo sem transformar a simulação num sistema imprevisível ou difícil de testar.

A Fase 20 tornou o layout relevante através de desirability. A Fase 21 deve fazer com que a cidade também tenha de reagir a acontecimentos temporários:

```text
calendário determinístico + risco controlado
                    ↓
             warning → evento ativo
                    ↓
      impacto temporário na simulação
                    ↓
     mensagem + resposta do jogador/advisor
```

Resultado esperado:

- uma seca reduz temporariamente a produção das farms;
- uma epidemia reduz/abranda temporariamente a população;
- um incêndio desativa temporariamente um alvo urbano, sem demolição;
- o imperador pode pedir comida com prazo e recompensa/penalização;
- o jogador recebe warning antes de eventos severos quando aplicável;
- o advisor recebe contexto dos eventos e reage no plano;
- os mesmos inputs produzem sempre os mesmos eventos e impactos.

## Estado atual

- `CityState.simulation` contém apenas `tick`, finanças e `population.lastChange`;
- `simulateTick()` incrementa o tick, atribui workers, produz/reabastece comida, atualiza serviços/população/casas, reatribui workers e aplica finanças;
- farms produzem `FARM_FOOD_PER_TICK = 2` por tick quando ativas;
- população cresce em casas servidas e diminui em casas sem road/water/food;
- `ScenarioDefinition` define briefing, objetivos, limite de ticks e limite de dinheiro;
- `ScenarioPanel` mostra apenas objetivos e resultado;
- `BuildPanel` mostra issues do analyzer e estatísticas, mas não existe log de eventos;
- `AdvisorProvider` recebe somente `summary` e `issues`, sem contexto de eventos;
- não há sistema de goods além de comida armazenada em granaries/markets;
- não existem safety/prefecture, walkers, demolição, incêndio persistente ou save/load.

## Escopo

### Inclui

- módulo pequeno e determinístico de eventos, por exemplo `src/events/Events.ts`;
- estado serializável de eventos dentro de `SimulationState`;
- definições de eventos com id, tipo, trigger, warning, duração, mensagem e impacto;
- calendário inicial do cenário `Founding Settlement`;
- pseudo-aleatoriedade opcional baseada em seed explícita, sem `Math.random()` nem relógio real;
- warnings e mensagens recentes de eventos;
- seca com redução temporária da produção das farms;
- epidemia com perda inicial limitada e bloqueio temporário do crescimento populacional;
- incêndio/risco urbano simples que desativa temporariamente um workplace elegível;
- pedido do imperador de comida, com prazo, botão para cumprir, recompensa e penalização por falha;
- resolução determinística de pedidos e eventos expirados;
- painel HTML de eventos/pedido, com botão `Fulfil request` apenas quando existe pedido pendente;
- issues do analyzer para pressão ativa e pedido próximo do prazo;
- contexto de eventos no advisor mock/provider, sem novas advisor actions;
- testes unitários das regras, regressão de simulação e teste headless do lifecycle da UI;
- atualização do README e da documentação de assets apenas se necessário.

### Exclui

- combate, bárbaros, exército, crime ou sistema de safety/prefecture;
- destruição ou demolição de edifícios;
- walkers, cidadãos individuais ou pathfinding;
- múltiplos goods, comércio externo real ou trade routes;
- sistema geral de clima, calendário histórico ou preços dinâmicos;
- save/load;
- LLM real, novas tools ou novas actions do advisor;
- eventos infinitos sem limite, timers fora de `simulateTick()` ou dependência de tempo de parede;
- notificações externas;
- browser/manual UI testing.

## Modelo de estado

Adicionar a `SimulationState` uma estrutura simples e mutável, mas sem guardar scores derivados da cidade:

```ts
interface EventState {
  readonly seed: number;
  active: CityEvent[];
  history: EventMessage[];
  pendingRequest?: ImperialRequest;
}

interface CityEvent {
  readonly id: string;
  readonly type: 'drought' | 'epidemic' | 'fire';
  readonly status: 'warning' | 'active';
  readonly warningTick?: number;
  readonly startTick: number;
  readonly endTick: number;
  readonly message: string;
  readonly targetBuildingId?: string;
}

interface ImperialRequest {
  readonly id: string;
  readonly requestedFood: number;
  readonly issuedTick: number;
  readonly dueTick: number;
  readonly rewardMoney: number;
  readonly failurePenalty: number;
  status: 'pending' | 'fulfilled' | 'failed';
}
```

Os nomes podem ser ajustados pelo OMP, mas as propriedades observáveis devem existir. O estado deve ser composto por dados simples, sem referências a objetos PixiJS, callbacks ou `Date`.

Regras de compatibilidade:

- `createCityState()` inicializa um `EventState` vazio com seed fixa;
- `Reset` cria uma cidade nova e limpa active events, pending request e history;
- nenhuma informação derivada permanente deve ser adicionada a buildings;
- o estado dos eventos não pode alterar custos de construção nem inventários fora dos impactos definidos;
- edifícios desativados por incêndio continuam existentes e recuperam funcionamento quando o evento termina;
- `active` calculado por workers continua a ser recalculado por `assignWorkers()`; incêndio deve ser uma condição adicional de activação, não uma mutação permanente do campo `active`.

## Definições e calendário

Criar definições explícitas para o cenário atual. A forma exacta fica ao critério do OMP, mas deve suportar um calendário semelhante a:

```text
seca:
  warning: tick 24
  start: tick 30
  end: tick 45
  produção de farm: 50%

epidemia:
  warning: tick 54
  start: tick 60
  end: tick 72
  crescimento populacional bloqueado durante o evento
  perda inicial: no máximo 1 residente por casa ocupada

pedido do imperador:
  issue: tick 78
  prazo: tick 96
  pedido: 10 food
  sucesso: +35 money
  falha: -25 money

incêndio controlado:
  janela de risco a partir de tick 90
  duração: 8 ticks
  alvo: workplace elegível escolhido por y/x/id
```

Os valores são defaults de protótipo, não um contrato de balanceamento. O OMP pode ajustar ticks/valores se a seed ou o cenário ficarem impossíveis, mas deve preservar a ordem dos eventos, a existência de warning e a pressão moderada.

O calendário deve ser configurável por definição de cenário ou por uma constante claramente isolada. Não hardcodar condições espalhadas por `Simulation.ts` e `Game.ts`.

Para risco aleatório controlado:

- usar seed fixa e uma função pseudo-aleatória determinística derivada de `seed`, `event id` e `tick`;
- permitir desligar o risco aleatório nos testes ou injectar a seed;
- cada evento deve ter idempotência por id/tick: o mesmo evento não pode ser criado repetidamente em cada tick;
- não usar `Math.random()`, `Date.now()` ou intervalos independentes do relógio da simulação;
- a seed inicial deve produzir um fluxo jogável e reproduzível.

## Regras dos eventos

### Ciclo warning → active → resolved

`advanceEvents(city)` deve ser chamado uma vez por tick, depois de incrementar `simulation.tick` e antes da produção/população.

Em cada tick deve:

1. publicar warnings cujo `warningTick` chegou;
2. activar eventos cujo `startTick` chegou;
3. aplicar efeitos one-shot apenas na transição para `active`;
4. manter efeitos temporários enquanto `tick < endTick`;
5. resolver/remover eventos expirados e publicar a mensagem de resolução;
6. emitir/actualizar pedidos do imperador;
7. marcar pedidos vencidos como `failed` e aplicar a penalização uma única vez.

A ordem de mensagens e a ordenação de eventos devem ser determinísticas por `tick`, tipo e id. Limitar o history visível a uma quantidade pequena, por exemplo 8–12 mensagens, sem apagar o estado necessário para evitar re-disparos.

### Seca

- enquanto existir uma seca activa, cada farm activa produz `floor(FARM_FOOD_PER_TICK * multiplier)`;
- multiplier default: `0.5`;
- nunca produzir valor negativo;
- não desactivar farms nem alterar workers por causa da seca;
- ao terminar, a produção normaliza automaticamente;
- a mensagem deve indicar início e fim e mostrar o impacto de produção.

### Epidemia

- na activação, cada casa ocupada perde no máximo 1 residente, de forma determinística por y/x/id;
- enquanto activa, casas não aplicam crescimento positivo de população;
- a emigração normal por falta de serviços continua a respeitar os intervalos existentes;
- não alterar capacidade, nível ou `hasFood`/`hasWater` directamente;
- ao terminar, o crescimento normal volta a ser possível;
- `population.lastChange` deve incluir a perda causada pela epidemia, tal como inclui as restantes alterações de residentes do tick.

A implementação não deve criar cura, hospital ou doença persistente nesta fase.

### Incêndio e risco urbano

- incêndio é uma pressão simples, não um sistema de destruição;
- escolher no máximo um alvo elegível, de forma determinística, preferindo workplaces existentes ordenados por y/x/id;
- durante o evento, o alvo fica temporariamente impedido de produzir, armazenar ou distribuir;
- a unidade não é demolida e o seu inventário é preservado;
- se não houver alvo elegível, publicar uma mensagem sem efeito e não falhar o tick;
- `assignWorkers`, `produceFood`, `restockMarkets` e stats devem tratar o alvo como temporariamente suprimido;
- upkeep mantém as regras existentes, tal como acontece com workplaces sem workers;
- não adicionar repairs, engineers, fire station ou safety buildings.

O risco pode ser calculado com um indicador mínimo e explicável, por exemplo maior quando existem vários workplaces económicos adjacentes, mas o evento default deve continuar controlado. Se esta heurística ameaçar a determinismo ou a jogabilidade, preferir um incêndio calendarizado com alvo determinístico.

### Pedido do imperador

Nesta fase existe apenas o good `food`, correspondente à soma do stock actual de granaries e markets.

- o pedido pendente é visível com quantidade, tick de emissão, prazo e recompensa/penalização;
- `fulfillImperialRequest(city)` só tem sucesso se o pedido estiver pendente e existir stock suficiente;
- ao cumprir, consumir exactamente a quantidade pedida, por ordem determinística (granaries e depois markets, y/x/id), e creditar a recompensa;
- cumprir duas vezes é rejeitado sem nova recompensa;
- se o prazo chegar sem cumprimento, marcar como falhado e descontar a penalização uma única vez;
- a falha não deve destruir stock;
- não criar um sistema de favor, comércio ou novo tipo de goods;
- se a implementação optar por pedir ao jogador confirmação antes de consumir stock, o botão deve tornar o efeito explícito.

## Ordem da simulação

Preservar a ordem da Fase 20, acrescentando o ciclo de eventos:

1. incrementar `simulation.tick`;
2. avançar eventos, warnings, activações, expirações e pedidos;
3. derivar rede principal;
4. atribuir workers a workplaces ligados e não suprimidos por incêndio;
5. produzir comida com eventual multiplicador de seca;
6. reabastecer markets;
7. calcular água/comida/desirability;
8. actualizar serviços, níveis e população das houses;
9. aplicar bloqueio de crescimento/efeito de epidemia conforme evento activo;
10. limitar população à capacidade;
11. guardar `simulation.population.lastChange` incluindo efeitos de evento;
12. reatribuir workers;
13. aplicar finanças quando o tick for múltiplo de 10.

`applyFinancePeriod()` não deve ser reescrito para criar regras especiais de eventos. Penalizações de pedidos são transacções de evento no tick de vencimento e devem ser distinguidas nas mensagens.

## UI e feedback

Criar um `EventPanel` pequeno ou estender um painel existente, sem nova framework.

Mostrar pelo menos:

```text
Events
- Drought warning: starts in 6 ticks
- Epidemic active: population growth suspended (8 ticks remaining)

Imperial request
- Deliver 10 food by tick 96
- Reward: +35 money | Failure: -25 money
[ Fulfil request ]

Recent messages
- Drought ended; farm production restored.
```

Requisitos:

- warnings são visualmente diferentes de eventos activos e resolvidos;
- o pedido pendente mostra prazo e estado;
- o botão de cumprimento fica disabled quando não há pedido ou stock suficiente, com feedback explicativo;
- mensagens são actualizadas depois de tick, reset e cumprimento do pedido;
- reset limpa o painel e restaura o calendário inicial;
- preservar pausa, velocidade, pan/zoom, overlays, construção, scenario panel e advisor;
- não usar browser testing; cobrir lifecycle/destroy e callbacks com testes headless quando o painel for integrado em `Game.ts`.

## Analyzer e advisor

Adicionar ao analyzer apenas os problemas necessários para tornar pressão accionável, por exemplo:

- `event_active`: seca, epidemia ou incêndio activo, com severity `medium` por defeito e `high` apenas quando o impacto for severo;
- `imperial_request`: pedido pendente, severity `medium`, subindo para `high` quando faltarem poucos ticks para o prazo ou não existir stock suficiente.

Cada issue deve conter:

- tipo e severidade;
- affected tiles do alvo quando aplicável, em y/x/id;
- explicação do impacto actual;
- causa e tempo restante;
- ordenação estável com as issues existentes.

O summary enviado ao advisor deve incluir contexto compacto, não o estado bruto:

```ts
interface EventSummary {
  readonly id: string;
  readonly type: string;
  readonly status: 'warning' | 'active';
  readonly ticksRemaining?: number;
  readonly targetBuildingId?: string;
}
```

Estender `AdvisorProviderInput` com events/request summary ou adicionar campos opcionais equivalentes, mantendo compatibilidade clara entre Mock e LLM provider.

O mock advisor deve:

- mencionar uma seca activa e recomendar conservar/observar stock;
- mencionar epidemia activa e explicar que crescimento está temporariamente bloqueado;
- mencionar incêndio e indicar que o alvo recuperará, sem sugerir demolição;
- mencionar pedido do imperador, prazo e stock disponível;
- continuar a usar apenas actions já suportadas (`build_*` e `wait`);
- não inventar uma action `fulfill_request` nesta fase. O cumprimento é uma decisão explícita no painel.

O LLM provider, se continuar presente, deve receber o novo resumo estruturado e manter validação/execução exactamente como antes. Não adicionar chamadas de rede.

## Testes obrigatórios

Seguir TDD para o módulo de eventos e alterações determinísticas. Os testes novos devem ser escritos e executados em RED antes do código de produção, quando a infraestrutura permitir.

Testes mínimos:

1. `createCityState()` inicializa event state vazio e seed fixa;
2. warning aparece no tick correcto e só uma vez;
3. evento activa e expira nos ticks definidos;
4. mesma seed e mesma cidade produzem a mesma sequência de eventos/mensagens;
5. seca reduz produção durante a duração e restaura depois;
6. seca nunca produz comida negativa;
7. epidemia reduz no máximo 1 residente por casa na activação;
8. epidemia bloqueia crescimento apenas enquanto activa;
9. `population.lastChange` inclui perdas da epidemia;
10. incêndio escolhe alvo deterministicamente;
11. incêndio suprime temporariamente produção/armazenamento/distribuição;
12. inventário do alvo não é perdido e o alvo recupera após expiração;
13. incêndio sem alvo não quebra o tick;
14. pedido aparece no tick definido com prazo e valores correctos;
15. pedido é cumprido consumindo exactamente food e pagando recompensa;
16. pedido sem stock é rejeitado sem mutação;
17. pedido expirado penaliza uma única vez e não consome stock;
18. reset limpa eventos, mensagens e pedidos;
19. analyzer ordena e reporta `event_active`/`imperial_request` deterministicamente;
20. advisor mock reage a evento/pedido sem novas actions;
21. `AdvisorProvider`/fallback continuam a validar planos com contexto de eventos;
22. EventPanel actualiza e destrói listeners/DOM sem leaks;
23. regressão completa de desirability, road network, food logistics, population, finance, scenario, advisor, actions e renderer;
24. `npm run build` e `npm test` passam sem browser testing.

## Critérios de aceitação

A Fase 21 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- existe um ciclo determinístico warning → active → resolved;
- existe pelo menos uma seca, uma epidemia, um incêndio controlado e um pedido do imperador no calendário jogável;
- seca reduz temporariamente produção de farms;
- epidemia pressiona população sem criar sistema de doença permanente;
- incêndio afecta temporariamente um workplace sem destruir edifícios/inventário;
- pedido pode ser cumprido pelo jogador ou falha com penalização explícita;
- warnings e mensagens são visíveis no painel;
- analyzer reporta pressão activa e pedidos relevantes;
- advisor reage usando contexto estruturado e sem novas actions;
- reset, pausa, velocidade, navegação, overlays, cenário e approval flow continuam a funcionar;
- não são adicionados walkers, combate, safety/prefecture, save/load, múltiplos goods, dependências novas ou browser testing;
- working tree fica limpo depois do commit/push.

## Decisões para evitar overengineering

- tick da simulação é o único relógio;
- schedule explícito e pseudo-aleatoriedade com seed, nunca randomness global;
- quatro situações de pressão, não um event engine genérico;
- estado plano e serializável, sem callbacks ou referências ao renderer;
- food é o único good do pedido;
- incêndio desactiva temporariamente, não destrói;
- epidemia bloqueia crescimento e aplica uma perda limitada, sem saúde/hospitais;
- mensagens recentes têm limite pequeno;
- sem novas advisor actions;
- sem novos edifícios;
- sem dependências novas;
- sem browser testing.

## Entrega esperada do OMP

O OMP deve:

1. implementar exclusivamente a Fase 21;
2. seguir TDD para o scheduler, impactos de simulação e pedido;
3. preservar as fases 1–20;
4. actualizar testes, README, analyzer, advisor e UI necessários;
5. correr `npm run build` e `npm test`;
6. não usar browser testing;
7. devolver resumo, ficheiros alterados e evidência de verificação.
