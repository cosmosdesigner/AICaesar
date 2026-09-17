# AICaesar

**Fase 21 — eventos e pressão de jogo**: mapa isométrico 30×30, construção manual de roads/houses/wells/farms/granaries/markets e amenities garden/plaza/fountain, rede principal e serviços por distância BFS em estradas, desirability local determinística, população, workers, finanças, eventos temporários determinísticos, pedidos do imperador, cenário, advisor mock local, execução transaccional validada de planos aprovados e overlays de água/comida/rede viária/desirability.

## Executar localmente

Requer Node.js 20.19+ na linha 20, ou Node.js 22.12+ (recomendado: uma versão LTS compatível), e npm.

```sh
npm install
npm run dev
```

Abrir o endereço local apresentado pelo Vite (normalmente `http://localhost:5173`). O browser precisa de WebGL. Todos os sprites são locais; não há chamadas a serviços externos na aplicação. A instalação de dependências requer acesso ao registry npm.

```sh
npm run build
npm test
npm run preview
```

`build` verifica TypeScript em modo estrito e gera `dist/`; `test` executa as regressões Vitest do seed inicial, cenário, câmara, renderer, rede viária/BFS, analyzer, advisor, ações, evolução/degradação de casas, desirability, logística de comida, população e economia financeira. `preview` serve esse build localmente. `node_modules/` e `dist/` estão ignorados pelo Git. **O build é apenas para validação local: inclui assets temporários e não deve ser publicado.** Browser/manual UI testing está fora do escopo da Fase 20; renderer e integração do jogo usam regressões automatizadas headless.

## O que aparece

- 900 tiles de relva numa grelha lógica 30×30.
- Uma estrada central de 20 tiles, oito casas, um poço, uma farm, uma granary e um market, seedados de forma determinística e gratuitos.
- Casas começam no nível 1; as oito casas seedadas começam cheias, com 4 habitantes cada (32 no total), enquanto casas construídas pelo jogador ou advisor começam vazias. Casas ligadas à rede principal e com cobertura de água evoluem para nível 2 após 3 ticks de serviço.
- População é o número de residentes atuais, não a capacidade: os níveis 1/2/3 permitem **4/8/14** habitantes por casa. Evoluir abre vagas sem criar residentes automaticamente.
- Em ticks globais múltiplos de **3**, cada casa com estrada + água + comida ganha 1 habitante até à capacidade; em ticks globais múltiplos de **5**, cada casa à qual falte qualquer um desses serviços perde 1 habitante até zero. Não são contadores individuais desde a construção ou desde a chegada dos serviços.
- A degradação limita imediatamente os residentes à nova capacidade. O saldo populacional do último tick inclui tanto imigração/emigração como perdas por esse limite.
- A força de trabalho disponível é `floor(população atual × 0.5)`; farms exigem 6 trabalhadores, granaries 4 e markets 5. Construir uma casa vazia não disponibiliza workers imediatamente.
- A atribuição é determinística por tick: granaries primeiro, depois farms e markets; workplaces isolados ou sem trabalhadores suficientes ficam inativos. Workers são atribuídos antes da logística de comida e novamente após a atualização populacional, ficando disponíveis no mesmo tick em que os residentes chegam. Workplaces isolados continuam a contar nos trabalhadores necessários.
- Só farms ativas produzem 2 unidades de comida por tick; só granaries ativas disponibilizam 100 de capacidade; só markets ativos com stock cobrem casas ligadas à rede até 4 passos de estrada.
- Casas com estrada+água evoluem para nível 2 após 3 ticks. Para evoluir do nível 2 para o 3 após 5 ticks, também exigem comida e desirability boa (`>= 60`). Desirability média (`40–59`) mantém nível 2; desirability baixa (`< 40`) degrada casas de nível 2 ou 3 após 4 ticks, mesmo com os restantes serviços.
- A cada **10 ticks**, após atualizar população e workers, o balanço financeiro aplica impostos de casas menos upkeep de serviços/economia: casas cheias nível 1/2/3 rendem **2/4/7** por período, casas vazias rendem **0** e casas parcialmente ocupadas rendem `ceil(imposto da casa cheia × população / capacidade)`; well/farm/granary/market custam **1/3/3/3** por período; roads e houses não têm upkeep.
- Workplaces inativos continuam a pagar upkeep. O dinheiro pode ficar negativo por balanço financeiro, mas novas construções continuam bloqueadas quando o saldo não cobre o custo.
- Overlays opcionais de água e comida mostram roads alcançadas por poços ligados e markets ativos com stock, mais edifícios existentes ortogonalmente adjacentes a essas roads; não pintam terreno vazio vizinho. No overlay de comida, casas sem comida recebem tint laranja. **Show road network: Off/On** distingue roads da rede principal (verde) de roads isoladas (laranja). **Show desirability: Off/On** pinta todos os tiles: verde `>= 60`, laranja `40–59` e vermelho `< 40`.
- O painel **Simulation** mostra **Running/Paused**, botão **Pause/Play** e velocidades **1x**, **2x** e **4x**; overlays, construção e painel financeiro continuam disponíveis quando pausado.
- O painel **Finance** mostra período, impostos, upkeep, net, treasury e ticks até ao próximo balanço.
- O painel mostra **Avg desirability**, **Low desirability houses** e **Good desirability houses**, todos derivados do estado atual.
- O painel mostra **Road network** (tiles da componente principal), **Connected buildings** (ligados/total, excluindo roads) e **Isolated buildings**. Os valores são derivados da cidade atual e não dependem da ordem de inserção.
- Botões principais têm `title` simples para explicar construção, overlays, análise, aprovação, rejeição, reset, pausa/play e velocidade.
- O analyzer determinístico resume tick, dinheiro, casas, água, comida e emprego, e gera issues ordenadas por severidade, tipo estável e número de tiles afetados. A issue `low_desirability` informa casas com score baixo, proximidade excessiva a farms/granaries/markets e ausência de amenities.
- O painel mostra os 3 principais problemas detetados, incluindo baixa desirability, falta de água/comida, falta de produção/distribuição de comida, falta de trabalhadores, edifícios económicos sem estrada e dinheiro baixo; sem issues, mostra que não há problemas críticos.
- O painel Advisor tem botão **Analyze city**; gera um `AdvisorPlan` de forma assíncrona via `AdvisorProvider`, mostra contexto determinístico do cenário sem enviar trabalho extra ao provider, mostra o provider usado (`mock` por defeito local, ou fallback quando configurado) e apresenta resumo, raciocínio, ações, custo estimado, impactos esperados e riscos. **Approve** valida orçamento aprovado, dinheiro, tipo, target, limites do mapa, ocupação e custo antes de executar builds via `placeBuilding`; quando a execução é bem-sucedida, mostra um after-action report com ações executadas, gasto, deltas de métricas reais e até 3 problemas remanescentes. **wait** é no-op válido; **Reject** limpa o plano. Com vitória/derrota, aprovação fica bloqueada até **Reset**.
- Sprites reais da Caesaria, alinhados pela base do tile e ordenados de trás para a frente; casas nível 2 recebem tint clara e nível 3 tint verde. Garden, plaza e fountain reutilizam temporariamente sprites de farm, market e well, respetivamente, com tint verde/dourado/azul.
- Câmara centrada/enquadrada no arranque e em **Reset**; redimensionamento, construção, overlays, ticks e advisor preservam pan/zoom atuais.
- Painel **Map navigation** com **Zoom in**, **Zoom out** e **Center map**, tooltips e ajuda curta: `Pan: middle-drag or Space + left-drag`; `Zoom: mouse wheel or controls`. O zoom da câmara é limitado a **2x** para não ampliar em excesso os sprites temporários de baixa resolução.


## Eventos e pressão de jogo

A simulação usa apenas o relógio de ticks e um calendário com seed fixa (`21`), por isso o mesmo estado produz sempre os mesmos warnings, eventos e impactos. O fluxo é `warning → active → resolved`; o Reset limpa o estado e as mensagens.

- Uma **drought** publica warning no tick 24, decorre nos ticks 30–44 e reduz a produção das farms para 50%; a produção normaliza no fim.
- Uma **epidemic** publica warning no tick 54, decorre nos ticks 60–71, remove no máximo um residente por casa ocupada ao iniciar e suspende crescimento durante o evento.
- Um **imperial request** é emitido no tick 78: pede 10 food até ao tick 96, paga +35 money se cumprido e aplica -25 money se falhar. O botão **Fulfil request** consome primeiro stock de granaries e depois de markets, em ordem determinística.
- Um **fire** publica warning no tick 84 e, nos ticks 90–97, suprime temporariamente o primeiro workplace por posição. Não destrói o edifício nem o inventário; a actividade é restaurada ao terminar.
- O painel **Events** mostra warnings, eventos activos, prazo/stock do pedido e as mensagens recentes. O analyzer e o advisor mock incluem a pressão actual, mas o advisor não recebe novas actions.

Estes eventos são pressão moderada de protótipo; não existem ainda combate, safety/prefecture, walkers, múltiplos goods, comércio externo ou save/load.

## Demo rápido de 5 minutos

1. Abrir a app e observar o seed: estrada central, casas, poço, farm, granary e market já existem sem custo inicial.
2. Ler o painel **Found a functioning settlement**: o cenário começa **Active** e mostra quantos objetivos já estão completos.
3. Usar **Pause** para parar os ticks; **Show road network** distingue a rede principal das roads isoladas, **Show water coverage**/**Show food coverage** mostram o alcance efetivo ao longo dessa rede e **Show desirability** mostra onde amenities ou edifícios económicos alteram qualidade urbana.
4. Voltar a **Play** em **1x**, depois experimentar **2x** ou **4x** para acelerar produção, consumo, upgrades e avanço do limite de 900 ticks.
5. Construir casas/serviços em tiles vazios e usar **Analyze city**/**Approve** para executar um plano validado. O advisor mostra a meta restante principal do cenário. Casas novas aumentam vagas, não residentes: observar os serviços e esperar pelos ticks de imigração para ganhar população/workers.
6. Se todos os objetivos passarem, o estado vira **Victory**; se dinheiro cair abaixo de 50, inclusive por upkeep periódico, ou chegar ao tick 900 sem vitória, vira **Defeat**. Em ambos os casos, ticks, construção e aprovação ficam bloqueados.
7. Clicar **Reset** para restaurar dinheiro, stocks de granary/market, tick 0, estado financeiro vazio, cidade seedada com 32 residentes e saldo populacional do último tick 0, e cenário **Active**; pausa/velocidade ficam como estão para facilitar nova demonstração.

## Construção manual

- Dinheiro inicial: **500** em `resources.money`; comida começa **0** em `storedFood` dos granaries e markets, sem stock global em recursos.
- Selecionar **Road (4)**, **House (20)**, **Well (35)**, **Farm (45)**, **Granary (60)**, **Market (50)**, **Garden (12)**, **Plaza (25)** ou **Fountain (40)** no painel; Road começa selecionada. Amenities não exigem workers, comida, storedFood, atividade ou população.
- Clicar com o botão principal num tile vazio para construir. O dinheiro diminui pelo custo indicado.
- Cada construção cria um `Building { id, type, x, y }`; só casas guardam `population` (inteiro não negativo), além de `level`, `hasRoadAccess`, `hasWater`, `hasFood`, `upgradeProgress` e `degradeProgress`; workplaces (`farm`, `granary`, `market`) guardam `active`; granaries e markets guardam `storedFood` real. Casas novas têm `population: 0`.
- Casas usam `src/simulation/HouseSpecification.ts` como única fonte de capacidade, imposto de ocupação completa, requisitos e ticks de evolução dos níveis 1–3: nível 1 tem capacidade 4/imposto máximo 2 sem requisitos de nível, nível 2 capacidade 8/imposto máximo 4 com estrada+água e 3 ticks, nível 3 capacidade 14/imposto máximo 7 com estrada+água+comida+desirability boa e 5 ticks. `src/simulation/Desirability.ts` deriva score 0–100 sem cache persistente: base 50; garden `+8`/raio 2, plaza `+12`/raio 3, fountain `+15`/raio 3, farm `-10`/raio 3, granary `-12`/raio 3 e market `-6`/raio 2, usando distância Manhattan inclusiva e stacking sem falloff. Score `< 40` degrada a casa; apenas `>= 60` permite nível 3. A capacidade e o score não são guardados no `Building`.
- Farms ativas depositam 2 comida/tick em granaries ativos (capacidade 100). Markets ativos procuram granaries ativos até 8 passos de estrada, reabastecem até 4/tick, têm capacidade 40 e só dão cobertura de comida até 4 passos de estrada quando `storedFood > 0`; casas consomem do market servido a cada 2 ticks. Todos os participantes têm de estar ligados à rede principal.
- O painel mostra dinheiro, ferramenta selecionada, tick, estatísticas de casas/água/comida, **Avg/Low/Good desirability**, stock de granary, stock/demand de market, markets abastecidos, resumo de requisitos de casas, casas em degradação, população, emprego, finanças, toggles de overlay com labels claros, feedback da última ação e estado do cenário.
- Tiles ocupados, coordenadas fora do mapa, dinheiro insuficiente e cenário terminado são rejeitados sem alterar cidade, saldo ou comida armazenada. O balanço financeiro pode tornar o saldo negativo; `placeBuilding` continua a validar o saldo disponível antes de construir.
- **Reset** recria `CityState`, restaurando tiles, `buildings[]`, `resources.money`, `simulation.tick`, `simulation.finance`, edifícios iniciais com `storedFood: 0`, casas seedadas cheias no nível 1, `simulation.population.lastChange: 0`, estado ativo/inativo recalculado e cenário **Active**; scores, stats e overlay de desirability são recalculados, nunca restaurados de estado derivado. Mantém a ferramenta selecionada, os estados dos overlays e a configuração atual de pausa/velocidade.

O mapa completo é redesenhado após construção válida, execução válida do advisor, reset, tick de simulação ou toggle de overlay; redimensionamento preserva o mapa e reaplica a câmara. Workplaces inativos aparecem com alpha reduzido e tint vermelho/cinzento. Pan usa botão do meio ou **Space** + drag esquerdo sem construir ao soltar; zoom usa roda do rato ou botões e respeita limites. Não há rotação, demolição, cidadãos individuais, walkers/pathfinding de unidades, commute, salários, tax collectors, nascimento/morte, classes sociais, mini-map, inércia de câmara, múltiplos tipos de comida, backend, chamada real de LLM por defeito, secrets/API keys, streaming, tool-calling, rollback histórico, execução parcial de plano, save/load, eventos, crime, fogo, doença ou safety/prefecture.

Verificação manual: construir Road num tile vazio (saldo 496), selecionar House e clicar no mesmo tile (erro, saldo 496), construir Farm, Granary e Market em tiles vazios. Construir uma House aumenta capacidade/vagas, mas não residentes ou workers imediatamente. Com poucas casas ocupadas e workplaces demais, alguns workplaces ficam inativos; farms inativas não produzem, granaries inativas não recebem/fornecem stock e markets inativos ou vazios não dão cobertura de comida, mas todos continuam a pagar upkeep a cada 10 ticks. Inventários de edifícios inativos são preservados até voltarem a poder ser usados. Reset deve restaurar saldo 500, stocks 0, tick 0, período financeiro 0, 32 residentes em 32 lugares, saldo populacional 0 e a cidade seedada.

## Rede de estradas e alcance de serviços

- `src/simulation/RoadNetwork.ts` deriva a rede das tiles ocupadas por `road`, usando apenas vizinhos ortogonais (N/E/S/W), nunca diagonais. A **rede principal** é a maior componente; empates escolhem a componente cujo primeiro tile por **y/x** vem antes, independentemente da ordem de inserção. Sem roads, a rede e a cobertura ficam vazias e nenhum edifício tem acesso viário.
- Um edifício não-road está ligado quando toca ortogonalmente pelo menos uma road principal. Estar perto, ou tocar uma road isolada, não basta. Houses isoladas não têm road access; farms, granaries e markets isolados ficam inativos, não recebem workers nem participam na produção/armazenamento/distribuição; wells isolados não fornecem água. Inventários existentes são preservados.
- A distância é o menor caminho BFS multi-source entre as roads principais adjacentes à origem e ao destino. Conta apenas **passos entre road tiles**, excluindo entrar/sair dos edifícios. Edifícios que partilham uma road adjacente têm distância **0**; endpoints sem ligação não têm distância válida.
- Os limites inclusivos continuam em `Simulation.ts`: `WATER_RADIUS = 3`, `MARKET_SUPPLY_RADIUS = 8` e `MARKET_FOOD_RADIUS = 4`, agora em passos de estrada. Produção e stock mantêm `FARM_FOOD_PER_TICK = 2`, capacidade de granary **100**, capacidade de market **40**, reabastecimento **4/tick** e consumo **1/casa a cada 2 ticks**.
- A cobertura visual de água/comida contém apenas roads principais alcançadas dentro do limite e **edifícios existentes** ortogonalmente adjacentes a essas roads. Não é um raio Manhattan nem uma previsão de cobertura para terreno vazio; proximidade por si só não serve uma casa.
- Farm → granary continua abstrato, sem limite de distância entre participantes ligados; granary → market e market → house respeitam os limites BFS. Redes, cobertura, desirability e respetivas stats são derivados, nunca persistidos em `CityState`. Não há walkers, tráfego, capacidade viária ou novas actions do advisor.
- Construir uma ligação pode unir componentes ou mudar qual é a principal: stats, atividade e cobertura acompanham a cidade atual. Refreshes e toggles preservam pan/zoom; apenas arranque, **Center map** e **Reset** reenquadram a câmara, e Reset mantém os quatro toggles.

## Cenário

`FOUNDING_SETTLEMENT_SCENARIO` vive em `src/scenario/Scenario.ts`. A definição é imutável e `evaluateScenario(city, definition)` deriva progresso apenas de `CityState`: residentes atuais por `getWorkforceStats`, água/comida como percentagem de casas, falta de trabalhadores como percentagem de workers required (0% quando `workersRequired === 0`) e dinheiro por `resources.money`. Construir casas vazias não avança o objetivo de população nem resolve worker shortage imediatamente; esses valores mudam à medida que chegam ou saem residentes. Vitória exige todos os objetivos no mesmo tick. Derrota ocorre com `money < 50` ou `simulation.tick >= 900` sem vitória. Ao terminar, `Game.ts` pausa a simulação, bloqueia construção manual e bloqueia aprovação do advisor; **Reset** volta a avaliar uma cidade nova como **Active**.

## Advisor, providers e execução de ações

`AdvisorProvider` vive em `src/advisor/AdvisorProvider.ts` e recebe apenas `{ summary: CityStateSummary, issues: CityIssue[] }`. `MockAdvisorProvider` é o provider local por defeito e reutiliza a lógica determinística do mock; `LLMAdvisorProvider` recebe um `LLMPlanClient` injetado, constrói prompt só com summary/issues, tipos permitidos e formato JSON esperado, valida o JSON devolvido como `AdvisorPlan` e não faz rede sem um client externo. `createSafeAdvisorProvider(primary, fallback)` chama o fallback mock quando o provider primário lança erro, devolve erro ou retorna plano com shape inválido; o resultado indica o provider efetivamente usado.

`validatePlan(city, plan, approvedBudget)` e `executePlan(city, plan, approvedBudget)` vivem em `src/actions/`. O validator rejeita planos sem ações, tipos não suportados, targets ausentes, coordenadas fora do mapa, tiles ocupados, custo manipulado, orçamento insuficiente e dinheiro insuficiente sem mutar a cidade. O executor só muta depois de validar o plano completo; ações `build_*` são mapeadas para edifícios existentes e `wait` não altera dinheiro, tiles ou simulação. Texto vindo de LLM nunca é executado diretamente e nunca substitui `ActionValidator`/`ActionExecutor`.

`createCityMetricsSnapshot(city)` e `createAfterActionReport(...)` vivem em `src/advisor/AfterActionReport.ts`. O snapshot registra dinheiro, comida/capacidade, cobertura de casas por água/comida, níveis de casas, população, trabalhadores, workplaces ativos/inativos e contagem de issues. `approveAdvisorPlan(city, plan)` captura snapshot antes da execução, executa via `ActionExecutor`, captura snapshot depois e só devolve `report` quando `executePlan` retorna sucesso; execução rejeitada mantém a mensagem de erro sem report enganador.

O analyzer, o summary enviado ao advisor e os snapshots usam residentes atuais para população e workforce, não a capacidade das casas. O advisor pode continuar a sugerir `build_house`, sem novas actions: uma casa aprovada começa vazia, pelo que o report imediato não apresenta ganho de residentes/workers por essa construção. Os benefícios dependem dos serviços e dos ticks futuros; `wait` não avança ticks.

## Estrutura

```text
src/
  advisor/AdvisorProvider.ts  Interface async de provider, input summary/issues e validação shape de AdvisorPlan
  advisor/MockAdvisor.ts     Advisor mock determinístico: issues do analyzer para plano estruturado
  advisor/providers/         Providers mock, LLM injetável e wrapper safe/fallback
  advisor/AdvisorApproval.ts  Integra execução aprovada com snapshots e report sem furar ActionExecutor
  advisor/AfterActionReport.ts Snapshot de métricas, deltas determinísticos e top 3 issues remanescentes
  actions/ActionValidator.ts Validator puro de AdvisorPlan sem mutar a cidade
  actions/ActionExecutor.ts  Executor transacional simples: valida, constrói e recalcula trabalhadores
  assets/AssetManifest.ts    URLs locais, carregamento das sete texturas de origem e aliases temporários para amenities
  game/Game.ts              Input PixiJS, construção, reset, loop pausável, avaliação de cenário, resize e libertação
  game/SimulationSpeed.ts   Mapeamento 1x/2x/4x para intervalos de tick
  rendering/PixiApp.ts       Canvas PixiJS
  rendering/Camera.ts        Estado e matemática pura da câmara: clamp de zoom, zoom ancorado, pan e fitting
  rendering/MapRenderer.ts   Camadas, profundidade, overlays, refresh sem reset de câmera e aplicação de transform
  rendering/GridMath.ts      Conversão isométrica nos dois sentidos
  simulation/CityState.ts    Estado, seed, buildings[], resources, custos e validação de construção
  simulation/Simulation.ts   Tick, logística de comida, serviços, evolução com desirability, população, emprego, impostos e estatísticas
  simulation/Desirability.ts Modelo puro de qualidade urbana, scores, tiers, overlay e stats
  simulation/RoadNetwork.ts  Componentes determinísticas, rede principal, conectividade, distâncias BFS e stats
  scenario/Scenario.ts      Definição imutável Founding Settlement, avaliação pura e contexto curto para advisor
  simulation/Tile.ts         Coordenadas, terreno e referência buildingId opcional
  ui/BuildPanel.ts           Painel HTML: ferramentas, custos, dinheiro, stats, top 3 issues, overlays, feedback, reset e bloqueio terminal
  ui/SimulationControls.ts   Painel HTML de pause/play e velocidade 1x/2x/4x
  ui/CameraControls.ts       Painel HTML de zoom in/out, Center map e ajuda curta de navegação
  ui/ScenarioPanel.ts        Painel HTML do cenário: briefing, objetivos, progresso, ticks e resultado
  ui/ObjectivesPanel.ts      Painel estático legado com objetivos do fluxo MVP
  ui/AdvisorPanel.ts         Painel HTML do advisor: contexto do cenário, Analyze city, plano, Approve bloqueável, after-action report e Reject
  main.ts                   Arranque e mensagem de erro de carregamento
  style.css                 Layout da página
public/assets/prototype/    Apenas sete PNGs e aviso de licenciamento
```

`gridToScreen` devolve o centro do losango em coordenadas locais do mapa, usando tiles de 120×60. `screenToGrid` recebe essas mesmas coordenadas locais, devolve o tile mais próximo e retorna `null` para valores não finitos. O input usa `map.toLocal(event.global)` antes da conversão, mantendo construção correta após pan/zoom; drag de pan é tratado antes da construção e não altera `CityState`. A roda do rato aplica zoom centrado no cursor com `preventDefault`, e **Center map** recalcula o enquadramento ideal para o viewport atual. `placeBuilding` em `CityState` valida coordenadas inteiras e limites, ocupação por `buildingId` e saldo em `resources.money` antes de qualquer mutação. `INITIAL_MONEY` e `BUILD_COSTS` nesse ficheiro configuram os custos.

`simulation.tick` começa em 0 e é incrementado por `simulateTick` quando a simulação está em play; velocidades 1x, 2x e 4x usam intervalos de 1000ms, 500ms e 250ms. A ordem do tick é: incrementar tick → derivar rede principal → atribuir workers apenas a workplaces ligados → produção farm/granary e reabastecimento de markets por alcance viário → calcular serviços/consumir comida/desirability → evoluir/degradar casas → limitar residentes à capacidade → aplicar imigração/emigração nos intervalos globais → guardar `simulation.population.lastChange` → reatribuir workers → aplicar finanças se for múltiplo de 10. `lastChange` é a diferença total de residentes entre início e fim do tick, incluindo perdas por degradação, não apenas migração.

A logística da Fase 17 mantém comida exclusivamente em `storedFood` de granaries e markets, sem `resources.food`: farms ligadas e ativas depositam em qualquer granary ligado e ativo com espaço por ordem y/x/id, perdendo produção quando não há capacidade ativa. Markets procuram granaries ativos com stock até 8 passos pela rede principal, por distância e depois y/x/id; transferem até 4 unidades por tick, limitadas pelo stock e pela sua demanda (`max(0, 40 - storedFood)`). Casas são processadas por y/x/id e escolhem market ativo com stock até 4 passos de estrada por distância e depois y/x/id. Em ticks pares consomem 1 unidade; nos restantes, `hasFood` indica disponibilidade imediata. Só os endpoints ligados à rede principal participam.

## Assets e documentação

**Sprites temporários, apenas para prototipagem local. Direitos de redistribuição não verificados. Substituir antes de qualquer release pública.** Proveniência e seleção exata: [aviso dos assets](public/assets/prototype/README.md).

A relva vem de `land1a/`; a estrada usa pavimento de `ground/`, pois `way/` na fonte contém indicadores de percurso. Farm usa `farm/vegfarm_00001.png`, granary usa temporariamente `warehouse/warehouse_00001.png`, e market usa `commerce/commerce_00001.png`, porque o sprite anterior `marketkid_00001.png` era um walker/personagem de 17×30 e ficava escalado incorretamente como edifício. **Garden reutiliza o sprite de farm, plaza o de market e fountain o de well, com tint diferenciador; são placeholders temporários sem arte própria.** Só os sete PNGs de origem são carregados, sem modificar os originais. As texturas do mapa são carregadas no PixiJS v8 com sampling `nearest`/nearest-neighbor, mitigando blur nos sprites protótipo quando a câmara aproxima; em conjunto, o limite máximo de zoom fica em **2x**.

- [Plano da Fase 1](documentation/phase-1-development-plan.md)
- [Plano da Fase 2](documentation/phase-2-development-plan.md)
- [Plano da Fase 3](documentation/phase-3-development-plan.md)
- [Plano da Fase 4](documentation/phase-4-development-plan.md)
- [Plano da Fase 5](documentation/phase-5-development-plan.md)
- [Plano da Fase 6](documentation/phase-6-development-plan.md)
- [Plano da Fase 7](documentation/phase-7-development-plan.md)
- [Plano da Fase 8](documentation/phase-8-development-plan.md)
- [Plano da Fase 9](documentation/phase-9-development-plan.md)
- [Plano da Fase 10](documentation/phase-10-development-plan.md)
- [Plano da Fase 11](documentation/phase-11-development-plan.md)
- [Plano da Fase 12](documentation/phase-12-development-plan.md)
- [MVP](documentation/mvp.md)
- [Plano da Fase 14](documentation/phase-14-development-plan.md)
- [Plano da Fase 15](documentation/phase-15-development-plan.md)
- [Plano da Fase 16](documentation/phase-16-development-plan.md)
- [Plano da Fase 17](documentation/phase-17-development-plan.md)
- [Plano da Fase 18](documentation/phase-18-development-plan.md)
- [Plano da Fase 19](documentation/phase-19-development-plan.md)
- [Plano da Fase 20](documentation/phase-20-development-plan.md)
- [Plano da Fase 21](documentation/phase-21-development-plan.md)
- [Fases de implementação](documentation/implementation-phases.md)
- [Notas de referência Caesaria](documentation/caesaria-reference.md)
