# AICaesar — MVP

## 1. Visão

AICaesar é um city builder inspirado no estilo de jogo de Caesar III, mas com uma diferença central: o jogador governa a cidade em cooperação com um agente de IA.

O objetivo do MVP não é recriar Caesar III inteiro. O objetivo é validar se um agente de IA consegue ser um co-governador útil: observar a cidade, identificar problemas, propor planos e executar ações aprovadas pelo jogador.

## 2. Pitch curto

O jogador constrói uma pequena cidade romana. A cidade tem habitação, estradas, água, comida, trabalhadores e economia simples.

O agente de IA atua como conselheiro administrativo. Ele analisa o estado da cidade, explica gargalos e propõe intervenções pequenas e verificáveis.

Exemplo:

> "A zona este tem casas com água, mas sem acesso a comida. Sugiro construir um mercado e ligar esta rua ao celeiro. Custo estimado: 120 denarii. Impacto esperado: +8 casas abastecidas."

O jogador pode aprovar ou rejeitar o plano.

## 3. Princípio do MVP

Construir o menor sistema jogável que prove a cooperação entre jogador e IA.

Não incluir no MVP:

- combate
- religião
- entretenimento
- comércio externo
- impostos avançados
- walkers complexos
- campanhas
- editor de mapas
- simulação social profunda
- múltiplos agentes especializados

## 4. Inspiração Caesar III

O jogo deve preservar a sensação básica de Caesar III:

- construção em grelha/isométrica
- estradas como estrutura da cidade
- casas que evoluem quando têm serviços
- comida e água como necessidades base
- edifícios produtivos
- armazéns/celeiros
- problemas urbanos visíveis
- feedback constante ao jogador

Mas o MVP deve simplificar fortemente as regras.

## 5. Uso de sprites da Caesaria

Para prototipagem visual, vamos usar os sprites já disponíveis localmente em:

```text
/root/caesaria-game-inspect/resources
```

Sprites úteis para o MVP:

```text
ground/
way/
houses/
well/
farm/
warehouse/
commerce/
marketlady/
marketkid/
tree/
gardens/
engineering/
prefecture/
```

### Regra importante sobre assets

Os sprites da Caesaria/Caesar-like são apenas assets temporários de protótipo.

Motivos:

- a licença dos assets não está suficientemente clara para produto final;
- vários projetos Caesar III open-source requerem os assets originais do jogo;
- não devemos assumir que podemos redistribuir estes sprites num produto público/comercial.

Decisão para o MVP:

- usar localmente para validar jogabilidade e direção visual;
- documentar a origem;
- substituir por sprites próprios ou claramente licenciados antes de qualquer release pública.

## 6. Loop principal de jogo

1. O jogador constrói estradas.
2. O jogador coloca casas.
3. Casas atraem população.
4. População fornece trabalhadores.
5. O jogador constrói poços, quintas, celeiros e mercados.
6. A cidade simula produção, armazenamento e distribuição.
7. Casas evoluem se tiverem água e comida.
8. Problemas aparecem: falta de água, falta de comida, falta de trabalhadores, isolamento por estrada.
9. O agente de IA analisa a cidade.
10. O agente propõe um plano.
11. O jogador aprova.
12. O plano é executado pelo motor do jogo.
13. O agente reporta o resultado.

## 7. Loop do agente de IA

O agente não deve controlar livremente o jogo.

Pipeline:

```text
CityState
→ Rule-based Analyzer
→ Issue List
→ AI Advisor
→ Structured Plan
→ Player Approval
→ Action Validator
→ Action Executor
→ After-action Report
```

### Responsabilidade do motor determinístico

O motor do jogo é fonte de verdade para:

- recursos disponíveis;
- regras de construção;
- validade de ações;
- custo;
- simulação;
- efeitos reais das ações.

### Responsabilidade da IA

A IA é responsável por:

- explicar problemas;
- priorizar riscos;
- propor planos;
- justificar trade-offs;
- pedir aprovação;
- resumir resultados.

A IA não decide se uma ação é válida. O motor valida.

## 8. Sistemas do MVP

### 8.1 Mapa

- grelha 40x40 ou 30x30;
- top-down/isométrico simples;
- tiles com terreno base;
- tiles ocupados por edifícios;
- overlay de serviços.

### 8.2 Edifícios

MVP inicial:

| Edifício | Função |
|---|---|
| Road | Liga casas e serviços |
| House | Gera população e impostos simples |
| Well | Fornece água num raio limitado |
| Farm | Produz comida |
| Granary | Armazena comida |
| Market | Distribui comida a casas próximas |

### 8.3 Recursos

- dinheiro;
- população;
- trabalhadores disponíveis;
- comida produzida;
- comida armazenada;
- cobertura de água;
- cobertura de comida;
- satisfação simples.

### 8.4 Habitação

Estados simples:

1. Tent
2. Shack
3. Small House
4. Good House

Regras:

- casa sem estrada não evolui;
- casa com estrada + água melhora;
- casa com estrada + água + comida melhora mais;
- casa sem água ou comida degrada lentamente.

### 8.5 Produção e distribuição

- farms produzem comida por tick;
- granaries armazenam comida;
- markets retiram comida do granary e distribuem por raio;
- casas consomem comida periodicamente.

Não implementar walkers reais no primeiro MVP. Distribuição pode ser por raio ou distância calculada por estrada.

## 9. Ações estruturadas do agente

O agente deve devolver planos estruturados, não texto livre executável.

Exemplo:

```ts
type AdvisorAction =
  | { type: 'build'; building: 'well'; x: number; y: number }
  | { type: 'build'; building: 'farm'; x: number; y: number }
  | { type: 'build'; building: 'granary'; x: number; y: number }
  | { type: 'build'; building: 'market'; x: number; y: number }
  | { type: 'buildRoad'; path: Array<{ x: number; y: number }> }
```

Plano:

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

## 10. Validador de ações

Antes de executar qualquer plano, validar:

- existe dinheiro suficiente;
- tile está livre;
- edifício é permitido;
- ação está dentro do orçamento aprovado;
- plano não excede limite de ações;
- ação não demole nada;
- ação não altera regras globais sem autorização.

No MVP, a IA nunca pode demolir edifícios.

## 11. UI mínima

Painéis:

1. Build Panel
   - road
   - house
   - well
   - farm
   - granary
   - market

2. City Stats
   - dinheiro
   - população
   - trabalhadores
   - comida
   - casas com água
   - casas com comida

3. Advisor Panel
   - problemas encontrados
   - plano sugerido
   - botão aprovar
   - botão rejeitar

4. Overlay buttons
   - water coverage
   - food coverage
   - road access

## 12. Primeira versão do agente

A primeira versão pode ser híbrida:

- analyzer determinístico detecta problemas;
- IA transforma problemas em explicação e plano;
- se a integração LLM atrasar, usar um advisor mock determinístico com a mesma interface.

Isto permite desenvolver o jogo sem bloquear na IA.

## 13. Problemas que o agente deve detetar no MVP

O agente deve detetar pelo menos:

1. casas sem água;
2. casas sem comida;
3. falta de produção de comida;
4. comida produzida mas sem distribuição;
5. edifícios sem trabalhadores;
6. estradas desconectadas;
7. dinheiro insuficiente para plano ideal.

## 14. Milestones

### Milestone 1 — Base visual

- projeto web inicial;
- mapa com tiles;
- renderização com sprites da Caesaria;
- seleção de ferramenta de construção;
- colocar estrada, casa e poço.

### Milestone 2 — Simulação simples

- população;
- trabalhadores;
- água;
- comida;
- farms;
- granaries;
- markets;
- evolução simples de casas.

### Milestone 3 — Analyzer

- gerar `CityStateSummary`;
- detetar problemas;
- produzir issue list ordenada por severidade;
- overlays para visualizar problemas.

### Milestone 4 — Advisor

- painel do advisor;
- explicação em linguagem natural;
- plano estruturado;
- aprovação/rejeição;
- validação e execução de plano.

### Milestone 5 — After-action report

- comparar antes/depois;
- reportar impacto;
- indicar problema remanescente.

## 15. Critérios de aceitação do MVP

O MVP está validado quando:

- o jogador consegue construir uma pequena cidade;
- casas precisam de estrada, água e comida;
- farms produzem comida;
- granaries armazenam comida;
- markets distribuem comida;
- casas evoluem quando necessidades são satisfeitas;
- o agente identifica corretamente os 3 principais problemas da cidade;
- o agente propõe um plano válido;
- o jogador consegue aprovar o plano;
- o motor executa apenas ações validadas;
- o agente reporta o resultado;
- os sprites temporários da Caesaria aparecem no mapa.

## 16. Riscos

### Risco: tentar recriar Caesar III completo

Mitigação:

- limitar MVP a água, comida, habitação e advisor.

### Risco: IA alucinar ações inválidas

Mitigação:

- ações estruturadas;
- action validator obrigatório;
- motor determinístico como fonte de verdade.

### Risco: problemas de licença dos sprites

Mitigação:

- usar sprites apenas localmente;
- documentar origem;
- substituir antes de release.

### Risco: UI ficar complexa cedo demais

Mitigação:

- começar com top-down/isométrico simples;
- overlays básicos;
- sem walkers animados no MVP.

## 17. Recomendação técnica

Stack sugerida:

- TypeScript;
- Vite;
- PixiJS;
- estado simples em TypeScript puro no início;
- LLM/advisor atrás de uma interface;
- sem backend no primeiro MVP, salvo se for necessário para chamadas de IA.

Estrutura futura:

```text
src/
  simulation/
  advisor/
  rendering/
  ui/
  assets/
  game/
```

## 18. Próximo passo

Próximo deliverable recomendado:

Criar o esqueleto técnico do projeto com:

- Vite + TypeScript;
- PixiJS;
- mapa 30x30;
- carregamento de alguns sprites da Caesaria;
- ferramenta para colocar estrada e casa;
- `CityState` inicial.
