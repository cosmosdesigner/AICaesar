# AICaesar — Plano de Desenvolvimento da Fase 12

## Objetivo

Tornar o protótipo demonstrável durante ~5 minutos sem explicação longa.

Esta é a última fase do roadmap MVP atual. O objetivo não é adicionar sistemas grandes, mas melhorar clareza, ritmo e onboarding para que uma pessoa consiga abrir o jogo, perceber o que fazer, construir alguns edifícios, usar overlays, pedir ajuda ao advisor, aprovar um plano e ver o after-action report.

## Estado atual

Já existe:

- mapa isométrico 30×30;
- construção manual;
- simulação de água, comida e trabalhadores;
- analyzer determinístico;
- advisor provider boundary;
- action validator/executor;
- after-action report;
- testes Vitest;
- assets temporários documentados.

## Escopo da Fase 12

### Inclui

- seed map inicial mais demonstrável;
- tooltips/títulos simples nos controlos principais;
- pausa/play da simulação;
- velocidade de simulação simples;
- overlays mais legíveis ou melhor identificados;
- painel de objetivos MVP;
- instruções de demo no README;
- pequenos ajustes de UX sem alterar arquitetura;
- testes unitários quando aplicável;
- build/test verificados.

### Exclui

- sons, salvo se for trivial e sem assets externos;
- browser testing;
- novas mecânicas grandes;
- backend;
- persistência;
- LLM real;
- animações complexas;
- redesign completo;
- novos sprites obrigatórios.

## Seed map inicial

Melhorar `createCityState()` para a cidade inicial ser mais demonstrável.

Requisitos:

- manter uma estrada central clara;
- manter casas próximas de estrada;
- incluir pelo menos:
  - 1 well;
  - 1 farm;
  - 1 granary;
  - 1 market;
- garantir que o jogador já vê água/comida/workers em ação;
- ainda deixar espaço livre para construir;
- edifícios seedados continuam gratuitos.

Não criar mapa enorme nem random.

## Pausa/play/speed

Adicionar controlo simples de simulação:

- botão `Pause` / `Play`;
- selector ou botões de velocidade:
  - `1x` = 1000ms;
  - `2x` = 500ms;
  - `4x` = 250ms.

Regras:

- quando pausado, ticks não avançam;
- overlays continuam funcionais;
- construção continua permitida;
- reset mantém ou repõe velocidade de forma simples. Preferência: reset não altera velocidade/pausa.

Implementação simples em `Game.ts`:

- substituir `setInterval` fixo por helper `scheduleTick()`;
- ao mudar velocidade/pausa, limpar/recriar intervalo;
- manter cleanup correto.

## UI/controles

Pode ser feito no `BuildPanel` ou em novo `SimulationControls`.

Preferência: se ficar limpo, criar:

```text
src/ui/SimulationControls.ts
src/ui/ObjectivesPanel.ts
```

Mas não criar componentes em excesso se a mudança for pequena.

### Simulation controls

Mostrar:

```text
Simulation: Running | Paused
Speed: 1x 2x 4x
```

### Tooltips/titles

Adicionar `title` nos botões principais:

- Road: conecta serviços e edifícios;
- House: aumenta população;
- Well: fornece água;
- Farm: produz comida;
- Granary: armazena comida;
- Market: distribui comida;
- Water overlay;
- Food overlay;
- Analyze city;
- Approve;
- Reject;
- Reset;
- Pause/Play;
- Speed.

## Painel de objetivos MVP

Adicionar painel curto com objetivos:

1. Construir ou observar casas perto da estrada.
2. Garantir água com wells.
3. Adicionar farm + granary + market para comida.
4. Manter trabalhadores suficientes com casas.
5. Clicar `Analyze city` para receber plano.
6. Aprovar um plano e ler o after-action report.

Pode ser estático.

## Overlays legíveis

Melhorias aceitáveis:

- labels de botão mais claros:
  - `Water overlay: On/Off` -> `Show water coverage: On/Off`;
  - `Food overlay: On/Off` -> `Show food coverage: On/Off`;
- copy no status explicando o que cada overlay mostra;
- CSS com contraste melhor.

Não precisa de legenda gráfica complexa.

## README

Atualizar README para:

- marcar Fase 12 / MVP polish;
- explicar quick demo flow de 5 minutos;
- listar controlos;
- indicar que browser testing não foi executado nesta implementação;
- manter aviso de assets temporários.

## Testes

Seguir TDD quando alterar comportamento testável.

Testes úteis:

- seed inicial contém road/house/well/farm/granary/market;
- seed inicial tem recursos/tick resetados;
- se criar helper de velocidade, testar mapeamento speed -> interval;
- se criar funções puras para objetivos/labels, testar se necessário.

Não tentar testar DOM complexo se isso exigir setup pesado.

## Critérios de aceitação

A Fase 12 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- seed map inicial contém edifícios suficientes para demonstrar água/comida/workers;
- existe pausa/play;
- existe seleção simples de velocidade;
- tooltips/titles principais existem;
- há painel de objetivos MVP;
- overlays têm labels/copy mais claros;
- README tem fluxo de demo de 5 minutos;
- não é feito browser testing.

## Verificação

Obrigatório:

```sh
npm run build
npm test
git status --short
```

## Decisões para evitar overengineering

- Sem sistemas novos grandes;
- Sem persistência;
- Sem som se exigir assets/licenças;
- Sem refactor UI profundo;
- Sem browser testing;
- Sem LLM real;
- Sem animações complexas.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 12 com mudanças pequenas e focadas;
2. preservar todas as fases anteriores;
3. adicionar testes apenas para comportamento testável;
4. correr build e testes;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados e evidência de verificação.
