# AICaesar — Fases de Implementação

## 1. Objetivo deste documento

Este documento transforma o MVP descrito em `documentation/mvp.md` num plano incremental de implementação.

A regra principal é:

> construir primeiro o menor jogo funcional, depois adicionar simulação, depois adicionar o agente de IA.

Não vamos começar pelo agente. O agente só será útil quando existir um estado de cidade minimamente consistente para analisar.

## 2. Estratégia geral

Implementação em camadas:

1. base técnica;
2. renderização do mapa;
3. construção manual;
4. simulação mínima;
5. análise determinística da cidade;
6. advisor/IA com planos estruturados;
7. aprovação e execução;
8. polish mínimo.

Cada fase deve terminar com algo executável.

## 3. Fase 0 — Preparação do projeto

### Objetivo

Criar o esqueleto técnico do projeto.

### Entregáveis

- Vite + TypeScript;
- PixiJS instalado;
- estrutura de pastas inicial;
- script `dev`;
- script `build`;
- página inicial com canvas vazio;
- documentação dos assets temporários.

### Estrutura sugerida

```text
src/
  assets/
  simulation/
  rendering/
  input/
  ui/
  advisor/
  game/
```

### Critérios de aceitação

- `npm install` funciona;
- `npm run dev` abre a aplicação;
- `npm run build` passa;
- canvas renderiza uma cor de fundo;
- repo continua limpo depois do build.

## 4. Fase 1 — Mapa e sprites base

### Objetivo

Renderizar um mapa simples usando sprites temporários da Caesaria.

### Entregáveis

- mapa 30x30;
- tile base de terreno;
- conversão grid → screen;
- câmara simples/pan opcional;
- carregamento de sprites a partir de uma pasta local do projeto;
- primeiro subset de sprites copiado para o projeto.

### Assets mínimos

Copiar apenas o necessário, não a pasta inteira da Caesaria.

Subset inicial:

```text
assets/prototype/ground/
assets/prototype/way/
assets/prototype/houses/
assets/prototype/well/
```

### Nota de licenciamento

Adicionar um `assets/prototype/README.md` a indicar:

- origem temporária dos sprites;
- uso apenas para protótipo;
- necessidade de substituição antes de release pública.

### Critérios de aceitação

- mapa aparece no ecrã;
- tiles são renderizados numa grelha consistente;
- pelo menos um sprite real da Caesaria aparece;
- não há lógica de jogo ainda.

## 5. Fase 2 — Construção manual

### Objetivo

Permitir ao jogador colocar edifícios básicos.

### Edifícios suportados

- Road;
- House;
- Well.

### Entregáveis

- `BuildTool`;
- seleção de edifício;
- clique no mapa coloca edifício;
- validação simples de tile livre;
- custo por edifício;
- dinheiro inicial;
- painel simples com dinheiro e ferramenta selecionada.

### Regras iniciais

- só pode construir em tile vazio;
- cada edifício ocupa 1 tile;
- construção reduz dinheiro;
- estrada pode ser colocada em tiles vazios;
- erro visual se não houver dinheiro.

### Critérios de aceitação

- jogador consegue colocar estrada;
- jogador consegue colocar casa;
- jogador consegue colocar poço;
- dinheiro diminui;
- construção inválida é rejeitada.

## 6. Fase 3 — Estado da cidade

### Objetivo

Separar estado de jogo da renderização.

### Entregáveis

- `CityState`;
- `Tile`;
- `Building`;
- `ResourceState`;
- função `placeBuilding`;
- renderização derivada do estado;
- reset da cidade.

### Modelo inicial

```ts
type BuildingType = 'road' | 'house' | 'well'

type Tile = {
  x: number
  y: number
  terrain: 'grass'
  buildingId?: string
}

type Building = {
  id: string
  type: BuildingType
  x: number
  y: number
}
```

### Critérios de aceitação

- renderização reflete `CityState`;
- não há estado duplicado entre renderer e simulação;
- reset limpa edifícios e recursos;
- build continua a passar.

## 7. Fase 4 — Água e evolução básica de casas

### Objetivo

Introduzir a primeira regra estilo Caesar III: casas evoluem com serviços.

### Entregáveis

- raio de serviço do poço;
- cálculo de casas com água;
- níveis de casa;
- tick de simulação simples;
- overlay de cobertura de água.

### Regras

- casas precisam de estrada para serem válidas;
- casas dentro do raio de um poço têm água;
- casa com estrada + água evolui para nível 2;
- casa sem água não evolui.

### Critérios de aceitação

- casas sem água ficam no nível base;
- casas com água evoluem após alguns ticks;
- overlay mostra cobertura de água;
- o jogador entende visualmente porque uma casa não evoluiu.

## 8. Fase 5 — Comida: produção, armazenamento e distribuição

### Objetivo

Criar a primeira cadeia económica.

### Novos edifícios

- Farm;
- Granary;
- Market.

### Entregáveis

- farms produzem comida por tick;
- granaries armazenam comida;
- markets distribuem comida por raio ou distância por estrada;
- casas consomem comida;
- overlay de cobertura de comida;
- casas evoluem mais quando têm água + comida.

### Simplificação importante

Não implementar walkers reais nesta fase.

Distribuição pode ser:

- por raio simples; ou
- por distância calculada até estrada ligada.

### Critérios de aceitação

- comida aumenta quando há farms;
- comida fica armazenada;
- markets reduzem comida armazenada e abastecem casas;
- casas com água + comida evoluem;
- casas sem comida são sinalizadas.

## 9. Fase 6 — Trabalhadores e emprego

### Objetivo

Adicionar uma restrição de capacidade produtiva.

### Entregáveis

- população das casas;
- trabalhadores disponíveis;
- trabalhadores exigidos por edifício;
- edifícios inativos quando não têm trabalhadores;
- painel de emprego.

### Regras simples

- cada casa fornece população;
- percentagem fixa da população é força de trabalho;
- farms, granaries e markets requerem trabalhadores;
- se faltarem trabalhadores, alguns edifícios ficam inativos.

### Critérios de aceitação

- cidade com poucas casas não consegue alimentar muitos edifícios;
- UI mostra trabalhadores necessários vs disponíveis;
- advisor futuro terá dados suficientes para detetar falta de trabalhadores.

## 10. Fase 7 — Analyzer determinístico

### Objetivo

Criar o cérebro determinístico que identifica problemas reais da cidade.

### Entregáveis

- `CityAnalyzer`;
- `CityStateSummary`;
- lista de issues;
- severidade;
- localização aproximada;
- causa provável.

### Issues mínimas

- casas sem água;
- casas sem comida;
- produção de comida insuficiente;
- distribuição de comida insuficiente;
- falta de trabalhadores;
- edifícios desconectados da estrada;
- dinheiro baixo.

### Exemplo

```ts
type CityIssue = {
  type: 'water_shortage' | 'food_shortage' | 'worker_shortage'
  severity: 'low' | 'medium' | 'high'
  affectedTiles: Array<{ x: number; y: number }>
  explanation: string
}
```

### Critérios de aceitação

- analyzer corre sem IA;
- issues são reproduzíveis;
- os 3 maiores problemas aparecem no painel;
- testes unitários cobrem pelo menos água e comida.

## 11. Fase 8 — Advisor determinístico/mock

### Objetivo

Validar a experiência do advisor antes de integrar LLM.

### Entregáveis

- painel do advisor;
- botão "Analyze city";
- explicação textual gerada a partir das issues;
- plano estruturado mock;
- botão aprovar/rejeitar.

### Exemplo de plano

```ts
type AdvisorPlan = {
  summary: string
  reasoning: string[]
  actions: AdvisorAction[]
  estimatedCost: number
  expectedImpact: string[]
  risks: string[]
}
```

### Critérios de aceitação

- jogador pede análise;
- advisor explica o problema principal;
- advisor propõe uma ação válida;
- jogador pode rejeitar;
- nada é executado sem aprovação.

## 12. Fase 9 — Action Validator e Executor

### Objetivo

Permitir que planos aprovados sejam executados com segurança.

### Entregáveis

- `ActionValidator`;
- `ActionExecutor`;
- validação de dinheiro;
- validação de tile livre;
- validação de limites de plano;
- execução transacional simples.

### Regras de segurança

- IA não pode demolir;
- IA não pode gastar acima do orçamento aprovado;
- IA não pode colocar edifícios inválidos;
- se uma ação falhar, o plano inteiro deve ser rejeitado ou parcialmente executado com relatório explícito.

### Critérios de aceitação

- plano válido é executado;
- plano inválido é rejeitado;
- dinheiro é atualizado corretamente;
- cidade muda visualmente após aprovação.

## 13. Fase 10 — Integração LLM

### Objetivo

Substituir ou complementar o advisor mock com um LLM.

### Entregáveis

- interface `AdvisorProvider`;
- provider mock;
- provider LLM;
- prompt com `CityStateSummary` e `CityIssue[]`;
- resposta validada contra schema;
- fallback para mock se LLM falhar.

### Regras

- LLM só recebe resumo estruturado, não o estado inteiro bruto;
- LLM devolve JSON estruturado;
- JSON é validado;
- ações continuam a passar pelo `ActionValidator`;
- texto do LLM nunca executa comandos diretamente.

### Critérios de aceitação

- advisor LLM explica problemas de forma útil;
- plano gerado é validado;
- plano inválido é rejeitado sem quebrar o jogo;
- mock continua disponível para desenvolvimento local.

## 14. Fase 11 — After-action report

### Objetivo

Fechar o ciclo de cooperação.

### Entregáveis

- snapshot antes do plano;
- snapshot depois do plano;
- comparação de métricas;
- relatório do advisor.

### Métricas

- casas com água;
- casas com comida;
- produção de comida;
- comida armazenada;
- trabalhadores disponíveis;
- dinheiro restante.

### Critérios de aceitação

- após aprovação, o advisor diz o que mudou;
- impacto é baseado em métricas reais;
- problemas remanescentes são listados.

## 15. Fase 12 — Polish mínimo do MVP

### Objetivo

Tornar o protótipo demonstrável.

### Entregáveis

- seed map inicial;
- tooltips simples;
- pausa/play/speed;
- overlays legíveis;
- painel de objetivos MVP;
- pequenos sons opcionais;
- README com instruções.

### Critérios de aceitação

- uma pessoa consegue abrir e perceber o protótipo sem explicação longa;
- é possível jogar 5 minutos;
- o advisor ajuda pelo menos uma vez de forma clara;
- não existem erros no console durante o fluxo principal.

## 16. Ordem recomendada dos commits

1. `chore: initialize vite pixi project`
2. `feat: render tile map`
3. `feat: add building placement`
4. `feat: add city state model`
5. `feat: simulate water coverage`
6. `feat: simulate food chain`
7. `feat: add worker constraints`
8. `feat: add city analyzer`
9. `feat: add advisor panel`
10. `feat: execute approved advisor plans`
11. `feat: add llm advisor provider`
12. `feat: add after-action reports`
13. `docs: document prototype asset usage`

## 17. Definition of Done do MVP

O MVP só está concluído quando:

- todas as fases 0–12 estão implementadas ou explicitamente cortadas;
- `npm run build` passa;
- o fluxo manual de construção funciona;
- a simulação de água e comida funciona;
- o analyzer deteta problemas reais;
- o advisor propõe plano estruturado;
- o jogador aprova plano;
- o executor aplica ações válidas;
- o after-action report mostra impacto real;
- a documentação explica limitações dos assets;
- existe uma demo jogável de 5 minutos.

## 18. Cortes aceitáveis se o scope apertar

Se for necessário reduzir scope, cortar nesta ordem:

1. LLM real — manter advisor mock;
2. trabalhadores — manter apenas água/comida;
3. granary — market pode consumir diretamente produção global;
4. overlays avançados — manter indicadores simples;
5. animações de sprites — usar sprites estáticos.

Não cortar:

- analyzer;
- ações estruturadas;
- aprovação do jogador;
- action validator.

Esses quatro elementos são o núcleo diferencial do AICaesar.

## 19. Roadmap pós-MVP — transformar demo em jogo jogável

As fases 0–12 criam uma demo técnica: construção, simulação básica, analyzer, advisor, execução segura e after-action report.

Para ser um jogo que dá vontade de jogar "a sério", o próximo objetivo deixa de ser provar tecnologia e passa a ser criar um loop de jogo com decisões, pressão, progressão e objetivos claros.

Princípio para o pós-MVP:

> Tornar cada decisão do jogador relevante antes de adicionar mais sistemas.

## 20. Fase 13 — Loop de jogo e objetivos de cenário

### Objetivo

Criar uma experiência com começo, objetivo e condição de sucesso/falha, inspirada nos ficheiros `.mission` da Caesaria.

Esta fase transforma o protótipo de sandbox numa missão jogável.

### Entregáveis

- `ScenarioDefinition`;
- briefing curto;
- objetivos visíveis;
- condição de vitória;
- condição de derrota simples;
- painel de progresso;
- primeiro cenário jogável de 10–15 minutos;
- advisor consciente dos objetivos do cenário.

### Exemplo de cenário inicial

"Fundar uma pequena cidade funcional."

Objetivos:

- alcançar 80 habitantes;
- ter 70% das casas com água;
- ter 50% das casas com comida;
- manter worker shortage abaixo de 20%;
- terminar com dinheiro acima de 100.

### Inspiração Caesaria

Usar como referência:

```text
/root/caesaria-game-inspect/bin/resources/missions/*.mission
/root/caesaria-game-inspect/bin/resources/missions/caesarea.mission
```

Adaptar apenas os conceitos:

- briefing;
- objetivos;
- win conditions;
- eventos por data mais tarde;
- progressão de cenário.

### Critérios de aceitação

- jogador entende o objetivo sem ler documentação;
- jogo mostra progresso;
- vitória é detetada automaticamente;
- derrota por falência/colapso é detetada automaticamente;
- advisor consegue comentar o objetivo principal.

## 21. Fase 14 — Navegação de mapa e câmara

### Objetivo

Fazer o mapa ser confortável de jogar quando a cidade crescer.

Antes de aprofundar economia e simulação, o jogador precisa conseguir navegar bem: mover, aproximar, afastar e orientar-se.

### Entregáveis

- pan do mapa com drag do rato;
- zoom in/out com roda do rato e botões;
- reset camera / center city;
- limites de zoom;
- limites ou elasticidade de pan;
- mini ajuda de controlos;
- persistência temporária da câmara durante a sessão;
- testes para helpers matemáticos de zoom/pan quando aplicável.

### Rotação

Rotação deve ser tratada com cuidado.

Recomendação:

- não implementar rotação livre já;
- implementar primeiro apenas pan + zoom;
- investigar depois rotação em passos de 90° como fase separada se o renderer, sprites e seleção de tiles suportarem bem.

Motivo:

- o mapa atual é isométrico 2D com sprites pré-renderizados;
- rotação real exigiria sprites para múltiplas orientações ou transformação visual que pode ficar errada;
- pan/zoom trazem benefício imediato com baixo risco;
- rotação pode quebrar input, depth sorting e leitura visual.

### Critérios de aceitação

- jogador consegue mover-se pelo mapa sem perder contexto;
- zoom mantém o tile sob o cursor estável sempre que possível;
- existe botão para recentrar;
- construção continua correta após pan/zoom;
- overlays continuam alinhados.

## 22. Fase 15 — Economia mínima e rendimento

### Objetivo

Fazer dinheiro importar para além de ser apenas um contador que desce.

### Entregáveis

- impostos simples baseados em população/casas evoluídas;
- upkeep por edifício económico;
- saldo líquido por tick ou por mês;
- painel financeiro;
- falência como condição de derrota.

### Regras simples

- casas geram impostos por nível/população;
- farms/granaries/markets/wells têm upkeep;
- roads podem ter upkeep muito baixo ou zero;
- se dinheiro ficar abaixo de 0 durante N ticks, derrota.

### Inspiração Caesaria

Usar `house.cpp`, `house_spec.*` e mission files apenas como referência conceptual:

- tax rate;
- prosperity;
- efeitos de nível da casa;
- pressão por objetivos económicos.

### Critérios de aceitação

- cidade sustentável ganha dinheiro;
- cidade mal planeada perde dinheiro;
- jogador precisa equilibrar expansão e manutenção.

## 23. Fase 16 — House specification e evolução habitacional

### Objetivo

Substituir a evolução simples hardcoded por um modelo explícito de requisitos por nível.

Esta fase deve vir antes de população/migração profunda porque define a base de casas, capacidade, impostos e missing requirements.

### Entregáveis

- `HouseSpecification` em TypeScript;
- requisitos por nível;
- capacidade por nível;
- tax value por nível;
- missing requirement por casa;
- evolução/degradação baseada em requisitos;
- UI/analyzer explicam por que uma casa não evolui.

### Regras iniciais sugeridas

- nível 1: estrada;
- nível 2: estrada + água;
- nível 3: estrada + água + comida;
- nível 4: estrada + água + comida + desirability mínima, quando desirability existir.

### Inspiração Caesaria

Usar como referência:

```text
/root/caesaria-game-inspect/source/objects/house_spec.hpp
/root/caesaria-game-inspect/source/objects/house_spec.cpp
/root/caesaria-game-inspect/source/objects/house_level.hpp
/root/caesaria-game-inspect/source/objects/house.cpp
```

Adaptar conceitos, não portar implementação.

### Critérios de aceitação

- requisitos de evolução ficam declarativos;
- analyzer consegue mostrar missing requirement;
- casas evoluem/degradam de forma compreensível;
- população/capacidade derivam da spec.

## 24. Fase 17 — Market/granary storage e procura

### Objetivo

Tornar a cadeia de comida mais Caesar-like sem implementar walkers completos.

### Entregáveis

- granaries têm stock real;
- markets têm stock próprio;
- markets calculam goods demand;
- farms produzem para granary;
- markets abastecem-se de granary por regra simplificada;
- casas consomem do market;
- analyzer distingue falha de produção, armazenamento e distribuição.

### Inspiração Caesaria

Usar como referência:

```text
/root/caesaria-game-inspect/source/objects/market.cpp
/root/caesaria-game-inspect/source/objects/market.hpp
/root/caesaria-game-inspect/source/walker/market_buyer.cpp
/root/caesaria-game-inspect/source/good/good.cpp
/root/caesaria-game-inspect/source/good/good.hpp
```

Conceitos relevantes:

- market storage;
- demand por diferença entre capacity e qty;
- market buyer procura bens;
- diferentes goods no futuro.

### Critérios de aceitação

- comida já não é apenas stock global;
- markets podem falhar por falta de abastecimento;
- advisor identifica onde a cadeia falha.

## 25. Fase 18 — Crescimento populacional e migração

### Objetivo

Substituir população estática por crescimento condicionado pelos serviços.

### Entregáveis

- casas têm população atual/capacidade;
- população cresce quando há serviços básicos;
- população estagna ou diminui sem serviços;
- desemprego/worker shortage passam a emergir da população;
- UI mostra crescimento líquido.

### Regras simples

- house level define capacidade;
- água/comida aumentam ocupação;
- falta de comida reduz ocupação lentamente;
- população influencia impostos e trabalhadores.

### Critérios de aceitação

- construir casas vazias não resolve imediatamente falta de workers;
- serviços atraem habitantes;
- colapso de comida afeta população, impostos e trabalhadores.

## 26. Fase 19 — Road network e service reach

### Objetivo

Dar mais peso ao layout da cidade.

### Entregáveis

- cálculo de conectividade por estrada;
- edifícios precisam estar ligados à rede principal;
- markets/wells/farms distribuem por distância na estrada em vez de raio direto;
- overlay de rede/cobertura;
- walkers visuais simples opcionais depois da regra estar correta.

### Simplificação

Não implementar simulação completa de walkers estilo Caesar III ainda.

Primeiro passo:

- usar BFS/graph distance nas estradas;
- mostrar cobertura baseada na rede;
- depois adicionar walkers visuais como feedback, não como fonte de verdade.

### Critérios de aceitação

- layout de estradas muda cobertura real;
- edifícios isolados deixam de funcionar;
- jogador precisa desenhar bairros coerentes.

## 27. Fase 20 — Desirability e qualidade urbana

### Objetivo

Adicionar qualidade urbana como decisão de layout.

### Entregáveis

- desirability por tile;
- efeitos positivos: gardens, fountain/plaza, services;
- efeitos negativos: farms/industry/warehouse próximos;
- casas evoluem/degradam com desirability + serviços;
- overlay de desirability.

### Novos edifícios sugeridos

- garden;
- plaza;
- fountain;
- prefecture ou basic safety building mais tarde.

### Critérios de aceitação

- jogador separa indústria/comida de habitação;
- bairros bem planeados evoluem melhor;
- analyzer deteta baixa desirability.

## 28. Fase 21 — Eventos e pressão de jogo

### Objetivo

Criar tensão e variação entre sessões.

### Entregáveis

- eventos determinísticos/aleatórios controlados;
- seca reduz produção de farms;
- epidemia reduz população temporariamente;
- incêndio/risco urbano simples;
- pedidos do imperador;
- mensagens de evento;
- advisor reage a eventos.

### Inspiração Caesaria

Usar mission files para estrutura de eventos:

- data;
- trigger;
- mensagem;
- impacto;
- pedido de goods;
- alteração de preço.

### Critérios de aceitação

- jogador precisa adaptar planos;
- eventos são compreensíveis e não parecem injustos;
- há warning antes de eventos severos quando possível.

## 29. Fase 22 — Save/load local

### Objetivo

Permitir continuidade de jogo.

### Entregáveis

- serialização de `CityState`;
- save/load em `localStorage` ou ficheiro local no futuro;
- botão Save;
- botão Load;
- versão do schema;
- reset continua disponível.

### Critérios de aceitação

- jogador consegue voltar à cidade;
- saves antigos falham de forma segura se schema mudar;
- não há backend.

## 30. Fase 23 — UX de jogo sério

### Objetivo

Reduzir fricção e tornar decisões legíveis.

### Entregáveis

- tooltips ricos por edifício;
- seleção de tile mostra detalhes;
- preview antes de construir;
- erro visual no tile inválido;
- painel de logs/eventos;
- objetivos sempre visíveis;
- atalhos de teclado básicos;
- melhor organização dos painéis.

### Critérios de aceitação

- jogador entende por que algo funciona ou falha;
- é possível jogar sem abrir o README;
- ações comuns são rápidas.

## 31. Fase 24 — Advisor estratégico

### Objetivo

Fazer o advisor ser útil como parceiro de jogo, não só corretor de problemas.

### Entregáveis

- advisor considera objetivo do cenário;
- planos com múltiplas ações;
- comparação de alternativas;
- trade-offs explícitos;
- orçamento aprovado pelo jogador;
- after-action report compara promessa vs resultado.

### Critérios de aceitação

- advisor propõe planos úteis para vencer cenário;
- jogador pode aceitar/rejeitar com confiança;
- executor continua a validar tudo.

## 32. Fase 25 — Conteúdo e balanceamento

### Objetivo

Transformar sistemas em jogo equilibrado.

### Entregáveis

- 3 cenários jogáveis;
- custos ajustados;
- curvas de crescimento;
- objetivos graduais;
- dificuldade fácil/normal;
- playtest checklist;
- métricas de sessão.

### Critérios de aceitação

- cenário 1 ensina;
- cenário 2 exige planeamento;
- cenário 3 testa resiliência;
- uma sessão de 30 minutos tem progressão clara.

## 33. Fonte de inspiração Caesaria

O clone local da Caesaria permanece disponível em:

```text
/root/caesaria-game-inspect
```

Para este projeto pessoal, podemos usar a Caesaria como referência prática de mecânicas, dados e sprites temporários.

### Ficheiros úteis para mecânicas

Habitação/evolução:

```text
/root/caesaria-game-inspect/source/objects/house.cpp
/root/caesaria-game-inspect/source/objects/house.hpp
/root/caesaria-game-inspect/source/objects/house_spec.cpp
/root/caesaria-game-inspect/source/objects/house_spec.hpp
/root/caesaria-game-inspect/source/objects/house_level.hpp
/root/caesaria-game-inspect/source/objects/house_habitants.cpp
/root/caesaria-game-inspect/source/events/updatehouseservice.cpp
```

Ideias a aproveitar:

- níveis de casa definidos por requisitos;
- serviços como valores acumulados/decrescentes;
- evolução/degradação baseada em requisitos;
- população ligada ao tipo/nível de casa;
- missing requirement explícito para explicar ao jogador.

Mercado/comida/distribuição:

```text
/root/caesaria-game-inspect/source/objects/market.cpp
/root/caesaria-game-inspect/source/objects/market.hpp
/root/caesaria-game-inspect/source/walker/market_lady.cpp
/root/caesaria-game-inspect/source/walker/market_buyer.cpp
/root/caesaria-game-inspect/source/layers/market_access.cpp
/root/caesaria-game-inspect/source/city/goods_updater.cpp
/root/caesaria-game-inspect/source/good/good.cpp
/root/caesaria-game-inspect/source/good/good.hpp
```

Ideias a aproveitar:

- market tem storage próprio;
- market buyer procura bens necessários;
- distribuição depende de trabalhadores e distância/estrada;
- goods têm capacidade e quantidade;
- procura pode ser calculada por diferença entre capacidade e stock.

Cenários/eventos:

```text
/root/caesaria-game-inspect/bin/resources/missions/*.mission
/root/caesaria-game-inspect/bin/resources/missions/caesarea.mission
```

Ideias a aproveitar:

- objetivos por população/prosperidade/cultura/paz/favor;
- eventos por data;
- alterações de preços;
- pedidos do imperador;
- trade routes e goods comprados/vendidos;
- briefing/win text por cenário.

Roads/walkers:

```text
/root/caesaria-game-inspect/source/walker/walker.cpp
/root/caesaria-game-inspect/source/walker/walker.hpp
/root/caesaria-game-inspect/source/walker/walkers_factory.cpp
/root/caesaria-game-inspect/source/city/walkergrid.cpp
/root/caesaria-game-inspect/source/city/walkergrid.hpp
```

Ideias a aproveitar:

- walkers como feedback visual;
- primeiro usar distância por road graph como fonte de verdade;
- walkers visuais podem vir depois sem controlar a simulação.

### Assets úteis

Sprites temporários continuam em:

```text
/root/caesaria-game-inspect/resources
```

Pastas mais úteis para próximas fases:

```text
houses/
commerce/
warehouse/
farm/
fountain/
gardens/
plaza/
prefecture/
engineering/
well/
way/
ground/
marketlady/
marketkid/
```

Uso recomendado:

- copiar apenas assets necessários para `public/assets/prototype/`;
- manter nomes de origem no README de assets;
- evitar copiar pastas completas sem necessidade;
- para protótipo pessoal, podemos avançar com estes sprites;
- antes de release pública/comercial, substituir por arte própria ou assets com licença explícita.

### Como isto muda o roadmap

A partir da Fase 13, a Caesaria deve ser usada como fonte de design, não como código a portar diretamente.

Regra prática:

- observar mecânica na Caesaria;
- reduzir para uma versão simples em AICaesar;
- implementar de forma TypeScript idiomática;
- manter sistemas pequenos e testáveis;
- só aumentar fidelidade quando o loop de jogo pedir.

## 34. Próximo passo recomendado

As fases 13–32 foram implementadas como base jogável. O roadmap de releases orientado a valor está em [`documentation/next-releases-roadmap.md`](next-releases-roadmap.md).

A Fase 32 introduziu **Mercado na encruzilhada**: um cenário determinístico em que o mesmo market no tile `(12, 14)` vence com uma construção, enquanto em `(17, 14)` deixa metade das casas sem comida e requer recuperação mais cara.

A próxima fase concreta é a [Fase 33 — Preparar uma crise](phase-33-development-plan.md). Não avançar para LLM real, walkers complexos ou mais edifícios antes de validar estes trade-offs com playtest.
