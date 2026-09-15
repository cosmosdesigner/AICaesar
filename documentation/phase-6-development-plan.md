# AICaesar — Plano de Desenvolvimento da Fase 6

## Objetivo

Adicionar trabalhadores e emprego como a primeira restrição de capacidade produtiva.

Até agora, farms, granaries e markets funcionam sempre que existem. A Fase 6 deve introduzir uma regra simples: edifícios económicos precisam de trabalhadores. Se a cidade não tiver população ativa suficiente, alguns edifícios ficam inativos e deixam de contribuir para a cadeia de comida.

## Estado atual

Já existe:

- mapa 30x30;
- construção manual de `road`, `house`, `well`, `farm`, `granary`, `market`;
- estado centralizado em `CityState`;
- simulação por tick;
- água por poços;
- comida por farms/granaries/markets;
- casas evoluem até nível 3 com estrada + água + comida;
- overlays de água e comida;
- painel com estatísticas de habitação e comida.

## Escopo da Fase 6

### Inclui

- população derivada das casas;
- força de trabalho derivada da população;
- trabalhadores exigidos por edifício produtivo;
- ativação/inativação de edifícios conforme trabalhadores disponíveis;
- impacto de edifícios inativos na produção/distribuição;
- estatísticas de emprego no painel;
- feedback visual simples para edifícios inativos;
- README atualizado;
- build verificado por comando.

### Exclui

- walkers de trabalhadores;
- commute/pathfinding;
- desemprego avançado;
- salários;
- migração;
- impostos;
- educação/saúde;
- desirability;
- advisor/IA;
- backend/persistência.

## Modelo de dados

### Building

Adicionar campos simples:

```ts
type Building = {
  id: string
  type: BuildingType
  x: number
  y: number

  // existing house/service fields
  level?: number
  hasRoadAccess?: boolean
  hasWater?: boolean
  hasFood?: boolean
  upgradeProgress?: number
  storedFood?: number

  // phase 6
  active?: boolean
  workersRequired?: number
}
```

Regras:

- `active` é relevante para `farm`, `granary`, `market`;
- casas, roads e wells podem ignorar este campo ou ficar sempre ativas;
- `workersRequired` pode ser derivado por função, não precisa necessariamente de ficar guardado no estado.

### Workforce stats

Criar estatísticas derivadas:

```ts
type WorkforceStats = {
  population: number
  workersAvailable: number
  workersRequired: number
  workersAssigned: number
  unemployedWorkers: number
  workerShortage: number
  activeWorkplaces: number
  inactiveWorkplaces: number
}
```

## Regras da população

Cada casa fornece população com base no nível:

```ts
HOUSE_POPULATION_BY_LEVEL = {
  1: 4,
  2: 8,
  3: 14,
}
```

A força de trabalho é uma percentagem fixa da população:

```ts
WORKFORCE_RATIO = 0.5
workersAvailable = floor(population * WORKFORCE_RATIO)
```

Motivo:

- fácil de entender;
- suficiente para criar restrição produtiva;
- evita demografia complexa.

## Regras de trabalhadores por edifício

Valores sugeridos:

```ts
WORKERS_REQUIRED = {
  farm: 6,
  granary: 4,
  market: 5,
}
```

Outros edifícios:

- road: 0;
- house: 0;
- well: 0.

## Algoritmo de atribuição

Manter determinístico e simples.

1. Calcular trabalhadores disponíveis.
2. Listar workplaces: `farm`, `granary`, `market`.
3. Ordenar por prioridade estável:
   1. granary;
   2. farm;
   3. market.
4. Para cada workplace:
   - se houver trabalhadores suficientes, marcar `active = true` e consumir trabalhadores;
   - caso contrário, marcar `active = false`.

Prioridade proposta:

- granary primeiro porque sem storage a produção de comida não tem onde acumular;
- farm segundo porque produz comida;
- market terceiro porque distribui.

Esta prioridade é simplificada. Pode ser revista depois pelo analyzer/advisor.

## Impacto na simulação

### Farms

Só farms ativas produzem comida.

```ts
activeFarms * FARM_FOOD_PER_TICK
```

### Granaries

Só granaries ativas contam para capacidade.

```ts
activeGranaries * GRANARY_CAPACITY
```

Se capacidade ativa cair abaixo da comida armazenada:

```ts
food = min(food, activeCapacity)
```

### Markets

Só markets ativos geram cobertura de comida.

Markets inativos não distribuem comida.

### Casas

Casas continuam a fornecer população independentemente do emprego.

Evolução continua igual:

- nível 2: estrada + água;
- nível 3: estrada + água + comida.

Como comida depende de workplaces ativos, falta de trabalhadores deve indiretamente bloquear evolução para nível 3.

## UI

Atualizar painel para mostrar:

- população;
- trabalhadores disponíveis;
- trabalhadores necessários;
- trabalhadores atribuídos;
- desempregados;
- falta de trabalhadores;
- workplaces ativos;
- workplaces inativos.

Manter painel simples; pode ser uma nova secção `Emprego`.

## Visualização

Adicionar feedback visual simples para edifícios inativos:

- reduzir alpha;
- tint cinzento/vermelho;
- ou overlay pequeno em cima do sprite.

Recomendação: `sprite.alpha = 0.55` e tint ligeiramente vermelho/cinzento em `farm`, `granary`, `market` inativos.

Não adicionar novos assets.

## Simulação

Adicionar função dedicada, por exemplo:

```ts
assignWorkers(city: CityState): void
getPopulation(city: CityState): number
getWorkforceStats(city: CityState): WorkforceStats
isWorkplace(type: BuildingType): boolean
getWorkersRequired(type: BuildingType): number
```

`simulateTick(city)` deve fazer:

1. atribuir trabalhadores;
2. produzir comida apenas com farms ativas;
3. calcular cobertura de comida apenas com markets ativos;
4. atualizar casas.

Stats devem usar a mesma lógica para evitar inconsistências.

## Critérios de aceitação

A Fase 6 está concluída quando:

- `npm run build` passa;
- população é calculada a partir das casas;
- trabalhadores disponíveis são calculados a partir da população;
- farm/granary/market exigem trabalhadores;
- se há trabalhadores suficientes, edifícios económicos ficam ativos;
- se faltam trabalhadores, alguns edifícios ficam inativos;
- farms inativas não produzem comida;
- granaries inativas não contribuem para capacidade;
- markets inativos não distribuem comida;
- UI mostra emprego/trabalhadores;
- edifícios inativos têm feedback visual simples;
- reset restaura cidade, recursos, ticks e estado ativo/inativo;
- README documenta a Fase 6;
- não é feito browser testing.

## Verificação

Verificação mínima obrigatória:

```sh
npm run build
git status --short
```

Smoke test recomendado se for simples:

- cidade com muitas farms e poucas casas deve ter workplaces inativos;
- adicionar/evoluir casas aumenta capacidade laboral;
- farms inativas não aumentam comida;
- markets inativos não dão food coverage.

## Decisões para evitar overengineering

- Sem pathfinding de trabalhadores;
- Sem commute;
- Sem mercado laboral por distrito;
- Sem salários;
- Sem desemprego avançado;
- Sem UI sofisticada;
- Sem simulação por agente;
- Sem IA nesta fase.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 6 incrementalmente;
2. preservar construção, água e comida;
3. manter o estado simples e determinístico;
4. correr `npm run build`;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados, decisões e verificação.
