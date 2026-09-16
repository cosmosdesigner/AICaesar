# AICaesar — Plano de Desenvolvimento da Fase 19

## Objetivo

Fazer com que o layout de estradas tenha impacto real na simulação.

Na Fase 18, um edifício podia funcionar ou prestar serviço com base em adjacência directa ou distância Manhattan. Isso é suficiente para uma demo inicial, mas não cria uma decisão de planeamento urbano: uma estrada isolada podia activar edifícios e um serviço podia alcançar uma casa através de obstáculos que não pertencem à rede viária.

A Fase 19 introduz uma rede de estradas determinística:

```text
road tiles → componente principal → buildings ligados
                         ↓
            distância BFS pela estrada
                         ↓
        alcance real de água e comida
```

Resultado esperado:

- estradas ligadas à rede principal funcionam;
- estradas isoladas não activam edifícios;
- wells, markets e granaries usam distância pela rede;
- farms isoladas deixam de produzir;
- o jogador precisa de construir bairros conectados, não apenas edifícios próximos.

## Estado actual

- `hasAdjacentRoad()` só verifica os quatro tiles vizinhos;
- água usa cobertura Manhattan com raio 3;
- logística usa distância Manhattan:
  - granary → market: 8;
  - market → house: 4;
- `assignWorkers()` activa farms, granaries e markets apenas com base em workers;
- não existe conceito de componente/rede de estradas;
- existem overlays de água e comida;
- a renderer já permite desenhar overlays por tile;
- não existem walkers nem pathfinding geral.

## Escopo

### Inclui

- módulo determinístico de road network;
- BFS sobre tiles ocupados por roads;
- identificação da componente principal da rede;
- conectividade de edifícios à rede principal;
- distância mínima pela rede entre edifícios e casas;
- farms, granaries e markets isolados ficam inactivos;
- wells isolados deixam de prestar cobertura;
- houses só têm road access quando estão ligadas à rede principal;
- água baseada em road distance;
- food supply e food delivery baseados em road distance;
- overlay da rede de estradas;
- stats de rede no painel;
- testes unitários e actualização do README.

### Exclui

- walkers visuais;
- cidadãos individuais;
- pathfinding de unidades;
- tráfego, congestionamento ou capacidade de estradas;
- sentidos únicos;
- pontes, túneis ou tipos de estrada;
- road upgrades;
- custos variáveis de manutenção por comprimento;
- desirability;
- eventos;
- save/load;
- alterações ao advisor ou novas actions;
- browser/manual UI testing.

## Modelo de rede

Criar um módulo focado, por exemplo:

```text
src/simulation/RoadNetwork.ts
```

A implementação pode usar os tipos existentes (`CityState`, `Building`, `Tile`) e não deve adicionar dependências.

### Tiles de estrada

Uma tile pertence à rede viária quando contém um building de tipo `road`.

A conectividade entre roads usa apenas vizinhos ortogonais:

```text
(x, y - 1)
(x + 1, y)
(x, y + 1)
(x - 1, y)
```

Não usar diagonais.

### Componente principal

A rede principal é a maior componente ortogonal de road tiles.

Em caso de empate, escolher deterministicamente a componente cujo primeiro tile ordenado por `y` e depois `x` seja menor. Isto evita depender da ordem de inserção dos buildings.

Se não existirem roads:

- a rede principal está vazia;
- nenhum edifício está ligado;
- houses não têm road access;
- workplaces ficam inactivos;
- wells não cobrem tiles.

Expor funções pequenas e testáveis, por exemplo:

```ts
interface RoadNetwork {
  readonly mainRoadTiles: ReadonlySet<string>
  readonly connectedBuildingIds: ReadonlySet<string>
}

function getRoadNetwork(city: CityState): RoadNetwork
function getRoadNetworkTiles(city: CityState): Set<string>
function isBuildingOnRoadNetwork(city: CityState, building: Building): boolean
function getRoadDistance(city: CityState, source: Building, target: Building): number | undefined
```

Os nomes exactos ficam ao critério do OMP, desde que a separação de responsabilidades seja equivalente.

## Edifícios ligados à rede

Um edifício que não é road está ligado à rede quando pelo menos um dos seus quatro tiles vizinhos é um tile de road pertencente à componente principal.

Consequências:

- uma house junto a uma road isolada continua sem road access;
- uma house ligada à componente principal tem road access;
- farm, granary e market só podem ser activos quando ligados à componente principal;
- um well só fornece água quando ligado à componente principal.

A regra de adjacência continua a ser usada para o ponto de contacto do edifício com a estrada, mas a road tem de pertencer à rede principal.

O helper existente `hasAdjacentRoad()` deve passar a reflectir a rede principal, para que `getHouseServices()`, `getHousingStats()` e o analyzer usem a mesma fonte de verdade.

## Distância pela estrada

A distância de serviço é calculada sobre os road tiles da componente principal.

Para um edifício fonte e um edifício alvo:

1. recolher as roads principais ortogonalmente adjacentes ao source;
2. recolher as roads principais ortogonalmente adjacentes ao target;
3. correr BFS multi-source a partir das roads do source;
4. devolver a menor distância até uma road do target;
5. devolver `undefined` se source ou target não estiver ligado à rede principal.

A distância considera o número de passos entre road tiles. Não incluir o custo de entrar/sair do edifício, para manter as regras simples e estáveis.

O resultado deve ser determinístico e não deve mutar a cidade.

Se source e target partilharem uma road adjacente, a distância é 0.

## Serviços

### Água

Substituir a cobertura Manhattan directa por cobertura através da rede:

- well activo apenas se estiver ligado à rede principal;
- uma house recebe água se estiver ligada à rede e existir well ligado;
- a distância BFS entre well e house deve ser `<= WATER_RADIUS`;
- manter `WATER_RADIUS = 3` nesta fase;
- `getWaterCoveredTiles()` deve devolver apenas tiles efectivamente cobertos pela rede.

A cobertura visual deve continuar a mostrar tiles cobertos, mas agora baseada em road reach. É aceitável incluir no conjunto as tiles de estrada percorridas e as tiles de edifícios servidos, desde que a semântica seja consistente e testada.

### Comida: farm → granary

- farms isoladas não ficam activas e não produzem;
- granaries isolados não ficam activos e não armazenam/recebem produção;
- a produção continua a ser `FARM_FOOD_PER_TICK = 2`;
- nesta fase, manter o modelo de armazenamento actual;
- não introduzir walkers ou reservas de transporte.

O transporte farm → granary continua abstracto, mas apenas edifícios ligados à rede podem participar na economia de comida.

### Comida: granary → market

Substituir o filtro Manhattan por road distance:

- granary e market têm de estar ligados à rede;
- manter `MARKET_SUPPLY_RADIUS = 8`;
- só granaries alcançáveis dentro dessa distância podem abastecer o market;
- manter a ordenação determinística por distância e posição.

### Comida: market → house

Substituir o filtro Manhattan por road distance:

- market e house têm de estar ligados à rede;
- manter `MARKET_FOOD_RADIUS = 4`;
- uma house só recebe comida quando existe market activo, com stock, alcançável dentro do raio;
- consumo de comida e stock permanecem iguais aos da Fase 17.

## Ordem da simulação

Preservar a ordem determinística existente, ajustando apenas a fonte de conectividade:

1. incrementar tick;
2. calcular/usar a rede principal;
3. atribuir workers, activando apenas workplaces ligados;
4. produzir comida;
5. reabastecer markets através da rede;
6. calcular água e comida por road reach;
7. actualizar serviços e população das houses;
8. actualizar níveis/degradação;
9. reatribuir workers;
10. aplicar finanças quando aplicável.

Pode ser calculada uma representação da rede por tick e reutilizada pelas operações desse tick, desde que não fique estado derivado obsoleto no `CityState`.

Não guardar a rede calculada dentro do saveable `CityState` nesta fase.

## Workforce e activação

Actualizar `assignWorkers()` e `getWorkforceStats()` para que um workplace só conte como activo quando:

1. está ligado à rede principal;
2. recebe workers suficientes segundo as regras existentes.

Um workplace isolado deve:

- contar como workplace requerido;
- ficar inactivo;
- não produzir comida nem contribuir para armazenamento/distribuição.

A ordenação de prioridade existente mantém-se:

```text
granary → farm → market
```

Não alterar custos nem requisitos de workers nesta fase.

## UI e feedback

Adicionar ao painel:

```text
Road network: 42 tiles
Connected buildings: 9/14
Isolated buildings: 5
```

Adicionar botão de overlay:

```text
Show road network: Off/On
```

O overlay deve distinguir visualmente, tanto quanto possível:

- roads pertencentes à rede principal;
- roads isoladas;
- opcionalmente buildings ligados/isolados através de tint ou alpha.

Não é necessário criar uma nova janela. Reutilizar o padrão existente de water/food overlays.

Actualizar mensagens e tooltips relevantes:

- roads ligam edifícios à rede principal;
- proximidade sem ligação viária não é suficiente;
- farms, granaries, markets e wells isolados não funcionam.

O estado da câmara deve continuar preservado durante refreshes e toggles.

## Analyzer e advisor

O `CityAnalyzer` deve usar a nova definição de road access.

Actualizar causas para distinguir:

- edifício sem qualquer road adjacente;
- edifício junto a uma road isolada;
- serviço fora do alcance pela rede.

Não adicionar novos tipos de advisor action.

O advisor existente pode continuar a sugerir `build_road`, mas deve receber dados coerentes através do analyzer e dos stats actuais.

## Compatibilidade

Preservar:

- seed inicial jogável;
- food logistics da Fase 17;
- população/migração da Fase 18;
- economia;
- house specification;
- cenário;
- câmara pan/zoom/center;
- advisor, validator e executor;
- reset;
- ausência de browser testing.

A seed actual já contém uma estrada horizontal e edifícios próximos. O OMP deve confirmar que o cenário continua funcional e ajustar apenas a seed se existir uma incompatibilidade concreta com a rede principal.

## Testes obrigatórios

Seguir TDD: testes novos devem ser escritos e executados em estado RED antes do código de produção.

Testes mínimos:

1. roads ortogonalmente ligadas pertencem à mesma componente;
2. roads diagonais não pertencem à mesma componente;
3. a maior componente é escolhida como rede principal;
4. empates na componente principal são resolvidos deterministicamente;
5. house junto à rede principal tem road access;
6. house junto a road isolada não tem road access;
7. edifício sem road adjacente não está ligado;
8. road distance encontra o caminho mínimo;
9. road distance devolve `undefined` entre componentes isoladas;
10. well ligado cobre house dentro do raio BFS;
11. well próximo mas desligado não cobre house;
12. market não alimenta house apenas porque está perto em Manhattan;
13. market alimenta house quando existe caminho viário dentro do raio;
14. granary/market fora da rede não participam na logística;
15. farm isolada fica inactiva e não produz;
16. workplace ligado continua a respeitar falta de workers;
17. overlay de road network distingue a rede calculada;
18. stats de tiles/buildings ligados são determinísticos;
19. seed e cenário continuam a iniciar correctamente;
20. regressão completa de food logistics, population e finance.

## Critérios de aceitação

A Fase 19 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- existe cálculo BFS da rede principal;
- roads isoladas não activam edifícios;
- buildings ligados à rede são identificados de forma determinística;
- distância de água usa a rede e não Manhattan directo;
- distância de comida usa a rede e não Manhattan directo;
- farms, granaries e markets isolados não funcionam;
- workforce mantém as regras actuais para edifícios ligados;
- overlay de rede está disponível;
- UI mostra informação de conectividade;
- analyzer usa road access real;
- seed, população, economia, cenário e advisor não regridem;
- não são adicionados walkers nem dependências novas;
- não é feito browser testing;
- working tree fica limpo depois do commit/push.

## Decisões para evitar overengineering

- BFS simples em cada tick; sem sistema genérico de pathfinding;
- componente principal = maior componente de roads;
- vizinhança ortogonal apenas;
- sem walkers;
- sem tráfego ou congestionamento;
- sem cache persistente no `CityState`;
- sem novos edifícios;
- sem novas actions do advisor;
- sem dependências novas;
- sem browser testing.

## Entrega esperada do OMP

O OMP deve:

1. implementar exclusivamente a Fase 19;
2. seguir TDD para o módulo de road network e alterações de simulação;
3. preservar as fases 1–18;
4. actualizar testes, README e UI necessários;
5. correr `npm run build` e `npm test`;
6. não usar browser testing;
7. devolver resumo, ficheiros alterados e evidência de verificação.
