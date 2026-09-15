# AICaesar — Plano de Desenvolvimento da Fase 4

## Nota

O pedido mencionou "fase 3", mas a Fase 3 já foi concluída e publicada. Este plano avança para a próxima fase definida no roadmap: Fase 4 — água e evolução básica de casas.

## Objetivo

Introduzir a primeira regra real de simulação estilo Caesar III: casas evoluem quando têm acesso a serviços básicos.

Nesta fase, o único serviço implementado é água através de poços.

## Resultado esperado

Ao correr a aplicação:

- casas começam no nível base;
- casas com estrada adjacente e dentro do raio de um poço evoluem após alguns ticks;
- casas sem água permanecem no nível base;
- existe uma indicação visual simples do nível da casa;
- existe um overlay simples de cobertura de água;
- a UI mostra estatísticas de água/habitação.

## Escopo da Fase 4

### Inclui

- simulação por tick simples;
- níveis de casa;
- cálculo de acesso a estrada;
- cálculo de cobertura de água por raio;
- evolução de casas com estrada + água;
- overlay de água;
- painel com estatísticas simples;
- atualização do README.

### Exclui

- comida;
- farms/granaries/markets;
- workers;
- saúde;
- desirability;
- walkers reais;
- advisor;
- LLM;
- pathfinding avançado.

## Modelo de dados

### Building

Expandir `Building` para suportar estado específico por tipo.

Opção simples:

```ts
type Building = {
  id: string
  type: BuildingType
  x: number
  y: number
  level?: number
  hasRoadAccess?: boolean
  hasWater?: boolean
}
```

Para já, `level`, `hasRoadAccess` e `hasWater` só são relevantes para casas.

Não criar hierarquia complexa de classes.

### SimulationState

Adicionar ao `CityState`:

```ts
type SimulationState = {
  tick: number
  waterCoverage: Array<{ x: number; y: number }>
}
```

Ou manter funções derivadas se for mais simples. Evitar estado duplicado se não for necessário.

## Regras da simulação

### Road access

Uma casa tem acesso a estrada se existir uma estrada ortogonalmente adjacente:

- norte;
- sul;
- este;
- oeste.

Não usar diagonais nesta fase.

### Water coverage

Um poço fornece água dentro de raio Manhattan ou Chebyshev simples.

Recomendação: Manhattan radius 3.

```text
abs(dx) + abs(dy) <= 3
```

Motivo:

- fácil de explicar;
- fácil de visualizar;
- suficiente para MVP.

### Evolução da casa

Regras:

- casa começa no nível 1;
- se tiver road access + water durante alguns ticks, evolui para nível 2;
- se não tiver água ou estrada, fica no nível 1;
- não implementar degradação ainda.

Valor sugerido:

```ts
HOUSE_UPGRADE_TICKS = 3
```

Adicionar contador simples:

```ts
serviceTicks?: number
```

Ou guardar no building:

```ts
upgradeProgress: number
```

## Visualização

### Nível da casa

Como temos apenas um sprite de casa, usar indicação visual simples:

- nível 1: sprite normal;
- nível 2: tint/scale/alpha ligeiramente diferente;
- ou pequeno marcador textual/sprite simples por cima.

Recomendação: tint no sprite da casa de nível 2.

Não copiar novos assets nesta fase.

### Overlay de água

Adicionar botão/toggle no painel:

- "Water overlay" on/off.

Quando ativo:

- tiles dentro do raio dos poços têm overlay azul translúcido;
- casas sem água podem ter tint/feedback simples, se for fácil.

O overlay pode ser desenhado com `Graphics` da PixiJS. Não precisa de sprites.

## UI

Atualizar painel para mostrar:

- dinheiro;
- ferramenta selecionada;
- tick atual;
- casas totais;
- casas com estrada;
- casas com água;
- casas nível 2;
- botão/toggle de overlay de água.

Manter UI simples em HTML.

## Simulação

Adicionar loop simples controlado pelo jogo.

Opção recomendada:

- `setInterval` ou Pixi ticker;
- tick a cada 1000ms;
- chama `simulateTick(city)`;
- atualiza renderer;
- atualiza painel.

Para manter simplicidade:

```ts
const tickHandle = window.setInterval(() => {
  simulateTick(city)
  map.refresh(city, { waterOverlay })
  panel.update(...)
}, 1000)
```

Garantir cleanup no retorno de `startGame`.

## Funções esperadas

Possíveis funções em `CityState.ts` ou novo ficheiro `Simulation.ts`:

```ts
simulateTick(city: CityState): void
hasAdjacentRoad(city, building): boolean
hasWaterAccess(city, building): boolean
getWaterCoveredTiles(city): Set<string>
getHousingStats(city): HousingStats
```

Preferência:

- se `CityState.ts` ficar grande, criar `src/simulation/Simulation.ts`;
- caso contrário manter simples.

## Critérios de aceitação

A Fase 4 está concluída quando:

- `npm run build` passa;
- construção manual da Fase 2 continua funcional;
- casas têm nível;
- tick de simulação incrementa;
- casas com estrada + água evoluem para nível 2 após alguns ticks;
- casas sem água não evoluem;
- painel mostra estatísticas de habitação/água;
- overlay de água pode ser ligado/desligado;
- reset restaura casas, tick e dinheiro;
- README é atualizado;
- não há browser testing obrigatório nesta execução.

## Testes por comando

Verificação mínima:

```sh
npm run build
git status --short
```

Se forem adicionados testes unitários simples, melhor, mas não é obrigatório.

## Decisões para evitar overengineering

- Não criar sistema ECS;
- Não criar pathfinding;
- Não criar walkers;
- Não criar animações;
- Não adicionar novos sprites;
- Não introduzir IA;
- Não introduzir stores globais.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 4 com o menor número de mudanças coerente;
2. preservar a construção manual da Fase 2;
3. correr `npm run build`;
4. não fazer browser testing;
5. devolver resumo, ficheiros alterados e verificação.
