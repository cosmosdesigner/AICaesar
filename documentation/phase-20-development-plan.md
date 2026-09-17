# AICaesar — Plano de Desenvolvimento da Fase 20

## Objetivo

Adicionar desirability e qualidade urbana como decisão de layout.

Até à Fase 19, uma casa evolui com base em acesso à rede principal, água e comida. Isso cria decisões de conectividade, mas ainda permite misturar habitação, farms, granaries e markets sem penalização urbana.

A Fase 20 introduz um modelo determinístico de qualidade urbana:

```text
edifícios próximos → modificadores por tile → desirability da casa
                                     ↓
                evolução/degradação de casas + analyzer + overlay
```

Resultado esperado:

- casas perto de gardens/plazas/fountains evoluem melhor;
- casas perto de farms, granaries ou markets têm pior qualidade urbana;
- o jogador passa a separar zonas produtivas de bairros residenciais;
- o analyzer deteta baixa desirability como problema próprio;
- o overlay mostra claramente áreas boas e más.

## Estado atual

- `BuildingType` contém apenas `road`, `house`, `well`, `farm`, `granary` e `market`;
- `BUILD_COSTS`, `BUILD_LABELS`, tooltips e assets cobrem esses seis edifícios;
- casas usam `HouseSpecification.ts` para requisitos por nível:
  - nível 1: sem requisitos;
  - nível 2: estrada + água;
  - nível 3: estrada + água + comida;
- `simulateTick()` calcula serviços e chama `updateHouseLevel()` apenas com `HouseServices`;
- `HousingStats` conta bloqueios por road/water/food e casas em degradação;
- existem overlays de água, comida e rede viária;
- `MapRenderer` já suporta tint/alpha de sprites e overlay por tile;
- `CityAnalyzer` gera issues para água, comida, produção/distribuição, workers, estrada e dinheiro;
- não existe desirability, jardins, plazas, fountains nem quality-of-life buildings.

## Escopo

### Inclui

- novos tipos de edifício:
  - `garden`;
  - `plaza`;
  - `fountain`;
- custos, labels, tooltips, validação e construção manual para esses edifícios;
- assets temporários/reutilizados de forma explícita quando não houver sprite próprio disponível;
- módulo determinístico de desirability;
- cálculo de desirability por tile/casa;
- efeitos positivos de garden/plaza/fountain;
- efeitos negativos de farm/granary/market próximos;
- integração de desirability na evolução/degradação de casas;
- stats de desirability no painel;
- overlay de desirability;
- issue de analyzer para baixa desirability;
- testes unitários para o modelo e regressões de housing/analyzer/UI headless;
- atualização do README.

### Exclui

- safety/prefecture;
- crime, fire, disease ou outros eventos;
- walkers;
- pathfinding adicional;
- múltiplos níveis de desirability visual complexos por bairro;
- manutenção/upkeep para garden/plaza/fountain nesta fase, salvo se a implementação existente exigir explicitamente um valor simples;
- demolição;
- save/load;
- novas actions do advisor;
- LLM real;
- browser/manual UI testing.

## Modelo de desirability

Criar um módulo pequeno e testável, por exemplo:

```text
src/simulation/Desirability.ts
```

O módulo deve ser puro e derivar tudo de `CityState`, sem persistir valores calculados no estado saveable.

API sugerida:

```ts
interface DesirabilityBreakdown {
  readonly score: number;
  readonly positive: number;
  readonly negative: number;
}

interface DesirabilityStats {
  readonly average: number;
  readonly housesWithLowDesirability: number;
  readonly housesWithGoodDesirability: number;
}

function getTileDesirability(city: CityState, x: number, y: number): DesirabilityBreakdown
function getHouseDesirability(city: CityState, house: Building): DesirabilityBreakdown
function getDesirabilityOverlayTiles(city: CityState): Map<string, DesirabilityBreakdown>
function getDesirabilityStats(city: CityState): DesirabilityStats
```

Os nomes exatos ficam ao critério do OMP, desde que a responsabilidade fique separada de `Simulation.ts`.

### Score

Usar uma escala simples e clampada:

```text
score: 0–100
base: 50
```

Regras iniciais:

- `garden`: efeito positivo pequeno, curto alcance;
- `plaza`: efeito positivo médio, alcance médio;
- `fountain`: efeito positivo médio/alto, alcance médio;
- `farm`: efeito negativo médio;
- `granary`: efeito negativo médio;
- `market`: efeito negativo pequeno/médio.

Exemplo aceitável de constantes:

```text
base = 50
low threshold = 40
good threshold = 60

garden: +8, radius 2
plaza: +12, radius 3
fountain: +15, radius 3
farm: -10, radius 3
granary: -12, radius 3
market: -6, radius 2
```

O OMP pode ajustar valores ligeiramente se os testes/seed ficarem instáveis, mas deve manter a intenção: amenities melhoram habitação, economia/comida perto de casas prejudica.

### Distância

Usar distância Manhattan por tile nesta fase, não road distance.

Razões:

- desirability representa ambiente urbano local, não prestação de serviço por rede;
- evita acoplar qualidade urbana à rede viária da Fase 19;
- mantém o modelo previsível e barato.

A distância deve ser inclusiva no raio e determinística.

### Stacking

- somar todos os modificadores dentro do alcance;
- clamp final entre 0 e 100;
- não introduzir falloff nesta fase, para manter os testes e explicação simples;
- não guardar cache persistente no `CityState`.

## Novos edifícios

Atualizar `BuildingType`:

```ts
export type BuildingType = 'road' | 'house' | 'well' | 'farm' | 'granary' | 'market' | 'garden' | 'plaza' | 'fountain';
```

Custos sugeridos:

```text
garden: 12
plaza: 25
fountain: 40
```

Sem workers nesta fase.

Sem storedFood, active ou população.

### Assets

Preferência:

1. se já existirem assets adequados em `public/assets/prototype`, reutilizar com nomes explícitos;
2. se não existirem, reutilizar temporariamente sprites existentes com tint diferenciador ou criar placeholder simples via renderer;
3. documentar claramente no README que são assets temporários/placeholders.

Não bloquear a fase por falta de arte própria.

## Integração com evolução de casas

Adicionar desirability aos serviços/requisitos de habitação sem reescrever todo o modelo.

Opção preferida:

- estender `HouseServices` com `desirability: boolean` ou adicionar um campo equivalente de qualidade;
- nível 1 continua sem requisito;
- nível 2 continua a exigir estrada + água;
- nível 3 passa a exigir estrada + água + comida + desirability suficiente.

Regra sugerida:

```text
low desirability threshold: < 40
good desirability threshold: >= 60
```

- casas com `score >= 60` podem evoluir para nível 3 quando também têm comida;
- casas com `score < 40` devem degradar se estiverem em nível 2 ou 3, mesmo que tenham serviços;
- casas entre 40 e 59 são aceitáveis para manter nível 2, mas não suficientes para upgrade para nível 3.

Se a estrutura de `HouseSpecification.ts` tornar esta extensão demasiado invasiva, o OMP deve escolher a menor alteração que preserve estes comportamentos observáveis.

## Stats e painel

Adicionar ao painel valores simples:

```text
Avg desirability: 56
Low desirability houses: 2
Good desirability houses: 5
```

Adicionar botão:

```text
Show desirability: Off/On
```

O overlay deve mostrar, de forma simples:

- verde: desirability boa (`>= 60`);
- amarelo/laranja: média (`40–59`);
- vermelho: baixa (`< 40`).

O overlay pode pintar apenas tiles com edifícios/houses ou todos os tiles do mapa. Preferir todos os tiles se o custo for trivial em 30×30, porque ajuda o jogador a planear.

Preservar:

- pan/zoom atual em refreshes e toggles;
- overlays existentes;
- reset;
- cenário;
- pausa/velocidade;
- comportamento do advisor.

## Analyzer e advisor

Adicionar issue type, por exemplo:

```ts
'low_desirability'
```

A issue deve ser criada quando existir pelo menos uma house com desirability baixa.

Critérios:

- severity `high` se mais de metade das casas tiver baixa desirability;
- `medium` se houver duas ou mais;
- `low` se houver uma;
- `affectedTiles` contém as casas afetadas, ordenadas deterministicamente;
- `cause` deve explicar se há demasiada proximidade a farms/granaries/markets e/ou falta de amenities.

Não adicionar novas actions do advisor nesta fase. O mock pode continuar a sugerir planos existentes, mas o analyzer deve tornar visível o problema.

## Compatibilidade

Preservar:

- build Vite/TypeScript;
- testes existentes;
- rede viária da Fase 19;
- food logistics da Fase 17;
- população/migração da Fase 18;
- cenário da Fase 13;
- finanças;
- action validator/executor;
- advisor approval/report;
- câmara e input;
- ausência de browser/manual UI testing.

A seed inicial pode começar com desirability média/baixa perto de farms/granaries/market. Só ajustar a seed se a simulação inicial ficar quebrada ou se o cenário ficar impossível por regressão direta desta fase.

## Testes obrigatórios

Seguir TDD para o módulo de desirability e alterações determinísticas.

Testes mínimos:

1. tile sem modificadores fica com score base;
2. garden aumenta desirability de uma house dentro do raio;
3. plaza/fountain aumentam desirability dentro do raio configurado;
4. farm/granary/market reduzem desirability dentro do raio;
5. modificadores fora do raio não afetam score;
6. múltiplos modificadores fazem stacking e clamp entre 0 e 100;
7. overlay classifica tiles baixa/média/boa de forma determinística;
8. stats calculam média e contagens de houses low/good;
9. house com serviços e desirability boa pode evoluir para nível 3;
10. house com serviços mas desirability média não evolui para nível 3;
11. house com baixa desirability degrada quando acima do nível permitido;
12. desirability não altera road access, water ou food reach;
13. novos edifícios podem ser construídos e descontam custo correto;
14. garden/plaza/fountain não exigem workers;
15. analyzer emite `low_desirability` para casas afetadas;
16. analyzer mantém ordenação determinística de issues;
17. renderer suporta overlay de desirability sem quebrar water/food/road overlays;
18. reset preserva comportamento esperado e recria cidade sem estado derivado;
19. seed inicial continua a iniciar e simular;
20. regressão completa de food logistics, population, finance, road network, advisor e scenario.

## Critérios de aceitação

A Fase 20 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- existem `garden`, `plaza` e `fountain` como ferramentas de construção;
- desirability é calculada de forma pura e determinística;
- amenities aumentam desirability;
- farms/granaries/markets reduzem desirability próxima;
- casas usam desirability na evolução/degradação;
- overlay de desirability está disponível;
- painel mostra stats de desirability;
- analyzer deteta baixa desirability;
- README documenta as novas regras;
- não são introduzidos walkers, eventos, safety/prefecture, save/load, dependências novas ou browser testing;
- working tree fica limpo depois do commit/push.

## Decisões para evitar overengineering

- Manhattan distance para desirability;
- score 0–100 simples;
- constantes explícitas no módulo;
- sem falloff;
- sem cache persistente;
- sem bairros/regiões;
- sem classes sociais;
- sem desirability por road network;
- sem novo sistema genérico de aura/effects além do necessário;
- sem workers para amenities;
- sem novas advisor actions;
- sem browser testing.

## Entrega esperada do OMP

O OMP deve:

1. implementar exclusivamente a Fase 20;
2. seguir TDD para desirability e housing/analyzer afetados;
3. preservar as fases 1–19;
4. atualizar testes, README e UI necessários;
5. correr `npm run build` e `npm test`;
6. não usar browser testing;
7. devolver resumo, ficheiros alterados e evidência de verificação.
