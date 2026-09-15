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
