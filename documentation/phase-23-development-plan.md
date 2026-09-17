# AICaesar — Plano de Desenvolvimento da Fase 23

## Objetivo

Adicionar demolição explícita de edifícios e estradas, permitindo ao jogador corrigir uma cidade mal planeada e reconfigurar a rede sem apagar o save ou reiniciar o cenário.

A fase deve manter o modelo actual simples: demolição é uma operação imediata, sem refund, sem animação e sem novos sistemas económicos.

```text
 jogador selecciona Bulldoze
          ↓
 clique num edifício/estrada
          ↓
 remove referência do tile + building
          ↓
 reatribui workers e recalcula estado derivado
          ↓
 actualiza mapa, painéis, cenário e advisor
```

## Estado actual

- `CityState` mantém `tiles` com `buildingId` e `buildings` como array mutável;
- `placeBuilding` trata apenas construção e não existe operação de remoção;
- `Game.ts` transforma cliques em coordenadas de tile e centraliza `refreshCity()`;
- trabalhadores, estradas, cobertura, desirability, população, comida, eventos e cenário são derivados do estado actual;
- Save/Load da Fase 22 serializa o estado existente e deve continuar a funcionar sem alterações de schema;
- o painel de construção selecciona ferramentas de edifícios, mas não tem ferramenta de demolição;
- o projecto usa TypeScript estrito, Vitest e não faz browser/manual UI testing.

## Escopo

### Inclui

- novo resultado/API de domínio para remover um building por coordenadas ou referência segura;
- ferramenta `bulldoze` seleccionável no `BuildPanel`;
- feedback para demolição bem-sucedida, tile vazio e cenário terminado;
- remoção consistente do `buildingId` no tile e do building no array;
- reatribuição de workers após remoção;
- refresh dos painéis, mapa, overlays, scenario e advisor após demolição;
- invalidação segura de plano/report do advisor quando a cidade muda por demolição;
- demolição de qualquer tipo de building actual, incluindo roads;
- remoção sem refund e sem custo;
- testes unitários da operação de domínio;
- testes headless da integração da ferramenta, callback e lifecycle já usado pelo `Game`;
- testes de regressão para Save/Load, eventos, food logistics, road network, population, finance, scenario, advisor e renderer;
- actualização do README e desta documentação se necessário.

### Exclui

- confirmação/modal de demolição;
- refund parcial ou cálculo de valor residual;
- demolição em massa, drag-to-bulldoze ou undo;
- custos, felicidade ou penalizações adicionais por demolição;
- ruínas, entulho, animações, efeitos sonoros ou novos assets;
- alterações ao schema de Save/Load;
- alteração ao balanceamento de edifícios, população, eventos ou cenário;
- construção multi-tile, zoning ou drag-to-build;
- backend, rede, sincronização ou dependências novas;
- browser/manual UI testing.

## Decisões de comportamento

- `bulldoze` é uma ferramenta distinta das ferramentas de construção;
- clicar num tile com building remove exactamente esse building;
- clicar num tile vazio devolve resultado explícito e não altera a cidade;
- coordenadas fora do mapa devolvem resultado explícito e não alteram a cidade;
- a operação não devolve dinheiro ao jogador;
- uma tentativa bloqueada por cenário terminal não deve remover nada;
- a remoção de uma estrada pode isolar edifícios e esses efeitos devem aparecer no refresh normal;
- a remoção de uma casa elimina a população dessa casa, sem movimento ou compensação imediata;
- a remoção de farm, granary ou market elimina o stock local desse edifício;
- remover um building com `tile.buildingId` inconsistente deve falhar de forma segura, sem apagar um building diferente;
- ids e referências restantes devem continuar consistentes para Save/Load e eventos;
- a demolição não avança tick, não executa eventos, não aplica finanças e não altera o save local automaticamente;
- Reset continua a criar uma cidade nova e Load continua independente da ferramenta.

## API de domínio

Adicionar uma operação pequena e testável, com nomes equivalentes a:

```ts
type DemolishResult =
  | 'demolished'
  | 'outside-map'
  | 'empty'
  | 'inconsistent-state';

function demolishBuilding(city: CityState, x: number, y: number): DemolishResult;
```

Os nomes exactos ficam ao critério do OMP. A operação deve:

1. validar o tile através dos helpers existentes;
2. obter o `buildingId` do tile;
3. encontrar exactamente o building correspondente;
4. limpar o `buildingId` do tile;
5. remover apenas o building correspondente do array;
6. preservar a mesma referência de `city`, como acontece com `placeBuilding`;
7. deixar `assignWorkers(city)` e os cálculos derivados para a camada de integração/simulação, não duplicar regras no domínio;
8. ser determinística e não lançar em inputs normais.

Não adicionar um segundo registo de ocupação nem manter tombstones.

## Integração com Game e UI

O `BuildPanel` deve expor a ferramenta com:

```text
[Bulldoze]
```

Requisitos:

- label e `title` claros;
- a selecção da ferramenta deve actualizar o estado visual como as restantes ferramentas;
- a ferramenta não deve consumir dinheiro;
- o cursor/feedback actual pode ser reutilizado;
- o clique num tile deve escolher entre `demolishBuilding` e `placeBuilding`;
- após sucesso: `assignWorkers(city)` e o mesmo `refreshCity()` central;
- após falha: mostrar mensagem sem mutar o estado;
- depois de demolição, invalidar o plano/report do advisor, porque o diagnóstico e as acções podem referir edifícios removidos;
- overlays activos devem continuar activos;
- a câmara, pausa e velocidade não devem mudar;
- se o cenário estiver won/lost, a demolição deve ser bloqueada como a construção;
- `destroy()` deve remover todos os listeners/controlos sem leaks.

## Compatibilidade com sistemas existentes

Preservar explicitamente:

- IDs de buildings sobreviventes e referências válidas em tiles;
- eventos activos e pedidos imperiais que não apontem para o building removido;
- Save/Load schema version 1;
- recalculo de road network, desirability, water/food coverage e housing stats;
- atribuição de workers e actividade de workplaces;
- população e finanças sem efeitos artificiais;
- bloqueio terminal do cenário;
- comportamento do advisor e validação de acções;
- ausência de chamadas de rede e dependências novas.

Se um evento activo referir o edifício demolido, a solução deve escolher uma regra local e explícita, preferencialmente limpar esse target/efeito de forma segura sem reprocessar o evento. Não reactivar, duplicar ou aplicar retroactivamente efeitos.

## Testes obrigatórios

Seguir TDD para a operação de domínio e integração.

Testes mínimos:

1. demolir cada tipo de building remove-o do array e limpa o tile;
2. demolir tile vazio devolve erro sem mutação;
3. coordenadas fora do mapa devolvem erro sem mutação;
4. estado inconsistente devolve erro sem apagar dados;
5. demolição não devolve dinheiro e não altera `simulation.tick`;
6. demolir casa remove apenas a população dessa casa;
7. demolir workplace remove o stock/actividade associado ao building removido;
8. demolir estrada recalcula isolamento/road access no refresh seguinte;
9. workers são reatribuídos depois de demolir um workplace ou casa;
10. overlays e restante configuração de sessão são preservados;
11. cenário terminal bloqueia demolição;
12. advisor plan/report pendente é invalidado após demolição;
13. Save/Load continua a preservar a cidade resultante sem alterar o schema;
14. tentativa de demolição não dispara tick, finanças, eventos ou penalizações;
15. botão/ferramenta é destruído correctamente no lifecycle do Game;
16. regressão completa com `npm test` e `npm run build`.

## Critérios de aceitação

A Fase 23 está concluída quando:

- existe uma ferramenta Bulldoze utilizável no painel;
- qualquer building actual pode ser removido com um clique;
- remoção e referências de tile permanecem consistentes;
- não há refund nem avanço de tick;
- workers, estradas, coberturas, desirability, população e advisor reflectem a cidade resultante;
- cenário terminal bloqueia a operação;
- Save/Load continua compatível com schema version 1;
- mensagens de sucesso/erro são compreensíveis;
- `npm test` passa;
- `npm run build` passa;
- não é feito browser/manual UI testing;
- working tree fica limpo depois do commit/push.

## Decisões para evitar overengineering

- uma ferramenta, uma operação imediata e sem confirmação;
- nenhuma nova camada de estado;
- sem refund, undo ou histórico;
- sem mudança de schema;
- reutilizar `getTile`, `assignWorkers`, `refreshCity` e os controlos existentes;
- efeitos derivados devem ser obtidos pelos cálculos actuais, não por caches novos;
- sem assets, dependências ou backend novos.

## Entrega esperada do OMP

O OMP deve:

1. implementar exclusivamente a Fase 23;
2. seguir TDD para demolição e integração;
3. preservar as fases 1–22;
4. actualizar testes, README e UI necessários;
5. correr `npm test` e `npm run build`;
6. não usar browser testing;
7. não fazer commit ou push da implementação;
8. devolver resumo, ficheiros alterados e evidência de verificação.
