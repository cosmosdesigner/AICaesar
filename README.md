# AICaesar

**Fase 13 — scenario gameplay loop**: mapa isométrico 30×30, construção manual, seed determinístico com estrada/casas/poço/farm/granary/market, simulação pausável com velocidades 1x/2x/4x, overlays de água/comida, cenário **Found a functioning settlement** com objetivos simultâneos, vitória/derrota automáticas, analyzer determinístico, advisor mock local por defeito, execução transacional validada de planos aprovados e relatório determinístico de métricas antes/depois da execução.

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

`build` verifica TypeScript em modo estrito e gera `dist/`; `test` executa os testes unitários Vitest do seed inicial, cenário, mapeamento de velocidade, analyzer, advisor mock, providers/fallback/schema, executor de ações e after-action reports; `preview` serve esse build localmente. `node_modules/` e `dist/` estão ignorados pelo Git. **O build é apenas para validação local: inclui os assets temporários e não deve ser publicado.** Browser testing não foi executado nesta implementação da Fase 13.

## O que aparece

- 900 tiles de relva numa grelha lógica 30×30.
- Uma estrada central de 20 tiles, oito casas, um poço, uma farm, uma granary e um market, seedados de forma determinística e gratuitos.
- Casas começam no nível 1; casas com estrada adjacente e cobertura de água evoluem para nível 2 após 3 ticks de serviço.
- População deriva dos níveis das casas: nível 1 fornece 4 habitantes, nível 2 fornece 8 e nível 3 fornece 14.
- Metade da população vira força de trabalho disponível; farms exigem 6 trabalhadores, granaries 4 e markets 5.
- A atribuição é determinística por tick: granaries primeiro, depois farms e markets; workplaces sem trabalhadores suficientes ficam inativos.
- Só farms ativas produzem 2 unidades de comida por tick; só granaries ativas adicionam 100 de capacidade; só markets ativos cobrem casas em raio Manhattan 4.
- Casas cobertas por market ativo consomem 1 comida a cada 2 ticks enquanto houver stock e evoluem para nível 3 após 5 ticks de serviço alimentar.
- Overlays opcionais de água e comida, desenhados sem novos sprites, mostram cobertura de poços e markets ativos; no overlay de comida, casas sem comida recebem tint laranja.
- O painel **Simulation** mostra **Running/Paused**, botão **Pause/Play** e velocidades **1x**, **2x** e **4x**; overlays e construção continuam disponíveis quando pausado.
- O painel **Found a functioning settlement** mostra briefing, estado **Active/Victory/Defeat**, tick atual/limite 900 e progresso atual/target dos objetivos: população 80, água 70%, comida 50%, falta de trabalhadores até 20% e dinheiro 100.
- Botões principais têm `title` simples para explicar construção, overlays, análise, aprovação, rejeição, reset, pausa/play e velocidade.
- O analyzer determinístico resume tick, dinheiro, casas, água, comida e emprego, e gera issues ordenadas por severidade, tipo estável e número de tiles afetados.
- O painel mostra os 3 principais problemas detetados, incluindo falta de água/comida, falta de produção/distribuição de comida, falta de trabalhadores, edifícios económicos sem estrada e dinheiro baixo; sem issues, mostra que não há problemas críticos.
- O painel Advisor tem botão **Analyze city**; gera um `AdvisorPlan` de forma assíncrona via `AdvisorProvider`, mostra contexto determinístico do cenário sem enviar trabalho extra ao provider, mostra o provider usado (`mock` por defeito local, ou fallback quando configurado) e apresenta resumo, raciocínio, ações, custo estimado, impactos esperados e riscos. **Approve** valida orçamento aprovado, dinheiro, tipo, target, limites do mapa, ocupação e custo antes de executar builds via `placeBuilding`; quando a execução é bem-sucedida, mostra um after-action report com ações executadas, gasto, deltas de métricas reais e até 3 problemas remanescentes. **wait** é no-op válido; **Reject** limpa o plano. Com vitória/derrota, aprovação fica bloqueada até **Reset**.
- Sprites reais da Caesaria, alinhados pela base do tile e ordenados de trás para a frente; casas nível 2 recebem tint clara e nível 3 tint verde.
- Enquadramento automático de todo o mapa ao abrir ou redimensionar a janela.


## Demo rápido de 5 minutos

1. Abrir a app e observar o seed: estrada central, casas, poço, farm, granary e market já existem sem custo inicial.
2. Ler o painel **Found a functioning settlement**: o cenário começa **Active** e mostra quantos objetivos já estão completos.
3. Usar **Pause** para parar os ticks, alternar **Show water coverage** e **Show food coverage**, e confirmar que os overlays explicam água de wells e comida de markets ativos.
4. Voltar a **Play** em **1x**, depois experimentar **2x** ou **4x** para acelerar produção, consumo, upgrades e avanço do limite de 900 ticks.
5. Construir casas/serviços em tiles vazios e usar **Analyze city**/**Approve** para executar um plano validado. O advisor mostra a meta restante principal do cenário.
6. Se todos os objetivos passarem, o estado vira **Victory**; se dinheiro cair abaixo de 50 ou chegar ao tick 900 sem vitória, vira **Defeat**. Em ambos os casos, ticks, construção e aprovação ficam bloqueados.
7. Clicar **Reset** para restaurar dinheiro, comida, tick 0, cidade seedada e cenário **Active**; pausa/velocidade ficam como estão para facilitar nova demonstração.

## Construção manual

- Dinheiro inicial: **500** em `resources.money`, comida inicial **0** em `resources.food`, além da cidade seedada (os edifícios iniciais não são cobrados).
- Selecionar **Road (4)**, **House (20)**, **Well (35)**, **Farm (45)**, **Granary (60)** ou **Market (50)** no painel; Road começa selecionada.
- Clicar com o botão principal num tile vazio para construir. O dinheiro diminui pelo custo indicado.
- Cada construção cria um `Building { id, type, x, y }`; casas também guardam `level`, `hasRoadAccess`, `hasWater`, `hasFood` e `upgradeProgress`; workplaces (`farm`, `granary`, `market`) guardam `active` para feedback visual simples; granaries recebem `storedFood` temporário, com o stock efetivo centralizado em `resources.food`.
- O painel mostra dinheiro, ferramenta selecionada, tick, estatísticas de casas/água/comida, estatísticas de emprego, toggles de overlay com labels claros, feedback da última ação e estado do cenário.
- Tiles ocupados, coordenadas fora do mapa, dinheiro insuficiente e cenário terminado são rejeitados sem alterar cidade, saldo ou comida.
- **Reset** recria `CityState`, restaurando tiles, `buildings[]`, `resources.money`, `resources.food`, `simulation.tick`, edifícios iniciais, estado ativo/inativo recalculado e cenário **Active**; mantém a ferramenta selecionada, os estados dos overlays e a configuração atual de pausa/velocidade.

O mapa completo é redesenhado após construção válida, execução válida do advisor, reset, tick de simulação, toggle de overlay ou redimensionamento. Workplaces inativos aparecem com alpha reduzido e tint vermelho/cinzento. Não há pan/zoom, demolição, walkers/pathfinding, commute, salários, impostos, migração, desirability, múltiplos tipos de comida, backend, chamada real de LLM por defeito, secrets/API keys, streaming, tool-calling, rollback histórico, execução parcial silenciosa, persistência de recomendações, arquivo de reports, campanhas, múltiplos cenários, eventos ou save/load.

Verificação manual: construir Road num tile vazio (saldo 496), selecionar House e clicar no mesmo tile (erro, saldo 496), construir Farm, Granary e Market em tiles vazios. Com poucas casas e workplaces demais, alguns workplaces ficam inativos; farms inativas não aumentam comida, granaries inativas não aumentam capacidade e markets inativos não dão cobertura de comida. Reset deve restaurar saldo 500, comida 0, tick 0 e a cidade seedada.

## Cenário

`FOUNDING_SETTLEMENT_SCENARIO` vive em `src/scenario/Scenario.ts`. A definição é imutável e `evaluateScenario(city, definition)` deriva progresso apenas de `CityState`: população por `getWorkforceStats`, água/comida como percentagem de casas, falta de trabalhadores como percentagem de workers required (0% quando `workersRequired === 0`) e dinheiro por `resources.money`. Vitória exige todos os objetivos no mesmo tick. Derrota ocorre com `money < 50` ou `simulation.tick >= 900` sem vitória. Ao terminar, `Game.ts` pausa a simulação, bloqueia construção manual e bloqueia aprovação do advisor; **Reset** volta a avaliar uma cidade nova como **Active**.

## Advisor, providers e execução de ações

`AdvisorProvider` vive em `src/advisor/AdvisorProvider.ts` e recebe apenas `{ summary: CityStateSummary, issues: CityIssue[] }`. `MockAdvisorProvider` é o provider local por defeito e reutiliza a lógica determinística do mock; `LLMAdvisorProvider` recebe um `LLMPlanClient` injetado, constrói prompt só com summary/issues, tipos permitidos e formato JSON esperado, valida o JSON devolvido como `AdvisorPlan` e não faz rede sem um client externo. `createSafeAdvisorProvider(primary, fallback)` chama o fallback mock quando o provider primário lança erro, devolve erro ou retorna plano com shape inválido; o resultado indica o provider efetivamente usado.

`validatePlan(city, plan, approvedBudget)` e `executePlan(city, plan, approvedBudget)` vivem em `src/actions/`. O validator rejeita planos sem ações, tipos não suportados, targets ausentes, coordenadas fora do mapa, tiles ocupados, custo manipulado, orçamento insuficiente e dinheiro insuficiente sem mutar a cidade. O executor só muta depois de validar o plano completo; ações `build_*` são mapeadas para edifícios existentes e `wait` não altera dinheiro, tiles ou simulação. Texto vindo de LLM nunca é executado diretamente e nunca substitui `ActionValidator`/`ActionExecutor`.

`createCityMetricsSnapshot(city)` e `createAfterActionReport(...)` vivem em `src/advisor/AfterActionReport.ts`. O snapshot registra dinheiro, comida/capacidade, cobertura de casas por água/comida, níveis de casas, população, trabalhadores, workplaces ativos/inativos e contagem de issues. `approveAdvisorPlan(city, plan)` captura snapshot antes da execução, executa via `ActionExecutor`, captura snapshot depois e só devolve `report` quando `executePlan` retorna sucesso; execução rejeitada mantém a mensagem de erro sem report enganador.

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
  assets/AssetManifest.ts    URLs locais e carregamento das sete texturas
  game/Game.ts              Input PixiJS, construção, reset, loop pausável, avaliação de cenário, resize e libertação
  game/SimulationSpeed.ts   Mapeamento 1x/2x/4x para intervalos de tick
  rendering/PixiApp.ts       Canvas PixiJS
  rendering/MapRenderer.ts   Camadas, profundidade, overlays de água/comida, refresh e enquadramento
  rendering/GridMath.ts      Conversão isométrica nos dois sentidos
  simulation/CityState.ts    Estado, seed, buildings[], resources, custos e validação de construção
  simulation/Simulation.ts   Tick, água, comida ativa, emprego, acesso a estrada, evolução e estatísticas
  scenario/Scenario.ts      Definição imutável Founding Settlement, avaliação pura e contexto curto para advisor
  simulation/Tile.ts         Coordenadas, terreno e referência buildingId opcional
  ui/BuildPanel.ts           Painel HTML: ferramentas, custos, dinheiro, stats, top 3 issues, overlays, feedback, reset e bloqueio terminal
  ui/SimulationControls.ts   Painel HTML de pause/play e velocidade 1x/2x/4x
  ui/ScenarioPanel.ts        Painel HTML do cenário: briefing, objetivos, progresso, ticks e resultado
  ui/ObjectivesPanel.ts      Painel estático legado com objetivos do fluxo MVP
  ui/AdvisorPanel.ts         Painel HTML do advisor: contexto do cenário, Analyze city, plano, Approve bloqueável, after-action report e Reject
  main.ts                   Arranque e mensagem de erro de carregamento
  style.css                 Layout da página
public/assets/prototype/    Apenas sete PNGs e aviso de licenciamento
```

`gridToScreen` devolve o centro do losango em coordenadas locais do mapa, usando tiles de 120×60. `screenToGrid` recebe essas mesmas coordenadas locais, devolve o tile mais próximo e retorna `null` para valores não finitos. O input usa `map.toLocal(event.global)` antes da conversão; `placeBuilding` em `CityState` valida coordenadas inteiras e limites, ocupação por `buildingId` e saldo em `resources.money` antes de qualquer mutação. `INITIAL_MONEY` e `BUILD_COSTS` nesse ficheiro configuram os custos. `simulation.tick` começa em 0 e é incrementado por `simulateTick` quando a simulação está em play; velocidades 1x, 2x e 4x usam intervalos de 1000ms, 500ms e 250ms. A economia de comida usa stock central em `resources.food`, capacidade derivada de granaries ativos, produção direta por farms ativas e cobertura por markets ativos sem walkers. População e força de trabalho são derivadas das casas, e `assignWorkers` marca `farm`, `granary` e `market` como ativos ou inativos de forma estável. O renderer deriva terreno de `city.tiles`, edifícios de `city.buildings` e coberturas de poços/markets ativos; refresh destrói os objetos visuais antigos sem destruir as texturas partilhadas.

## Assets e documentação

**Sprites temporários, apenas para prototipagem local. Direitos de redistribuição não verificados. Substituir antes de qualquer release pública.** Proveniência e seleção exata: [aviso dos assets](public/assets/prototype/README.md).

A relva vem de `land1a/`; a estrada usa pavimento de `ground/`, pois `way/` na fonte contém indicadores de percurso. Farm usa `farm/vegfarm_00001.png`, granary usa temporariamente `warehouse/warehouse_00001.png`, e market usa `commerce/commerce_00001.png`, porque o sprite anterior `marketkid_00001.png` era um walker/personagem de 17×30 e ficava escalado incorretamente como edifício. Só os sete PNGs usados foram copiados, sem modificar os originais.

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
- [Fases de implementação](documentation/implementation-phases.md)
- [Notas de referência Caesaria](documentation/caesaria-reference.md)
