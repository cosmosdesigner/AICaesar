# AICaesar — Plano de Desenvolvimento da Fase 5

## Objetivo

Criar a primeira cadeia económica do jogo: comida.

A Fase 5 deve introduzir produção, armazenamento e distribuição simples de comida sem walkers reais. O objetivo é transformar a simulação de casas de uma regra isolada de água para uma regra económica mínima:

- farms produzem comida;
- granaries armazenam comida;
- markets distribuem comida às casas próximas;
- casas com água + comida evoluem mais;
- casas sem comida ficam sinalizadas.

## Estado atual

Já existe:

- mapa 30x30;
- construção manual de `road`, `house`, `well`;
- estado centralizado em `CityState`;
- `Building` com estado de casa;
- tick de simulação;
- acesso a estrada;
- cobertura de água por poços;
- casas evoluem para nível 2 com estrada + água;
- overlay de água;
- painel com estatísticas de água/habitação.

## Escopo da Fase 5

### Inclui

- novos tipos de edifício:
  - `farm`;
  - `granary`;
  - `market`;
- custos de construção para estes edifícios;
- botões no painel para construir estes edifícios;
- sprites temporários para estes edifícios;
- produção de comida por farms;
- armazenamento de comida em granaries;
- distribuição simples por markets;
- estado de comida nas casas;
- overlay de cobertura de comida;
- estatísticas de comida no painel;
- evolução de casas com água + comida;
- README atualizado;
- build verificado por comando.

### Exclui

- walkers reais;
- pathfinding por estrada;
- carrinhos/entregas animadas;
- múltiplos tipos de comida;
- emprego/trabalhadores;
- impostos/economia monetária;
- desirability;
- advisor/IA;
- backend ou persistência.

## Assets temporários

Usar sprites temporários do clone local Caesaria quando existirem:

- farm: `/root/caesaria-game-inspect/resources/farm/vegfarm_00001.png` ou equivalente;
- granary: usar temporariamente warehouse como armazenamento, por exemplo `/root/caesaria-game-inspect/resources/warehouse/warehouse_00001.png`;
- market: usar sprite disponível de market/marketkid se houver algo adequado.

Copiar apenas os ficheiros mínimos para:

```text
public/assets/prototype/farm/
public/assets/prototype/granary/
public/assets/prototype/market/
```

Manter o aviso de licenciamento: estes assets são apenas para protótipo.

Se algum sprite não existir, usar fallback visual simples em PixiJS ou reutilizar temporariamente um sprite existente, mas documentar no README.

## Modelo de dados

### BuildingType

Expandir:

```ts
type BuildingType = 'road' | 'house' | 'well' | 'farm' | 'granary' | 'market'
```

### Building

Adicionar estado mínimo:

```ts
type Building = {
  id: string
  type: BuildingType
  x: number
  y: number

  // house
  level?: number
  hasRoadAccess?: boolean
  hasWater?: boolean
  hasFood?: boolean
  upgradeProgress?: number

  // storage / production
  storedFood?: number
}
```

`storedFood` é relevante principalmente para granaries. Farms podem produzir diretamente para armazenamento global/granary.

### ResourceState

Expandir:

```ts
type ResourceState = {
  money: number
  food: number
}
```

Interpretação recomendada:

- `food` representa stock total armazenado nos granaries;
- manter simples nesta fase;
- se usar `storedFood` por granary, `resources.food` deve ser derivado ou mantido sincronizado com cuidado.

Preferência para MVP:

- usar `city.resources.food` como stock central;
- granaries são capacidade de armazenamento;
- evita complexidade prematura.

### Food stats

Criar estatísticas derivadas:

```ts
type FoodStats = {
  farms: number
  granaries: number
  markets: number
  foodStored: number
  foodCapacity: number
  housesWithFood: number
  foodCoveredTiles: number
}
```

## Regras da simulação

### Produção

Cada farm produz comida por tick.

Valores simples:

```ts
FARM_FOOD_PER_TICK = 2
GRANARY_CAPACITY = 100
```

Produção entra em `city.resources.food`, limitada por capacidade total:

```ts
capacity = numberOfGranaries * GRANARY_CAPACITY
city.resources.food = min(capacity, city.resources.food + activeFarms * FARM_FOOD_PER_TICK)
```

Se não houver granary, a produção não deve acumular.

Motivo: força o jogador a construir armazenamento.

### Distribuição

Markets distribuem comida às casas dentro de raio simples.

Recomendação:

```ts
MARKET_FOOD_RADIUS = 4
HOUSE_FOOD_CONSUMPTION_INTERVAL = 2 // ticks
```

Para manter simples:

- calcular `foodCoverage` por raio Manhattan 4 a partir dos markets;
- uma casa tem `hasFood = true` se estiver dentro da cobertura de market e existir comida armazenada;
- a cada 2 ticks, cada casa coberta consome 1 unidade de comida, até acabar o stock;
- se a comida acabar, casas restantes ficam `hasFood = false`.

Não implementar ordem sofisticada. A ordem por coordenadas/array é aceitável para MVP.

### Evolução de casas

Manter níveis simples:

- nível 1: base;
- nível 2: estrada + água;
- nível 3: estrada + água + comida.

Regras:

- casa começa nível 1;
- com estrada + água, progride para nível 2 como na Fase 4;
- com estrada + água + comida, progride para nível 3;
- sem comida não passa para nível 3;
- não implementar degradação ainda.

Valores sugeridos:

```ts
HOUSE_LEVEL_2_TICKS = 3
HOUSE_LEVEL_3_TICKS = 5
```

Pode reutilizar `upgradeProgress`, mas cuidado para não misturar progresso entre níveis. Se necessário, usar `targetLevel` simples ou resetar progresso quando o nível muda.

## Visualização

### Edifícios

Adicionar sprites para:

- farm;
- granary;
- market.

### Níveis das casas

Manter tint/feedback simples:

- nível 1: normal;
- nível 2: tint atual;
- nível 3: tint diferente, por exemplo verde/dourado.

### Food overlay

Adicionar toggle no painel:

- `Food overlay: On/Off`.

Quando ativo:

- tiles cobertos por markets aparecem com overlay verde/translúcido;
- casas sem comida podem ter leve tint vermelha/laranja se for simples;
- não adicionar popups complexos.

Manter overlay de água existente.

## UI

Atualizar painel para mostrar:

- dinheiro;
- ferramenta selecionada;
- tick;
- food stored / capacity;
- farms;
- granaries;
- markets;
- houses with food;
- houses level 3;
- toggles de overlay:
  - água;
  - comida.

Pode ficar compacto; não precisa de design final.

## Seed inicial

Pode manter a seed atual sem farms/granaries/markets.

Opcionalmente adicionar uma farm/granary/market inicial apenas se isso ajudar a demonstrar a cadeia. Preferência: não adicionar automaticamente para preservar construção manual e obrigar o jogador a construir.

## Custos sugeridos

```ts
farm: 45
granary: 60
market: 50
```

Ajustar se necessário para caber no dinheiro inicial de 500.

## Critérios de aceitação

A Fase 5 está concluída quando:

- `npm run build` passa;
- `road`, `house`, `well`, `farm`, `granary`, `market` aparecem como ferramentas de construção;
- farms produzem comida por tick;
- comida não acumula sem granary;
- granaries aumentam capacidade;
- markets dão cobertura de comida por raio;
- casas dentro de cobertura de market e com comida disponível ficam com `hasFood = true`;
- casas consomem comida ao longo dos ticks;
- casas com estrada + água + comida conseguem evoluir para nível 3;
- casas sem comida não evoluem para nível 3;
- painel mostra stats de comida;
- overlay de comida pode ser ligado/desligado;
- reset restaura dinheiro, comida, tick e cidade;
- README documenta a Fase 5 e os assets temporários;
- não é feito browser testing.

## Verificação

Verificação mínima:

```sh
npm run build
git status --short
```

Se for simples adicionar smoke test por script TypeScript/Node, pode ser feito, mas não é obrigatório.

## Decisões para evitar overengineering

- Não implementar pathfinding;
- Não implementar walkers;
- Não criar simulação por agentes;
- Não criar economia completa;
- Não criar tipos de comida;
- Não criar UI complexa;
- Não criar ECS;
- Não introduzir backend.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 5 de forma incremental;
2. preservar a construção manual, estado centralizado e simulação de água;
3. copiar apenas assets mínimos necessários;
4. correr `npm run build`;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados, decisões e verificação.
